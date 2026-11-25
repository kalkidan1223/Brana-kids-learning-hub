-- Track whether each child recommendation came from Python ML or the safe
-- Node rule fallback, and preserve the model artifact version when available.
ALTER TABLE ai_recommendations
  ADD COLUMN IF NOT EXISTS recommendation_source VARCHAR(24) NOT NULL DEFAULT 'rule_fallback',
  ADD COLUMN IF NOT EXISTS model_version VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recommendation_score NUMERIC(7,6);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_recommendations_source_check') THEN
    ALTER TABLE ai_recommendations
      ADD CONSTRAINT ai_recommendations_source_check
      CHECK (recommendation_source IN ('rule_fallback', 'sklearn_model'));
  END IF;
END $$;
