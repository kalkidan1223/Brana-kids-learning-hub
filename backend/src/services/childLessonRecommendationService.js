const { query } = require('../config/db');
const { getLessonAccess } = require('../utils/learningAccess');

const configuredStruggleThreshold = Number(process.env.ML_STRUGGLE_THRESHOLD || 0.60);
const WEAK_SCORE = Number.isFinite(configuredStruggleThreshold) && configuredStruggleThreshold > 0 && configuredStruggleThreshold < 1
  ? configuredStruggleThreshold
  : 0.60;
const CHALLENGE_SCORE = 0.85;
let cachedModelStatus = null;
let modelStatusCheckedAt = 0;

async function availableModelVersion() {
  const baseUrl = process.env.ML_SERVICE_URL;
  const token = process.env.ML_SERVICE_TOKEN;
  if (!baseUrl || !token) return null;
  if (cachedModelStatus && Date.now() - modelStatusCheckedAt < 60_000) {
    return cachedModelStatus.model_available ? cachedModelStatus.model_version : null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/internal/status`, {
      headers: { 'X-Internal-Token': token },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`ML service returned ${response.status}`);
    cachedModelStatus = await response.json();
    modelStatusCheckedAt = Date.now();
    return cachedModelStatus.model_available ? cachedModelStatus.model_version : null;
  } catch (error) {
    cachedModelStatus = { model_available: false, model_version: null };
    modelStatusCheckedAt = Date.now();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function latestLearningAt(studentId) {
  const result = await query(
    `SELECT NULLIF(GREATEST(
       COALESCE((SELECT MAX(submitted_at) FROM quiz_results WHERE student_id = $1), '-infinity'::timestamptz),
       COALESCE((SELECT MAX(submitted_at) FROM activity_submissions WHERE student_id = $1 AND status = 'graded'), '-infinity'::timestamptz),
       COALESCE((SELECT MAX(updated_at) FROM progress WHERE student_id = $1), '-infinity'::timestamptz),
       COALESCE((SELECT MAX(updated_at) FROM student_lesson_progress WHERE student_id = $1), '-infinity'::timestamptz)
     ), '-infinity'::timestamptz) AS latest_at`,
    [studentId]
  );
  return result.rows[0]?.latest_at || null;
}

async function courseJourney(studentId, gradeLevelId) {
  const result = await query(
    `SELECT c.id AS course_id, c.title AS course_title, c.created_at,
            COUNT(l.id)::int AS total_lessons,
            COUNT(l.id) FILTER (
              WHERE slp.status = 'completed' OR p.status::text = 'completed'
            )::int AS completed_lessons,
            COUNT(l.id) FILTER (
              WHERE slp.status = 'in_progress' OR p.status::text = 'in_progress'
            )::int AS in_progress_lessons,
            MAX(GREATEST(
              COALESCE(slp.last_accessed_at, '-infinity'::timestamptz),
              COALESCE(p.last_accessed_at, '-infinity'::timestamptz)
            )) AS last_activity_at
     FROM courses c
     JOIN lessons l ON l.course_id = c.id AND l.status = 'active'
     LEFT JOIN student_lesson_progress slp
       ON slp.student_id = $1 AND slp.lesson_id = l.id
     LEFT JOIN progress p
       ON p.student_id = $1 AND p.lesson_id = l.id
     WHERE c.grade_level_id = $2 AND c.status = 'published'
     GROUP BY c.id, c.title, c.created_at
     HAVING COUNT(l.id) > 0
     ORDER BY c.created_at ASC, c.id ASC`,
    [studentId, gradeLevelId]
  );
  return result.rows;
}

async function subjectPerformance(studentId, gradeLevelId) {
  const result = await query(
    `SELECT c.subject_id, s.name AS subject_name, s.code AS subject_code,
            gl.code AS grade_code,
            AVG(e.percentage_score / 100.0)::float AS average_score,
            COUNT(*)::int AS result_count,
            (ARRAY_AGG(e.percentage_score / 100.0 ORDER BY e.submitted_at ASC, e.id ASC))[1]::float AS first_score,
            (ARRAY_AGG(e.percentage_score / 100.0 ORDER BY e.submitted_at DESC, e.id DESC))[1]::float AS latest_score
     FROM student_assessment_events e
     JOIN courses c ON c.id = e.course_id
     JOIN subjects s ON s.id = c.subject_id
     JOIN grade_levels gl ON gl.id = c.grade_level_id
     WHERE e.student_id = $1 AND e.completion_status = 'graded'
       AND c.status = 'published' AND c.grade_level_id = $2
     GROUP BY c.subject_id, s.name, s.code, gl.code
     ORDER BY AVG(e.percentage_score / 100.0) ASC, COUNT(*) DESC`,
    [studentId, gradeLevelId]
  );
  return result.rows;
}

async function listLessonCandidates(studentId, gradeLevelId, subjectId = null, allowCompleted = false, courseId = null) {
  const result = await query(
    `SELECT l.id AS lesson_id, l.title, l.description, l.estimated_duration_minutes,
            l.order_index, l.learning_objectives,
            c.id AS course_id, c.title AS course_title,
            COALESCE(l.thumbnail_url, c.thumbnail_url) AS thumbnail_url,
            s.id AS subject_id, s.name AS subject_name,
            s.code AS subject_code, gl.name AS grade_level_name,
            gl.lesson_builder_type,
            COALESCE(slp.status, p.status::text, 'not_started') AS learning_status,
            COALESCE(slp.progress_percentage, p.completion_percentage, 0)::int AS progress_percentage
     FROM lessons l
     JOIN courses c ON c.id = l.course_id
     JOIN grade_levels gl ON gl.id = c.grade_level_id
     LEFT JOIN subjects s ON s.id = c.subject_id
     LEFT JOIN progress p ON p.student_id = $1 AND p.lesson_id = l.id
     LEFT JOIN student_lesson_progress slp ON slp.student_id = $1 AND slp.lesson_id = l.id
     WHERE c.grade_level_id = $2 AND c.status = 'published' AND l.status = 'active'
       AND ($3::bigint IS NULL OR c.subject_id = $3)
       AND ($5::bigint IS NULL OR c.id = $5)
       AND ($4::boolean OR COALESCE(slp.status, p.status::text, 'not_started') <> 'completed')
     ORDER BY CASE COALESCE(slp.status, p.status::text, 'not_started')
                WHEN 'in_progress' THEN 0 WHEN 'not_started' THEN 1 ELSE 2 END,
              c.created_at DESC, l.order_index ASC, l.created_at ASC`,
    [studentId, gradeLevelId, subjectId, allowCompleted, courseId]
  );

  const eligible = [];
  for (const lesson of result.rows) {
    const access = await getLessonAccess(studentId, lesson.lesson_id);
    if (access.exists && !access.isLocked) eligible.push(lesson);
  }
  return eligible;
}

async function rankWithMlService(student, performance, lessons) {
  if (!performance.length || !lessons.length) return { fallbackReason: 'insufficient_data' };
  const baseUrl = process.env.ML_SERVICE_URL;
  const token = process.env.ML_SERVICE_TOKEN;
  if (!baseUrl || !token) return { fallbackReason: 'rule_fallback' };

  let gradeCode;
  try {
    const gradeResult = await query('SELECT code FROM grade_levels WHERE id = $1', [student.grade_level_id]);
    gradeCode = gradeResult.rows[0]?.code;
  } catch (error) {
    console.warn(`Could not prepare ML features; using rule fallback: ${error.message}`);
    return { fallbackReason: 'rule_fallback' };
  }
  if (!gradeCode) return null;

  const payload = {
    performance_history: performance.map(subject => ({
      subject_code: subject.subject_code,
      subject_name: subject.subject_name,
      grade_code: subject.grade_code || gradeCode,
      prior_average_score: Number(subject.average_score),
      prior_latest_score: Number(subject.latest_score),
      prior_score_trend: Number(subject.latest_score) - Number(subject.first_score),
      prior_attempt_count: Number(subject.result_count),
    })),
    eligible_lessons: lessons.map(lesson => ({
      lesson_id: Number(lesson.lesson_id),
      course_id: Number(lesson.course_id),
      title: lesson.title,
      description: lesson.description || '',
      subject_code: lesson.subject_code || '',
      subject_name: lesson.subject_name || '',
      grade_code: gradeCode,
      objectives: lesson.learning_objectives ? [lesson.learning_objectives] : [],
    })),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/predict-and-recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`ML service returned ${response.status}`);
      const result = await response.json();
      if (!result.model_available || !result.model_version || !Array.isArray(result.ranked_lessons)) {
        return { fallbackReason: 'insufficient_data' };
      }
      const candidateById = new Map(lessons.map(lesson => [String(lesson.lesson_id), lesson]));
      for (const ranked of result.ranked_lessons) {
        const lesson = candidateById.get(String(ranked.lesson_id));
        const score = Number(ranked.recommendation_score);
        if (!lesson || !Number.isFinite(score) || score < 0 || score > 1) continue;
        return {
          lesson,
          score,
          type: ranked.recommendation_type === 'revision' ? 'revision' : 'lesson',
          modelVersion: result.model_version,
        };
      }
      return { fallbackReason: 'insufficient_data' };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn(`ML recommender unavailable; using rule fallback: ${error.message}`);
    return { fallbackReason: 'rule_fallback' };
  }
}

async function loadRecommendation(recommendationId) {
  const result = await query(
    `SELECT r.id, r.student_id, r.lesson_id, r.recommendation_type,
            r.recommendation_basis, r.reason, r.status, r.generated_at,
            r.recommendation_source, r.model_version, r.recommendation_score,
            l.title, l.description, l.estimated_duration_minutes,
            l.order_index, c.title AS course_title,
            COALESCE(l.thumbnail_url, c.thumbnail_url) AS thumbnail_url,
            s.name AS subject_name, s.code AS subject_code,
            gl.name AS grade_level_name, gl.lesson_builder_type,
            COALESCE(slp.progress_percentage, p.completion_percentage, 0)::int AS progress_percentage
     FROM ai_recommendations r
     JOIN lessons l ON l.id = r.lesson_id
     JOIN courses c ON c.id = l.course_id
     JOIN grade_levels gl ON gl.id = c.grade_level_id
     LEFT JOIN subjects s ON s.id = c.subject_id
     LEFT JOIN progress p ON p.student_id = r.student_id AND p.lesson_id = l.id
     LEFT JOIN student_lesson_progress slp ON slp.student_id = r.student_id AND slp.lesson_id = l.id
     WHERE r.id = $1`,
    [recommendationId]
  );
  return result.rows[0] || null;
}

function recommendationReason(basis, subjectName, previousCourseTitle) {
  if (basis === 'next_course') {
    return previousCourseTitle
      ? `You finished ${previousCourseTitle}! Now let's explore this next course together.`
      : "You've finished a course! Here's your next learning adventure.";
  }
  if (basis === 'weak_area') return `Let's keep building your ${subjectName} skills. This lesson gives you another chance to practice.`;
  if (basis === 'challenge') return `You're doing well in ${subjectName}. Try this next lesson and see what you can learn!`;
  if (basis === 'progress') return "You're making progress. Continue with this lesson to keep moving forward.";
  return "Here's a good first step for your learning journey.";
}

