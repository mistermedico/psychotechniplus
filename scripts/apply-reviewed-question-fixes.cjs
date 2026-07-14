const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REVIEW_WORK_ROOT = 'C:\\Users\\nitai\\Documents\\Codex\\2026-06-27\\new-chat';
const QUESTIONS_PATH = path.join(REVIEW_WORK_ROOT, 'work', 'psychotechnipro-all-questions.json');
const BACKUP_PREFIX = 'psychotechnipro-all-questions.backup-';

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function comparable(q) {
  return JSON.stringify({
    questionText: q.questionText,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    validationStatus: q.validationStatus,
    smartPracticeEligible: q.smartPracticeEligible,
    generalPracticeEligible: q.generalPracticeEligible,
    smartSimulationEligible: q.smartSimulationEligible,
    isActive: q.isActive,
    isDraft: q.isDraft,
  });
}

function findLatestBackup() {
  const workDir = path.dirname(QUESTIONS_PATH);
  const backups = fs.readdirSync(workDir)
    .filter(name => name.startsWith(BACKUP_PREFIX) && name.endsWith('.json'))
    .sort();
  if (backups.length === 0) throw new Error('No backup file found for diffing reviewed questions');
  return path.join(workDir, backups.at(-1));
}

function rowFromQuestion(q) {
  const active = q.isActive !== false && q.validationStatus !== 'draft' && q.isDraft !== true;
  return {
    question_text: q.questionText || '',
    options: q.options || [],
    correct_answer: q.correctAnswer,
    explanation: q.explanation || '',
    validation_status: active ? (q.validationStatus || 'pending') : 'draft',
    smart_practice_eligible: active ? Boolean(q.smartPracticeEligible) : false,
    general_practice_eligible: active ? Boolean(q.generalPracticeEligible) : false,
    difficulty: q.difficulty ?? 3,
    access_level: q.accessLevel ?? 'free',
    psychometric_stats: q.psychometricStats ?? { elo: 1200, discrimination: 0.7, guessProbability: 0.25 },
    media_url: q.mediaUrl || null,
    media_type: q.mediaType || null,
  };
}

async function main() {
  const backupPath = findLatestBackup();
  const before = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const after = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
  const beforeById = new Map(before.map(q => [q.id, comparable(q)]));
  const changed = after.filter(q => beforeById.get(q.id) !== comparable(q));

  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const results = [];

  for (const question of changed) {
    const row = rowFromQuestion(question);
    const { data, error } = await supabase
      .from('questions')
      .update(row)
      .eq('id', question.id)
      .select('id, question_text, correct_answer, validation_status');

    if (error) {
      results.push({ id: question.id, ok: false, error: error.message });
      continue;
    }
    results.push({ id: question.id, ok: true, updatedRows: data?.length ?? 0, validationStatus: row.validation_status });
  }

  const report = {
    updatedAt: new Date().toISOString(),
    backupPath,
    questionsPath: QUESTIONS_PATH,
    changedCount: changed.length,
    updatedCount: results.filter(r => r.ok && r.updatedRows > 0).length,
    notFoundCount: results.filter(r => r.ok && r.updatedRows === 0).length,
    failedCount: results.filter(r => !r.ok).length,
    results,
  };

  fs.writeFileSync(
    path.join(REVIEW_WORK_ROOT, 'outputs', 'supabase-question-fixes-apply-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.failedCount > 0) process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
