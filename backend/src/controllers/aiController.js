const { query } = require('../config/db');
const { getStudentIdForUser, getParentIdForUser } = require('../utils/roleHelpers');
const { getOrCreateRecommendation } = require('../services/childLessonRecommendationService');

async function assertCanViewStudent(req, res, studentId) {
  if (req.user.role === 'admin' || req.user.role === 'instructor') return true;
  if (req.user.role === 'student') {
    const ownId = await getStudentIdForUser(req.user.id);
    if (String(ownId) === String(studentId)) return true;
  }
  if (req.user.role === 'parent') {
    const parentId = await getParentIdForUser(req.user.id);
    const owns = await query('SELECT 1 FROM students WHERE id = $1 AND parent_id = $2', [studentId, parentId]);
    if (owns.rows.length > 0) return true;
  }
  res.status(403).json({ error: 'You do not have permission to view this student' });
  return false;
}

// Reuses the child dashboard's cached, lesson-linked recommendation logic.
async function generateRecommendations(req, res, next) {
  try {
    const { studentId } = req.params;
    if (!/^\d+$/.test(String(studentId))) return res.status(400).json({ error: 'Student ID must be a number' });
    if (!(await assertCanViewStudent(req, res, studentId))) return;

    const studentResult = await query(
      'SELECT id, grade_level_id FROM students WHERE id = $1 AND is_active = TRUE',
      [studentId]
    );
    if (!studentResult.rows.length) return res.status(404).json({ error: 'Student not found' });

    const recommendation = await getOrCreateRecommendation(studentResult.rows[0]);
    res.status(201).json({ recommendations: recommendation ? [recommendation] : [] });
  } catch (err) {
    next(err);
  }
}

async function listRecommendations(req, res, next) {
  try {
    const { studentId } = req.params;
    if (!/^\d+$/.test(String(studentId))) return res.status(400).json({ error: 'Student ID must be a number' });
    if (!(await assertCanViewStudent(req, res, studentId))) return;

    const result = await query(
      `SELECT r.*, l.title AS lesson_title, l.estimated_duration_minutes,
              c.title AS course_title, s.name AS subject_name,
              gl.name AS grade_level_name
       FROM ai_recommendations r
       LEFT JOIN lessons l ON l.id = r.lesson_id
       LEFT JOIN courses c ON c.id = l.course_id
       LEFT JOIN subjects s ON s.id = c.subject_id
       LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
       WHERE r.student_id = $1
       ORDER BY r.generated_at DESC LIMIT 20`,
      [studentId]
    );
    res.json({ recommendations: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { generateRecommendations, listRecommendations };