async function getOrCreateRecommendation(student) {
  const latestAt = await latestLearningAt(student.id);
  const journey = await courseJourney(student.id, student.grade_level_id);
  const completedCourses = journey.filter(course => course.total_lessons > 0 && course.completed_lessons >= course.total_lessons);
  const inProgressCourses = journey
    .filter(course => course.completed_lessons < course.total_lessons &&
      (course.in_progress_lessons > 0 || course.completed_lessons > 0))
    .sort((a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0));
  const untouchedCourses = journey.filter(course =>
    course.completed_lessons === 0 && course.in_progress_lessons === 0
  );
  const primaryPathCourse = inProgressCourses[0] || untouchedCourses[0] || null;
  const currentResult = await query(
    `SELECT r.id, r.lesson_id, r.recommendation_basis, r.generated_at,
            r.recommendation_source, r.model_version, l.course_id
     FROM ai_recommendations r
     JOIN lessons l ON l.id = r.lesson_id
     WHERE r.student_id = $1 AND r.lesson_id IS NOT NULL AND r.status IN ('pending', 'started')
     ORDER BY r.generated_at DESC LIMIT 1`,
    [student.id]
  );

  if (currentResult.rows.length) {
    const current = currentResult.rows[0];
    const completed = await query(
      `SELECT EXISTS (
         SELECT 1 FROM progress WHERE student_id = $1 AND lesson_id = $2 AND status = 'completed'
         UNION ALL
         SELECT 1 FROM student_lesson_progress WHERE student_id = $1 AND lesson_id = $2 AND status = 'completed'
       ) AS completed`,
      [student.id, current.lesson_id]
    );
    const hasNewLearning = latestAt && new Date(latestAt) > new Date(current.generated_at);
    const access = await getLessonAccess(student.id, current.lesson_id);
    const stillOnCoursePath = !primaryPathCourse || String(current.course_id) === String(primaryPathCourse.course_id);
    if (!completed.rows[0]?.completed && !hasNewLearning && stillOnCoursePath && access.exists && !access.isLocked) {
      const modelVersion = await availableModelVersion();
      const modelNeedsRefresh = modelVersion && modelVersion !== current.model_version;
      if (!modelNeedsRefresh) return loadRecommendation(current.id);
    }
    await query(
      `UPDATE ai_recommendations SET status = $1 WHERE id = $2`,
      [completed.rows[0]?.completed ? 'completed' : access.exists ? 'replaced' : 'unavailable', current.id]
    );
  }

  let candidateLessons = [];
  let basis = 'starter';
  let type = 'lesson';
  let recommendationSource = 'rule_fallback';
  let modelVersion = null;
  let recommendationScore = null;
  let previousCourseTitle = null;

  // Continue a course the student has already started. Once it is complete,
  // move to the earliest available course the student has not started yet.
  const activeCourse = inProgressCourses[0];
  if (activeCourse) {
    candidateLessons = await listLessonCandidates(student.id, student.grade_level_id, null, false, activeCourse.course_id);
    if (candidateLessons.length) basis = 'progress';
  }

  if (!candidateLessons.length && untouchedCourses.length) {
    const nextCourse = untouchedCourses[0];
    candidateLessons = await listLessonCandidates(student.id, student.grade_level_id, null, false, nextCourse.course_id);
    if (candidateLessons.length) {
      basis = completedCourses.length ? 'next_course' : 'starter';
      previousCourseTitle = [...completedCourses]
        .sort((a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0))[0]?.course_title || null;
    }
  }

  // If a course has no accessible lesson, skip it and find the next accessible
  // course in curriculum order. This still respects grade access and locks.
  if (!candidateLessons.length) {
    for (const course of [...inProgressCourses, ...untouchedCourses.slice(1)]) {
      candidateLessons = await listLessonCandidates(student.id, student.grade_level_id, null, false, course.course_id);
      if (candidateLessons.length) {
        basis = completedCourses.length ? 'next_course' : latestAt ? 'progress' : 'starter';
        previousCourseTitle = [...completedCourses]
          .sort((a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0))[0]?.course_title || null;
        break;
      }
    }
  }

  const performance = await subjectPerformance(student.id, student.grade_level_id);
  const weakest = performance.find(subject => subject.average_score < WEAK_SCORE);

  // Keep the course path as the eligibility rule, while allowing existing
  // assessment history to prioritize practice within that eligible path.
  if (candidateLessons.length && weakest) {
    const weakPathLesson = candidateLessons.find(lesson =>
      String(lesson.subject_id) === String(weakest.subject_id)
    );
    if (weakPathLesson) {
      candidateLessons = [weakPathLesson, ...candidateLessons.filter(lesson => lesson !== weakPathLesson)];
      basis = 'weak_area';
      type = 'revision';
    }
  }

  // If no next lesson is currently available, prior results can still point
  // to a real revision lesson from an accessible course.
  if (!candidateLessons.length) {
    if (weakest) {
      candidateLessons = await listLessonCandidates(student.id, student.grade_level_id, weakest.subject_id, true);
      if (candidateLessons.length) {
        basis = 'weak_area';
        type = 'revision';
      }
    }
  }

  if (!candidateLessons.length) return null;

  const mlRecommendation = await rankWithMlService(student, performance, candidateLessons);
  const lesson = mlRecommendation?.lesson || candidateLessons[0];
  if (mlRecommendation?.lesson) {
    recommendationSource = 'sklearn_model';
    modelVersion = mlRecommendation.modelVersion;
    recommendationScore = mlRecommendation.score;
    if (mlRecommendation.type === 'revision') {
      basis = 'weak_area';
      type = 'revision';
    }
  } else if (mlRecommendation?.fallbackReason === 'insufficient_data') {
    recommendationSource = 'insufficient_data';
  }

  const reason = recommendationSource === 'sklearn_model'
    ? (type === 'revision'
      ? `Your learning results suggest more practice with ${lesson.subject_name || 'this subject'} could help.`
      : recommendationReason(basis, lesson.subject_name || 'your', previousCourseTitle))
    : recommendationReason(basis, lesson.subject_name || 'your', previousCourseTitle);
  const saved = await query(
    `INSERT INTO ai_recommendations
       (student_id, recommendation_type, recommended_item_id, lesson_id, reason,
        confidence_score, recommendation_basis, recommendation_source,
        model_version, recommendation_score, status, is_viewed, generated_at)
     VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, 'pending', FALSE, now())
     ON CONFLICT (student_id)
       WHERE lesson_id IS NOT NULL AND status IN ('pending', 'started')
     DO UPDATE SET recommendation_type = EXCLUDED.recommendation_type,
                   recommended_item_id = EXCLUDED.recommended_item_id,
                   lesson_id = EXCLUDED.lesson_id,
                   reason = EXCLUDED.reason,
                   confidence_score = EXCLUDED.confidence_score,
                   recommendation_basis = EXCLUDED.recommendation_basis,
                   recommendation_source = EXCLUDED.recommendation_source,
                   model_version = EXCLUDED.model_version,
                   recommendation_score = EXCLUDED.recommendation_score,
                   status = 'pending', is_viewed = FALSE, generated_at = now()
     RETURNING id`,
    [
      student.id, type, lesson.lesson_id, reason,
      recommendationSource === 'sklearn_model' ? recommendationScore : basis === 'starter' ? 0.5 : 0.75,
      basis, recommendationSource, modelVersion, recommendationScore,
    ]
  );
  return loadRecommendation(saved.rows[0].id);
}

async function startRecommendation(student, recommendationId) {
  const result = await query(
    `SELECT id, lesson_id FROM ai_recommendations
     WHERE id = $1 AND student_id = $2 AND status IN ('pending', 'started')`,
    [recommendationId, student.id]
  );
  if (!result.rows.length) return { unavailable: true };

  const recommendation = result.rows[0];
  const access = await getLessonAccess(student.id, recommendation.lesson_id);
  if (!access.exists || access.isLocked) {
    await query(`UPDATE ai_recommendations SET status = 'unavailable' WHERE id = $1`, [recommendation.id]);
    return { unavailable: true, locked: access.exists && access.isLocked };
  }

  await query(
    `UPDATE ai_recommendations SET status = 'started', is_viewed = TRUE WHERE id = $1 AND student_id = $2`,
    [recommendation.id, student.id]
  );
  return { lesson_id: recommendation.lesson_id };
}

module.exports = { getOrCreateRecommendation, startRecommendation };
