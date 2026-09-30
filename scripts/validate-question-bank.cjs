#!/usr/bin/env node
'use strict';

/**
 * Validates questions before import, or audits the live bank.
 *
 *   npm run validate:questions -- --file path/to/questions.json
 *   npm run validate:questions -- --live            (needs SUPABASE_SERVICE_ROLE_KEY for premium/pending rows)
 *   npm run validate:questions -- --live --status all
 *
 * Exit code 1 when any question has errors (use it in CI or before seeding).
 */

const fs = require('fs');
const path = require('path');
const { validateBank, formatReport } = require('./lib/question-bank-validator.cjs');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true;
}

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'supabase.ts'), 'utf8');
  const url = process.env.SUPABASE_URL || src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  return { url, key, usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY };
}

async function loadLive(status) {
  const { createClient } = require('@supabase/supabase-js');
  const { url, key, usingServiceRole } = readSupabaseConfig();
  if (!usingServiceRole) console.warn('! ללא SUPABASE_SERVICE_ROLE_KEY נבדקות רק שאלות חינמיות מאושרות (RLS).');
  const supabase = createClient(url, key);
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('questions').select('*').range(from, from + 999);
    if (status !== 'all') q = q.eq('validation_status', status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

(async () => {
  const file = arg('--file');
  const live = arg('--live', false);
  const status = arg('--status', 'validated');
  let rows;
  if (file) rows = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  else if (live) rows = await loadLive(status);
  else {
    console.error('שימוש: validate-question-bank --file questions.json | --live [--status validated|pending|all]');
    process.exit(2);
  }
  const report = validateBank(rows);
  console.log(`נבדקו ${rows.length} שאלות\n`);
  console.log(formatReport(report, { showWarnings: !arg('--errors-only', false) }));
  process.exit(report.ok ? 0 : 1);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
