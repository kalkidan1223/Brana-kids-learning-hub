"""Train and evaluate a grouped student-struggle classifier from real events."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

APP_DIR = Path(__file__).resolve().parent
DATA_PATH = Path(os.getenv("ML_TRAINING_DATA", APP_DIR / "data" / "training_events.csv"))
MODEL_PATH = Path(os.getenv("ML_MODEL_PATH", APP_DIR / "models" / "student_struggle_v1.joblib"))
try:
    MASTERY_THRESHOLD = float(os.getenv("ML_STRUGGLE_THRESHOLD", "0.60"))
except ValueError:
    MASTERY_THRESHOLD = 0.0
NUMERIC = [
    "prior_average_score",
    "prior_latest_score",
    "prior_score_trend",
    "prior_attempt_count",
]
CATEGORICAL = ["grade_code", "subject_code"]
FEATURES = CATEGORICAL + NUMERIC


def prepare_examples(events: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    required = {"student_id", "grade_code", "subject_code", "assessment_score", "assessed_at"}
    missing = required.difference(events.columns)
    if missing:
        raise ValueError(f"Training CSV is missing columns: {', '.join(sorted(missing))}")

    events = events.copy()
    events["assessment_score"] = pd.to_numeric(events["assessment_score"], errors="coerce")
    events["assessed_at"] = pd.to_datetime(events["assessed_at"], errors="coerce", utc=True)
    events = events.dropna(subset=[
        "student_id", "grade_code", "subject_code", "assessment_score", "assessed_at"
    ])
    events["assessment_score"] = events["assessment_score"].clip(0, 1)
    events = events.sort_values(["student_id", "subject_code", "assessed_at"])

    feature_rows: list[dict[str, object]] = []
    labels: list[int] = []
    groups: list[object] = []
    for (student_id, subject_code), history in events.groupby(
        ["student_id", "subject_code"], sort=False
    ):
        scores = history["assessment_score"].to_numpy(dtype=float)
        grades = history["grade_code"].astype(str).to_list()
        for index in range(1, len(history)):
            prior = scores[:index]
            feature_rows.append({
                "grade_code": grades[index],
                "subject_code": str(subject_code),
                "prior_average_score": float(np.mean(prior)),
                "prior_latest_score": float(prior[-1]),
                "prior_score_trend": float(prior[-1] - prior[0]),
                "prior_attempt_count": int(len(prior)),
            })
            # Target 1 means the following assessment was below the existing
            # Node recommender's 60% weak-area threshold and needs more practice.
            labels.append(int(scores[index] < MASTERY_THRESHOLD))
            groups.append(student_id)

    X = pd.DataFrame(feature_rows, columns=FEATURES)
    y = pd.Series(labels, name="needs_practice", dtype="int64")
    group_series = pd.Series(groups, name="student_group")
    return X, y, group_series


def make_pipeline(model_name: str) -> Pipeline:
    numeric_steps: list[tuple[str, object]] = [("imputer", SimpleImputer(strategy="median"))]
    if model_name == "logistic_regression":
        numeric_steps.append(("scale", StandardScaler()))
    preprocessing = ColumnTransformer([
        ("numeric", Pipeline(numeric_steps), NUMERIC),
        ("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("one_hot", OneHotEncoder(handle_unknown="ignore")),
        ]), CATEGORICAL),
    ])
    if model_name == "logistic_regression":
        classifier = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    else:
        # Tree-based models do not need feature scaling.
        classifier = RandomForestClassifier(
            n_estimators=250,
            class_weight="balanced_subsample",
            min_samples_leaf=2,
            random_state=42,
        )
    return Pipeline([("preprocess", preprocessing), ("classifier", classifier)])


def evaluate_grouped(X: pd.DataFrame, y: pd.Series, groups: pd.Series) -> dict[str, dict[str, float]]:
    unique_students = groups.nunique()
    splitter = GroupShuffleSplit(
        n_splits=min(5, unique_students), test_size=0.25, random_state=42
    )
    scores: dict[str, list[dict[str, float]]] = {
        "logistic_regression": [],
        "random_forest": [],
    }
    for train_indices, test_indices in splitter.split(X, y, groups):
        y_train, y_test = y.iloc[train_indices], y.iloc[test_indices]
        if y_train.nunique() < 2:
            continue
        for model_name in scores:
            model = make_pipeline(model_name)
            model.fit(X.iloc[train_indices], y_train)
            predicted = model.predict(X.iloc[test_indices])
            scores[model_name].append({
                "accuracy": float(accuracy_score(y_test, predicted)),
                "precision": float(precision_score(y_test, predicted, zero_division=0)),
                "recall": float(recall_score(y_test, predicted, zero_division=0)),
                "f1": float(f1_score(y_test, predicted, zero_division=0)),
            })

    return {
        name: {
            metric: float(np.mean([fold[metric] for fold in folds]))
            for metric in ("accuracy", "precision", "recall", "f1")
        }
        for name, folds in scores.items()
        if folds
    }


def main() -> int:
    if not DATA_PATH.is_file():
        print(f"Not trained: training data file not found at {DATA_PATH}", file=sys.stderr)
        return 2
    if not np.isfinite(MASTERY_THRESHOLD) or not 0 < MASTERY_THRESHOLD < 1:
        print("ML_STRUGGLE_THRESHOLD must be between 0 and 1", file=sys.stderr)
        return 2

    events = pd.read_csv(DATA_PATH)
    X, y, groups = prepare_examples(events)
    if len(X) < 30 or groups.nunique() < 5 or y.nunique() < 2 or y.value_counts().min() < 5:
        print(
            "Not trained: require at least 30 time-ordered prediction examples, "
            "5 distinct students, both target classes, and 5 examples in each class. "
            f"Available: {len(X)} examples, {groups.nunique()} students, "
            f"labels={y.value_counts().to_dict()}.",
            file=sys.stderr,
        )
        return 2

    evaluation = evaluate_grouped(X, y, groups)
    if not evaluation:
        print("Not trained: grouped validation could not create a valid two-class training fold.", file=sys.stderr)
        return 2

    selected_name = max(
        evaluation,
        key=lambda name: (evaluation[name]["f1"], evaluation[name]["recall"]),
    )
    final_pipeline = make_pipeline(selected_name)
    final_pipeline.fit(X, y)
    trained_at = datetime.now(timezone.utc).isoformat()
    version = "student-struggle-v1-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bundle = {
        "pipeline": final_pipeline,
        "model_version": version,
        "selected_model": selected_name,
        "feature_columns": FEATURES,
        "target": "needs_practice: next assessment score below configured threshold",
        "struggle_threshold": MASTERY_THRESHOLD,
        "training_examples": int(len(X)),
        "student_groups": int(groups.nunique()),
        "trained_at": trained_at,
        "evaluation_metrics": evaluation[selected_name],
        "candidate_evaluation": evaluation,
        "validation": "GroupShuffleSplit by student; reported metrics are means over valid held-out group folds",
    }
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=MODEL_PATH.parent, suffix=".tmp", delete=False) as temp:
        temp_path = Path(temp.name)
    try:
        joblib.dump(bundle, temp_path)
        temp_path.replace(MODEL_PATH)
    finally:
        temp_path.unlink(missing_ok=True)

    print(json.dumps({key: value for key, value in bundle.items() if key != "pipeline"}, indent=2))
    print(f"Saved evaluated model: {MODEL_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
