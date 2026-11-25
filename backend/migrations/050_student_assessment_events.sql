-- Append-only snapshots of real scored assessments for learning analytics.
-- Source tables remain authoritative for the application; this ledger preserves
-- historical quiz/activity attempts even where an activity submission is later
-- updated in place by the existing workflow.
CREATE TABLE IF NOT EXISTS student_assessment_events (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  topic_id INT REFERENCES curriculum_objectives(id) ON DELETE SET NULL,
  assessment_type VARCHAR(16) NOT NULL CHECK (assessment_type IN ('quiz', 'activity')),
  assessment_id BIGINT NOT NULL,
  source_record_id BIGINT NOT NULL,
  score NUMERIC(8,2) NOT NULL CHECK (score >= 0),
  maximum_score NUMERIC(8,2) NOT NULL CHECK (maximum_score > 0),
  percentage_score NUMERIC(5,2) NOT NULL CHECK (percentage_score BETWEEN 0 AND 100),
  attempt_number INT NOT NULL CHECK (attempt_number > 0),
  completion_status VARCHAR(20) NOT NULL CHECK (completion_status = 'graded'),
  submitted_at TIMESTAMPTZ NOT NULL,
  time_spent_seconds INT CHECK (time_spent_seconds IS NULL OR time_spent_seconds >= 0),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_type, source_record_id, submitted_at)
);

CREATE INDEX IF NOT EXISTS idx_assessment_events_student_subject_time
  ON student_assessment_events(student_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_assessment_events_assessment
  ON student_assessment_events(assessment_type, assessment_id, student_id, attempt_number);

-- Backfill real quiz results. quiz_results already preserves every submitted
-- attempt; attempt_number is derived from its stable row ordering.
INSERT INTO student_assessment_events (
  student_id, course_id, lesson_id, topic_id, assessment_type, assessment_id,
  source_record_id, score, maximum_score, percentage_score, attempt_number,
  completion_status, submitted_at
)
SELECT qr.student_id, c.id, l.id, topic.topic_id, 'quiz', q.id,
       qr.id, GREATEST(0, qr.score), q.max_score,
       LEAST(100, GREATEST(0, qr.score::numeric / NULLIF(qr.total_points, 0) * 100)),
       ROW_NUMBER() OVER (PARTITION BY qr.student_id, q.id ORDER BY qr.submitted_at, qr.id)::int,
       'graded', qr.submitted_at
FROM quiz_results qr
JOIN quizzes q ON q.id = qr.quiz_id
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
LEFT JOIN LATERAL (
  SELECT CASE WHEN COUNT(DISTINCT qq.curriculum_objective_id) = 1
              THEN MIN(qq.curriculum_objective_id) END::int AS topic_id
  FROM quiz_questions qq
  WHERE qq.quiz_id = q.id AND qq.curriculum_objective_id IS NOT NULL
) topic ON TRUE
WHERE qr.total_points > 0 AND q.max_score > 0
ON CONFLICT (assessment_type, source_record_id, submitted_at) DO NOTHING;

-- Backfill currently retained graded activity submissions. Older overwritten
-- activity attempts cannot be reconstructed and are intentionally not invented.
INSERT INTO student_assessment_events (
  student_id, course_id, lesson_id, topic_id, assessment_type, assessment_id,
  source_record_id, score, maximum_score, percentage_score, attempt_number,
  completion_status, submitted_at
)
SELECT sub.student_id, c.id, l.id, NULL, 'activity', a.id,
       sub.id, GREATEST(0, sub.score), a.max_score,
       LEAST(100, GREATEST(0, sub.score::numeric / NULLIF(a.max_score, 0) * 100)),
       1, 'graded', sub.submitted_at
FROM activity_submissions sub
JOIN activities a ON a.id = sub.activity_id
JOIN lessons l ON l.id = a.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE sub.status = 'graded' AND sub.score IS NOT NULL
  AND a.max_score > 0 AND sub.submitted_at IS NOT NULL
ON CONFLICT (assessment_type, source_record_id, submitted_at) DO NOTHING;

CREATE OR REPLACE FUNCTION capture_quiz_assessment_event()
RETURNS TRIGGER AS $$
DECLARE
  lesson_record RECORD;
  objective_id INT;
  attempt_no INT;
BEGIN
  IF NEW.total_points IS NULL OR NEW.total_points <= 0 OR NEW.submitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.id AS lesson_id, c.id AS course_id, q.id AS quiz_id, q.max_score
    INTO lesson_record
  FROM quizzes q
  JOIN lessons l ON l.id = q.lesson_id
  JOIN courses c ON c.id = l.course_id
  WHERE q.id = NEW.quiz_id;
  IF NOT FOUND OR lesson_record.max_score IS NULL OR lesson_record.max_score <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN COUNT(DISTINCT qq.curriculum_objective_id) = 1
              THEN MIN(qq.curriculum_objective_id) END::int
    INTO objective_id
  FROM quiz_questions qq
  WHERE qq.quiz_id = NEW.quiz_id AND qq.curriculum_objective_id IS NOT NULL;

  SELECT COUNT(*)::int + 1 INTO attempt_no
  FROM student_assessment_events
  WHERE student_id = NEW.student_id AND assessment_type = 'quiz'
    AND assessment_id = NEW.quiz_id;

  INSERT INTO student_assessment_events (
    student_id, course_id, lesson_id, topic_id, assessment_type, assessment_id,
    source_record_id, score, maximum_score, percentage_score, attempt_number,
    completion_status, submitted_at
  ) VALUES (
    NEW.student_id, lesson_record.course_id, lesson_record.lesson_id, objective_id,
    'quiz', NEW.quiz_id, NEW.id, GREATEST(0, NEW.score), lesson_record.max_score,
    LEAST(100, GREATEST(0, NEW.score::numeric / NULLIF(NEW.total_points, 0) * 100)),
    attempt_no, 'graded', NEW.submitted_at
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

  SELECT l.id AS lesson_id, c.id AS course_id, a.id AS activity_id, a.max_score
    INTO lesson_record
  FROM activities a
  JOIN lessons l ON l.id = a.lesson_id
  JOIN courses c ON c.id = l.course_id
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
    completion_status, submitted_at
  ) VALUES (
    NEW.student_id, lesson_record.course_id, lesson_record.lesson_id, NULL,
    'activity', NEW.activity_id, NEW.id, GREATEST(0, NEW.score), lesson_record.max_score,
    LEAST(100, GREATEST(0, NEW.score::numeric / NULLIF(lesson_record.max_score, 0) * 100)),
    attempt_no, 'graded', NEW.submitted_at
  ) ON CONFLICT (assessment_type, source_record_id, submitted_at) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_capture_quiz_assessment_event ON quiz_results;
CREATE TRIGGER trg_capture_quiz_assessment_event
AFTER INSERT ON quiz_results
FOR EACH ROW EXECUTE FUNCTION capture_quiz_assessment_event();

DROP TRIGGER IF EXISTS trg_capture_activity_assessment_event ON activity_submissions;
CREATE TRIGGER trg_capture_activity_assessment_event
AFTER INSERT OR UPDATE OF status, score, submitted_at ON activity_submissions
FOR EACH ROW EXECUTE FUNCTION capture_activity_assessment_event();
