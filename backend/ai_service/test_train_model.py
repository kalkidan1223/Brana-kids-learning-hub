"""Development-only tests for temporal feature engineering; no DB is used."""

import unittest

import pandas as pd

from train_model import FEATURES, prepare_examples


class PrepareExamplesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.events = pd.DataFrame([
            {"student_id": "dev_student_a", "grade_code": "KG1", "subject_code": "ENG", "assessment_score": 0.50, "assessed_at": "2025-01-01T10:00:00Z"},
            {"student_id": "dev_student_a", "grade_code": "KG1", "subject_code": "ENG", "assessment_score": 0.80, "assessed_at": "2025-01-02T10:00:00Z"},
            {"student_id": "dev_student_a", "grade_code": "KG1", "subject_code": "ENG", "assessment_score": 0.40, "assessed_at": "2025-01-03T10:00:00Z"},
            {"student_id": "dev_student_b", "grade_code": "KG2", "subject_code": "MATH", "assessment_score": 0.55, "assessed_at": "2025-01-01T10:00:00Z"},
            {"student_id": "dev_student_b", "grade_code": "KG2", "subject_code": "MATH", "assessment_score": 0.70, "assessed_at": "2025-01-02T10:00:00Z"},
        ])

    def test_features_use_only_prior_assessments(self) -> None:
        features, target, groups = prepare_examples(self.events)
        self.assertEqual(len(features), 3)
        self.assertEqual(features.iloc[0]["prior_average_score"], 0.50)
        self.assertEqual(features.iloc[0]["prior_latest_score"], 0.50)
        self.assertEqual(features.iloc[0]["prior_attempt_count"], 1)
        self.assertEqual(int(target.iloc[0]), 0)  # the next score is 80%, not below 60%
        self.assertEqual(groups.iloc[0], "dev_student_a")
        self.assertNotIn("student_id", FEATURES)

    def test_single_event_is_not_a_prediction_example(self) -> None:
        features, target, groups = prepare_examples(self.events.iloc[[0]])
        self.assertTrue(features.empty)
        self.assertTrue(target.empty)
        self.assertTrue(groups.empty)


if __name__ == "__main__":
    unittest.main()
