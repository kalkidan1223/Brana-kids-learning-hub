// Export only assessment events needed for grouped, time-aware model training.
// student_id is included solely as a grouping key and is never a model feature.
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const outputPath = path.resolve(
  process.env.ML_TRAINING_EXPORT_PATH || path.join(__dirname, 'data', 'training_events.csv')
);

function csvValue(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

(async () => {
  try {
    const result = await pool.query(`
      SELECT event.student_id,
             COALESCE(event.grade_code_snapshot, gl.code) AS grade_code,
             COALESCE(event.subject_code_snapshot, s.code) AS subject_code,
             event.course_id, event.lesson_id, event.topic_id,
             event.assessment_type, event.assessment_id,
             event.score, event.maximum_score, event.percentage_score / 100.0 AS assessment_score,
             event.attempt_number, event.completion_status,
             event.submitted_at AS assessed_at, event.time_spent_seconds
      FROM student_assessment_events event
      LEFT JOIN courses c ON c.id = event.course_id
      LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
      LEFT JOIN subjects s ON s.id = c.subject_id
      WHERE event.completion_status = 'graded'
        AND event.maximum_score > 0
        AND event.percentage_score BETWEEN 0 AND 100
        AND COALESCE(event.subject_code_snapshot, s.code) IS NOT NULL
        AND COALESCE(event.grade_code_snapshot, gl.code) IS NOT NULL
      ORDER BY event.student_id, subject_code, event.submitted_at, event.id
    `);

    const header = [
      'student_id', 'grade_code', 'subject_code', 'course_id', 'lesson_id',
      'topic_id', 'assessment_type', 'assessment_id', 'score', 'maximum_score',
      'assessment_score', 'attempt_number', 'completion_status', 'assessed_at',
      'time_spent_seconds',
    ];
    const lines = [header.join(',')];
    for (const row of result.rows) {
      lines.push(header.map(column => csvValue(row[column])).join(','));
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, { encoding: 'utf8' });
    process.stdout.write(`Exported ${result.rowCount} assessment events to ${outputPath}\n`);
  } catch (error) {
    process.stderr.write(`Assessment export failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
