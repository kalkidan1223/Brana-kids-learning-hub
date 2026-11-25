-- Keep historical assessment snapshots if an instructor later removes content.
ALTER TABLE student_assessment_events
  ALTER COLUMN course_id DROP NOT NULL,
  ALTER COLUMN lesson_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subject_code_snapshot VARCHAR(20),
  ADD COLUMN IF NOT EXISTS grade_code_snapshot VARCHAR(20),
  ADD COLUMN IF NOT EXISTS topic_code_snapshot VARCHAR(50);

ALTER TABLE student_assessment_events
  DROP CONSTRAINT IF EXISTS student_assessment_events_course_id_fkey,
  DROP CONSTRAINT IF EXISTS student_assessment_events_lesson_id_fkey,
  ADD CONSTRAINT student_assessment_events_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  ADD CONSTRAINT student_assessment_events_lesson_id_fkey
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL;

UPDATE student_assessment_events e
SET subject_code_snapshot = COALESCE(e.subject_code_snapshot, s.code),
    grade_code_snapshot = COALESCE(e.grade_code_snapshot, gl.code)
FROM courses c
LEFT JOIN subjects s ON s.id = c.subject_id
LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
WHERE c.id = e.course_id;

UPDATE student_assessment_events e
SET topic_code_snapshot = co.objective_code
FROM curriculum_objectives co
WHERE co.id = e.topic_id AND e.topic_code_snapshot IS NULL;

CREATE OR REPLACE FUNCTION capture_quiz_assessment_event()
RETURNS TRIGGER AS $$
DECLARE
  lesson_record RECORD;
  objective_id INT;
  objective_code VARCHAR(50);
  attempt_no INT;
BEGIN
  IF NEW.total_points IS NULL OR NEW.total_points <= 0 OR NEW.submitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.id AS lesson_id, c.id AS course_id, q.id AS quiz_id, q.max_score,
         s.code AS subject_code, gl.code AS grade_code
    INTO lesson_record
  FROM quizzes q
  JOIN lessons l ON l.id = q.lesson_id
  JOIN courses c ON c.id = l.course_id
  LEFT JOIN subjects s ON s.id = c.subject_id
  LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
  WHERE q.id = NEW.quiz_id;
  IF NOT FOUND OR lesson_record.max_score IS NULL OR lesson_record.max_score <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN COUNT(DISTINCT qq.curriculum_objective_id) = 1
              THEN MIN(qq.curriculum_objective_id) END::int
    INTO objective_id
  FROM quiz_questions qq
  WHERE qq.quiz_id = NEW.quiz_id AND qq.curriculum_objective_id IS NOT NULL;
  SELECT co.objective_code INTO objective_code
  FROM curriculum_objectives co WHERE co.id = objective_id;

  SELECT COUNT(*)::int + 1 INTO attempt_no
  FROM student_assessment_events
  WHERE student_id = NEW.student_id AND assessment_type = 'quiz'
    AND assessment_id = NEW.quiz_id;

  INSERT INTO student_assessment_events (
    student_id, course_id, lesson_id, topic_id, assessment_type, assessment_id,
    source_record_id, score, maximum_score, percentage_score, attempt_number,
    completion_status, submitted_at, subject_code_snapshot, grade_code_snapshot,
    topic_code_snapshot
  ) VALUES (
    NEW.student_id, lesson_record.course_id, lesson_record.lesson_id, objective_id,
    'quiz', NEW.quiz_id, NEW.id, GREATEST(0, NEW.score), lesson_record.max_score,
    LEAST(100, GREATEST(0, NEW.score::numeric / NULLIF(NEW.total_points, 0) * 100)),
    attempt_no, 'graded', NEW.submitted_at, lesson_record.subject_code,
    lesson_record.grade_code, objective_code
  ) ON CONFLICT (assessment_type, source_record_id, submitted_at) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION capture_activity_assessment_event()
RETURNS TRIGGER AS $$
DECLARE
  lesson_record RECORD;
  attempt_no INT;
BEGIN
  IF NEW.status <> 'graded' OR NEW.score IS NULL OR NEW.submitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.id AS lesson_id, c.id AS course_id, a.id AS activity_id, a.max_score,
         s.code AS subject_code, gl.code AS grade_code
    INTO lesson_record
  FROM activities a
  JOIN lessons l ON l.id = a.lesson_id
  JOIN courses c ON c.id = l.course_id
  LEFT JOIN subjects s ON s.id = c.subject_id
  LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
  WHERE a.id = NEW.activity_id;
  IF NOT FOUND OR lesson_record.max_score IS NULL OR lesson_record.max_score <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int + 1 INTO attempt_no
  FROM student_assessment_events
  WHERE student_id = NEW.student_id AND assessment_type = 'activity'
    AND assessment_id = NEW.activity_id;

  INSERT INTO student_assessment_events (
    student_id, course_id, lesson_id, topic_id, assessment_type, assessment_id,
    source_record_id, score, maximum_score, percentage_score, attempt_number,
    completion_status, submitted_at, subject_code_snapshot, grade_code_snapshot
  ) VALUES (
    NEW.student_id, lesson_record.course_id, lesson_record.lesson_id, NULL,
    'activity', NEW.activity_id, NEW.id, GREATEST(0, NEW.score), lesson_record.max_score,
    LEAST(100, GREATEST(0, NEW.score::numeric / NULLIF(lesson_record.max_score, 0) * 100)),
    attempt_no, 'graded', NEW.submitted_at, lesson_record.subject_code,
    lesson_record.grade_code
  ) ON CONFLICT (assessment_type, source_record_id, submitted_at) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
