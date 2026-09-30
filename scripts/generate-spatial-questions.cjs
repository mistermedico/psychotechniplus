#!/usr/bin/env node
'use strict';

/**
 * Generates the spatial question set, validates it, verifies every answer
 * independently, and optionally imports it.
 *
 *   npm run generate:spatial -- --out spatial.json            # generate + check only
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run generate:spatial -- --import
 *
 * Options: --seed <n> (default 20260930), --out <file>, --import
 * Nothing is written to the DB unless both checks pass; the import goes through
 * question-import-guard (skips deleted/existing ids, checks duplicates against the live bank).
 */

const fs = require('fs');
const path = require('path');
const { generateSpatialQuestions } = require('./lib/spatial-question-generator.cjs');
const { validateBank, formatReport } = require('./lib/question-bank-validator.cjs');
const { verifyAll } = require('./verify-spatial-questions.cjs');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

(async () => {
  const seed = Number(arg('--seed', 20260930));
  const rows = generateSpatialQuestions({ seed });
  console.log(`נוצרו ${rows.length} שאלות (seed ${seed})`);

  const report = validateBank(rows);
  console.log(formatReport(report));
  const verification = verifyAll(rows);
  verification.failures.forEach(f => console.log(`✗ ${f.id}: ${f.error}`));
  console.log('אימות תשובות בלתי תלוי:', verification.ok ? 'עבר' : 'נכשל', verification.kinds);
  if (!report.ok || !verification.ok) process.exit(1);

  const out = arg('--out');
  if (out) {
    fs.writeFileSync(path.resolve(out), JSON.stringify(rows, null, 1));
    console.log(`נשמר: ${out}`);
  }

  if (arg('--import', false)) {
    const { createClient } = require('@supabase/supabase-js');
    const { guardQuestionImport } = require('./lib/question-import-guard.cjs');
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'supabase.ts'), 'utf8');
    const url = process.env.SUPABASE_URL || src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for --import');
    const supabase = createClient(url, key);
    const safe = await guardQuestionImport(supabase, rows);
    if (!safe.length) return console.log('אין שאלות חדשות לייבוא');
    const { error } = await supabase.from('questions').upsert(safe);
    if (error) throw new Error(error.message);
    console.log(`יובאו ${safe.length} שאלות`);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
