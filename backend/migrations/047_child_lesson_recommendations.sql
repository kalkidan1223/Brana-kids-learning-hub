-- Give child-facing recommendations a real lesson relationship and lifecycle.
ALTER TABLE ai_recommendations
  ADD COLUMN IF NOT EXISTS lesson_id BIGINT REFERENCES lessons(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recommendation_basis VARCHAR(24) NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_recommendations_basis_check') THEN
    ALTER TABLE ai_recommendations
      ADD CONSTRAINT ai_recommendations_basis_check
      CHECK (recommendation_basis IN ('legacy', 'starter', 'weak_area', 'progress', 'challenge'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_recommendations_status_check') THEN
    ALTER TABLE ai_recommendations
      ADD CONSTRAINT ai_recommendations_status_check
      CHECK (status IN ('pending', 'started', 'completed', 'replaced', 'unavailable'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_lesson ON ai_recommendations(lesson_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_student_status
  ON ai_recommendations(student_id, status, generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_recommendations_one_open_lesson_per_student
  ON ai_recommendations(student_id)
  WHERE lesson_id IS NOT NULL AND status IN ('pending', 'started');
