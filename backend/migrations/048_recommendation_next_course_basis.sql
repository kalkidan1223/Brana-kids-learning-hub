-- Track recommendations that move a learner into the next available course.
ALTER TABLE ai_recommendations
  DROP CONSTRAINT IF EXISTS ai_recommendations_basis_check;

ALTER TABLE ai_recommendations
  ADD CONSTRAINT ai_recommendations_basis_check
  CHECK (recommendation_basis IN ('legacy', 'starter', 'weak_area', 'progress', 'challenge', 'next_course'));
