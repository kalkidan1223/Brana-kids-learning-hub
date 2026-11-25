ALTER TABLE ai_recommendations
  DROP CONSTRAINT IF EXISTS ai_recommendations_source_check;

ALTER TABLE ai_recommendations
  ADD CONSTRAINT ai_recommendations_source_check
  CHECK (recommendation_source IN ('rule_fallback', 'insufficient_data', 'sklearn_model'));
