/**
 * Generates a SQL file to seed all questions directly in the Supabase SQL Editor.
 * Run: node scripts/generate-sql-seed.mjs
 * Then paste the output SQL into: https://supabase.com/dashboard/project/kdnkrvltgptiffxkclyg/sql/new
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Read all question IDs already in mockData.ts ──────────────────────────────

const mockDataContent = readFileSync(join(ROOT, 'data/mockData.ts'), 'utf-8');

function getMax(prefix) {
  const re = new RegExp(`id: 'q_${prefix}_(\\d+)'`, 'g');
  let max = 0;
  for (const m of mockDataContent.matchAll(re)) {
    const n = parseInt(m[1]);
    if (n > max) max = n;
  }
  return max;
}

// Collect ALL question IDs from mockData.ts
const allIds = [...mockDataContent.matchAll(/id:\s*'(q_[a-z]+_\d+)'/g)].map(m => m[1]);

// ── Load RAW questions from seed-questions.mjs ────────────────────────────────

// We dynamically import the seed script logic by reading it and extracting RAW
const seedScript = readFileSync(join(__dirname, 'seed-questions.mjs'), 'utf-8');

// Extract just the RAW array definition
const rawStart = seedScript.indexOf('\nconst RAW = [');
const rawEnd = seedScript.indexOf('\n];\n', rawStart) + 4;
const rawBlock = seedScript.slice(rawStart + 1, rawEnd);

// Evaluate in this context
let RAW;
eval(rawBlock);

// ── Helper functions ──────────────────────────────────────────────────────────

function eloFromDifficulty(d) {
  if (d <= 2) return 900 + d * 75;
  if (d <= 4) return 1050 + (d - 2) * 100;
  if (d <= 6) return 1250 + (d - 4) * 65;
  if (d <= 8) return 1380 + (d - 6) * 60;
  return 1500 + (d - 8) * 50;
}

function pad(n) { return String(n).padStart(3, '0'); }

const TOPIC_TO_TARGET = {
  topic_quantitative: 'target_psychometric',
  topic_verbal: 'target_psychometric',
  topic_logic: 'target_psychometric',
  topic_spatial: 'target_psychometric',
};

function esc(s) {
  return (s ?? '').replace(/'/g, "''").replace(/\\/g, '\\');
}

// ── Assign IDs ────────────────────────────────────────────────────────────────

const counters = {
  quant:   getMax('quant'),
  verbal:  getMax('verbal'),
  logic:   getMax('logic'),
  spatial: getMax('spatial'),
};

console.log('Existing max IDs:');
for (const [p, n] of Object.entries(counters)) console.log(`  q_${p}: ${n}`);

const rows = [];
for (const raw of RAW) {
  counters[raw.prefix]++;
  const id = `q_${raw.prefix}_${pad(counters[raw.prefix])}`;
  const targetId = TOPIC_TO_TARGET[raw.topicId] || 'target_psychometric';
  const targetIds = JSON.stringify([targetId]);
  const options = JSON.stringify([
    { id: 'a', text: raw.a, isCorrect: raw.correct === 'a' },
    { id: 'b', text: raw.b, isCorrect: raw.correct === 'b' },
    { id: 'c', text: raw.c, isCorrect: raw.correct === 'c' },
    { id: 'd', text: raw.d, isCorrect: raw.correct === 'd' },
  ]);
  const stats = JSON.stringify({
    elo: eloFromDifficulty(raw.difficulty),
    discrimination: 0.75,
    guessProbability: 0.25,
  });

  rows.push({
    id,
    topic_id: raw.topicId,
    target_ids: targetIds,
    question_type: raw.questionType,
    question_text: raw.text,
    reading_passage: raw.passage || null,
    options,
    correct_answer: raw.correct,
    explanation: raw.explanation,
    difficulty: raw.difficulty,
    psychometric_stats: stats,
  });
}

// Also include the PENDING_SEED question from adminStore (q_pending_001)
// Read from adminStore
const adminStoreContent = readFileSync(join(ROOT, 'store/adminStore.ts'), 'utf-8');
const pendingStart = adminStoreContent.indexOf('const PENDING_SEED: Question[] = [');
const pendingEnd = adminStoreContent.indexOf('\n];\n', pendingStart) + 4;
// We'll just manually add the known pending question
const PENDING = [
  {
    id: 'q_pending_001',
    topic_id: 'topic_quantitative',
    target_ids: JSON.stringify(['target_psychometric']),
    question_type: 'multiple_choice',
    question_text: 'בחנות יש 240 מוצרים. 35% מהם נמכרו. כמה מוצרים נותרו?',
    reading_passage: null,
    options: JSON.stringify([
      { id: 'a', text: '84', isCorrect: false },
      { id: 'b', text: '156', isCorrect: true },
      { id: 'c', text: '144', isCorrect: false },
      { id: 'd', text: '168', isCorrect: false },
    ]),
    correct_answer: 'b',
    explanation: '35% מ-240 = 84 נמכרו. נותרו: 240 - 84 = 156.',
    difficulty: 3,
    psychometric_stats: JSON.stringify({ elo: 1150, discrimination: 0.75, guessProbability: 0.25 }),
  }
];

// ── Generate SQL ──────────────────────────────────────────────────────────────

const allRows = [...rows, ...PENDING];

function rowToSql(r) {
  return `  ('${r.id}', '${r.topic_id}', '${r.target_ids}'::jsonb, '${r.question_type}', ` +
    `E'${esc(r.question_text)}', ` +
    (r.reading_passage ? `E'${esc(r.reading_passage)}'` : 'NULL') + `, ` +
    `'${r.options}'::jsonb, '${r.correct_answer}', E'${esc(r.explanation)}', ` +
    `${r.difficulty}, '${r.psychometric_stats}'::jsonb, ` +
    `'free', 'validated', true, true)`;
}

const sql = `-- ═══════════════════════════════════════════════════════════════════════
-- PsychoTechniPlus — Seed ${allRows.length} Psychotechnic Questions
-- ═══════════════════════════════════════════════════════════════════════
-- HOW TO USE:
--   1. Go to https://supabase.com/dashboard/project/kdnkrvltgptiffxkclyg/sql/new
--   2. Paste this entire file
--   3. Click "Run"
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO questions (
  id, topic_id, target_ids, question_type, question_text, reading_passage,
  options, correct_answer, explanation, difficulty, psychometric_stats,
  access_level, validation_status, smart_practice_eligible, general_practice_eligible
)
VALUES
${allRows.map(rowToSql).join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  question_text       = EXCLUDED.question_text,
  options             = EXCLUDED.options,
  correct_answer      = EXCLUDED.correct_answer,
  explanation         = EXCLUDED.explanation,
  difficulty          = EXCLUDED.difficulty,
  psychometric_stats  = EXCLUDED.psychometric_stats,
  validation_status   = EXCLUDED.validation_status,
  smart_practice_eligible    = EXCLUDED.smart_practice_eligible,
  general_practice_eligible  = EXCLUDED.general_practice_eligible;

-- Verify:
SELECT topic_id, COUNT(*) as count FROM questions GROUP BY topic_id ORDER BY topic_id;
`;

const outPath = join(ROOT, 'scripts/seed-supabase.sql');
writeFileSync(outPath, sql, 'utf-8');
console.log(`\n✅ Generated ${allRows.length} questions → scripts/seed-supabase.sql`);
console.log('\nBreakdown:');
const byTopic = {};
for (const r of allRows) byTopic[r.topic_id] = (byTopic[r.topic_id] ?? 0) + 1;
for (const [t, c] of Object.entries(byTopic)) console.log(`  ${t}: ${c}`);
console.log('\n🔗 Open: https://supabase.com/dashboard/project/kdnkrvltgptiffxkclyg/sql/new');
console.log('   Paste contents of: scripts/seed-supabase.sql');
