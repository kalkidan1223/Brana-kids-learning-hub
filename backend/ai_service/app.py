"""Protected inference service for Brana Kids Hub recommendations."""

from __future__ import annotations

import hmac
import os
from pathlib import Path
from threading import Lock
from typing import Any

import joblib
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

APP_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("ML_MODEL_PATH", APP_DIR / "models" / "student_struggle_v1.joblib"))
FEATURE_COLUMNS = [
    "grade_code",
    "subject_code",
    "prior_average_score",
    "prior_latest_score",
    "prior_score_trend",
    "prior_attempt_count",
]
try:
    STRUGGLE_THRESHOLD = float(os.getenv("ML_STRUGGLE_THRESHOLD", "0.60"))
except ValueError:
    STRUGGLE_THRESHOLD = 0.60
if not 0 < STRUGGLE_THRESHOLD < 1:
    STRUGGLE_THRESHOLD = 0.60

app = FastAPI(title="Brana Kids Hub ML Service", version="1.0.0")
_model_lock = Lock()
_model_cache: dict[str, Any] | None = None
_model_mtime: float | None = None


class SubjectHistory(BaseModel):
    subject_code: str
    subject_name: str
    grade_code: str
    prior_average_score: float = Field(ge=0, le=1)
    prior_latest_score: float = Field(ge=0, le=1)
    prior_score_trend: float = Field(ge=-1, le=1)
    prior_attempt_count: int = Field(ge=1)


class EligibleLesson(BaseModel):
    lesson_id: int
    course_id: int
    title: str
    description: str | None = None
    subject_code: str
    subject_name: str
    grade_code: str
    objectives: list[str] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    performance_history: list[SubjectHistory] = Field(default_factory=list)
    eligible_lessons: list[EligibleLesson] = Field(default_factory=list, max_length=500)


def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    configured = os.getenv("ML_SERVICE_TOKEN", "")
    if not configured or not x_internal_token or not hmac.compare_digest(configured, x_internal_token):
        raise HTTPException(status_code=401, detail="Internal service authorization failed")


def load_model() -> dict[str, Any] | None:
    global _model_cache, _model_mtime
    if not MODEL_PATH.is_file():
        _model_cache = None
        _model_mtime = None
        return None

    mtime = MODEL_PATH.stat().st_mtime
    if _model_cache is not None and _model_mtime == mtime:
        return _model_cache

    with _model_lock:
        if _model_cache is not None and _model_mtime == mtime:
            return _model_cache
        bundle = joblib.load(MODEL_PATH)
        if not isinstance(bundle, dict) or "pipeline" not in bundle or "model_version" not in bundle:
            raise RuntimeError("The saved model artifact has an unsupported format")
        _model_cache = bundle
        _model_mtime = mtime
        return bundle


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/internal/status", dependencies=[Depends(require_internal_token)])
def model_status() -> dict[str, Any]:
    bundle = load_model()
    if not bundle:
        return {
            "status": "not_trained",
            "model_available": False,
            "model_version": None,
            "metrics": None,
            "trained_at": None,
        }
    return {
        "status": "trained",
        "model_available": True,
        "model_version": bundle["model_version"],
        "metrics": bundle.get("evaluation_metrics"),
        "trained_at": bundle.get("trained_at"),
    }


@app.post("/v1/predict-and-recommend", dependencies=[Depends(require_internal_token)])
def predict_and_recommend(payload: RecommendationRequest) -> dict[str, Any]:
    bundle = load_model()
    if not bundle:
        return {
            "model_available": False,
            "model_version": None,
            "predictions": [],
            "ranked_lessons": [],
        }
    if not payload.performance_history or not payload.eligible_lessons:
        return {
            "model_available": True,
            "model_version": bundle["model_version"],
            "predictions": [],
            "ranked_lessons": [],
        }

    history_by_key = {
        (item.subject_code, item.grade_code): item.model_dump()
        for item in payload.performance_history
    }
    eligible_with_history = [
        lesson for lesson in payload.eligible_lessons
        if (lesson.subject_code, lesson.grade_code) in history_by_key
    ]
    if not eligible_with_history:
        return {
            "model_available": True,
            "model_version": bundle["model_version"],
            "predictions": [],
            "ranked_lessons": [],
        }

    rows = []
    for lesson in eligible_with_history:
        history = history_by_key[(lesson.subject_code, lesson.grade_code)]
        rows.append({column: history[column] for column in FEATURE_COLUMNS})

    pipeline = bundle["pipeline"]
    probabilities = pipeline.predict_proba(pd.DataFrame(rows, columns=FEATURE_COLUMNS))
    classes = list(pipeline.classes_)
    struggle_column = classes.index(1)
    struggle_probabilities = probabilities[:, struggle_column]

    documents = [
        " ".join(filter(None, [
            lesson.subject_name,
            lesson.subject_code,
            lesson.grade_code,
            lesson.title,
            lesson.description or "",
            " ".join(lesson.objectives),
        ]))
        for lesson in eligible_with_history
    ]
    risk_subjects = sorted(
        payload.performance_history,
        key=lambda item: item.prior_average_score,
    )
    need_terms = " ".join(
        f"{item.subject_name} {item.subject_code} {item.grade_code} practice review explanation"
        for item in risk_subjects[:3]
    )
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)
    vectors = vectorizer.fit_transform([need_terms, *documents])
    similarities = cosine_similarity(vectors[0:1], vectors[1:]).ravel()

    ranked = []
    prediction_by_key: dict[tuple[str, str], float] = {}
    for lesson, probability, similarity in zip(
        eligible_with_history, struggle_probabilities, similarities, strict=True
    ):
        key = (lesson.subject_code, lesson.grade_code)
        prediction_by_key[key] = float(probability)
        relevance = float(0.8 * probability + 0.2 * similarity)
        ranked.append({
            "lesson_id": lesson.lesson_id,
            "content_type": "lesson",
            "subject_code": lesson.subject_code,
            "struggle_probability": round(float(probability), 6),
            "content_similarity": round(float(similarity), 6),
            "recommendation_score": round(relevance, 6),
            "recommendation_type": "revision" if probability >= STRUGGLE_THRESHOLD else "next_step",
        })
    ranked.sort(key=lambda item: (-item["recommendation_score"], item["lesson_id"]))

    predictions = [
        {
            "subject_code": item.subject_code,
            "grade_code": item.grade_code,
            "struggle_probability": round(
                prediction_by_key[(item.subject_code, item.grade_code)], 6
            ),
        }
        for item in payload.performance_history
        if (item.subject_code, item.grade_code) in prediction_by_key
    ]
    return {
        "model_available": True,
        "model_version": bundle["model_version"],
        "predictions": predictions,
        "ranked_lessons": ranked,
    }
