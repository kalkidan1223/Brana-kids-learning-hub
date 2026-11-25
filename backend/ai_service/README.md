# Brana Kids Hub ML recommendation service

This service is separated from Express. Node remains responsible for identity,
authorization, PostgreSQL access, lesson eligibility, recommendation storage,
and lesson navigation. Python receives only per-subject performance features
and already-authorized lesson candidates; it never receives student IDs,
names, emails, passwords, or tokens.

## Model and target

The supervised target is `needs_practice`: the **next** assessment for a
student and subject scores below the project's existing 60% weak-area
threshold. Scores at or above 60% mean only that the existing weak-area rule
does not flag the result; they are not asserted to prove mastery.
`ML_STRUGGLE_THRESHOLD` can change that threshold for the school.
Training rows use only earlier assessment events for the same student and
subject. Features are prior mean score, prior latest score, prior score trend,
prior attempt count, grade code, and subject code. Student IDs are used only as
groups for validation and are never passed to the model.

The training script compares Logistic Regression and Random Forest pipelines.
It uses grouped holdout folds so one student's attempts cannot occur in both a
training and validation fold. It reports accuracy, precision, recall, and F1
for the selected model, and refuses to save an artifact unless the dataset has
at least 30 time-ordered examples, five distinct learners represented among
those examples, both target classes, and at least five examples of each class.
These are explicit operational gates: five groups allows grouped holdout
splits, and five examples per class avoids reporting class metrics from only
one or two records. They are not evidence of statistical reliability. The
admin readiness panel reports the gates and blocks training below them; passing
the gate still requires human review of the dataset and metrics.

The inference endpoint predicts struggle probability for a subject and ranks
Node-approved lessons using that probability plus TF-IDF similarity between
the student's learning needs and lesson title/description/objectives. Node
validates the returned lesson ID against the approved candidates before saving
it. Course sequencing, publication status, grade access, and prerequisites
remain application rules.

## Local setup

Use Python 3.10 or newer. From `backend/ai_service`:

```powershell
cd ..
node scripts/run-migration.js 050
node scripts/run-migration.js 051
node scripts/run-migration.js 052
cd ai_service
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Migration 050 creates the append-only `student_assessment_events` ledger and
captures real quiz results plus graded activity submissions. Migration 052
preserves subject, grade, and topic snapshots so historic events remain usable
if curriculum content is later removed. Existing quiz
attempts are backfilled. Only the currently retained graded row can be
backfilled for activities that the old workflow overwrote; unavailable old
attempts are not fabricated. New grading/resubmission events are captured by
database triggers, so all existing Node submission routes feed the ML dataset
without changing their authorization or response behavior.

Set the same internal secret in the Node and Python environments. Do not use a
frontend-visible environment variable:

```text
ML_SERVICE_URL=http://127.0.0.1:8001
ML_SERVICE_TOKEN=<long-random-internal-secret>
ML_STRUGGLE_THRESHOLD=0.60
```

Export actual assessment events and attempt training:

```powershell
node export_training_data.js
python train_model.py
python -m unittest -v test_train_model.py
```

The exporter writes `data/training_events.csv`. This file contains numeric
student IDs only for group splitting; they are excluded from model features.
Keep it local and do not commit it. The admin portal's AI Recommendations page
shows assessment attempts, valid time-ordered examples, target classes, missing
fields, training gate reasons, model version, and the last successful training
date. If the script reports insufficient data, the model is not trained and
the Node recommender stores either `insufficient_data` or `rule_fallback` as
the recommendation source.

The training unit tests use only in-memory development fixtures to verify that
features are built from earlier attempts and student IDs are excluded from
predictive features. They do not write to PostgreSQL or report model metrics.

After a successful training run, start inference separately:

```powershell
$env:ML_SERVICE_TOKEN = '<same-long-random-internal-secret>'
python -m uvicorn app:app --host 127.0.0.1 --port 8001
```

The service loads `models/student_struggle_v1.joblib` and reloads it when the
artifact changes. Training is an offline command; dashboard requests never
train or retrain the model. Retrain after collecting more real results by
re-exporting data and running `train_model.py` again. The saved artifact
contains the selected model, preprocessing pipeline, version, and actual
evaluation metrics.

## Current local data audit

At implementation time the configured database had three active students,
zero quiz attempts, one graded activity attempt, and only one learner with
scores. That produces zero valid time-ordered prediction examples because the
first score for a learner/topic cannot be used as a prior-history prediction
without leakage. It is not enough for the stated training/evaluation
safeguards, so no model or performance metrics are claimed. Until enough real
data exists, recommendations are marked `insufficient_data` or
`rule_fallback` in PostgreSQL and remain connected to the existing course
progression logic.

The current development environment does not have an executable Python
interpreter (`python.exe` is an inaccessible Windows app alias and `py` is not
installed). The Python service, training pipeline, and unit tests could not be
executed here. After installing Python and requirements, run the commands
above; the current one-event export should be rejected without creating a
model artifact.
