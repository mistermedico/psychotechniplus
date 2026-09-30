'use strict';

/**
 * Guard that every question import/seed script must call before writing to
 * the `questions` table.
 *
 *   const { guardQuestionImport } = require('./lib/question-import-guard.cjs');
 *   const safeRows = await guardQuestionImport(supabase, rows);
 *   // ...upsert safeRows
 *
 * It:
 *  1. drops rows whose id is listed in admin_state.deleted_question_ids, so
 *     deleted questions are never re-seeded;
 *  2. by default drops rows that already exist in the DB, so a re-seed from
 *     source files cannot overwrite fixes made directly in the DB
 *     (set FORCE_OVERWRITE_QUESTIONS=1 to overwrite on purpose);
 *  3. validates the remaining rows (and checks duplicates against the live
 *     bank) and throws if anything fails. Set ALLOW_INVALID_QUESTIONS=1 only
 *     for imports that land as `pending`, never for `validated`.
 */

const { validateBank, formatReport } = require('./question-bank-validator.cjs');

async function fetchAll(supabase, table, columns, filter) {
  const pageSize = 1000;
  const out = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

async function guardQuestionImport(supabase, rows, { log = console.log } = {}) {
  const force = process.env.FORCE_OVERWRITE_QUESTIONS === '1';
  const allowInvalid = process.env.ALLOW_INVALID_QUESTIONS === '1';

  const { data: deletedState } = await supabase
    .from('admin_state')
    .select('value')
    .eq('key', 'deleted_question_ids')
    .maybeSingle();
  const deleted = new Set(Array.isArray(deletedState?.value) ? deletedState.value : []);

  const existing = await fetchAll(supabase, 'questions', 'id, question_text, media_url, validation_status');
  const existingIds = new Set(existing.map(r => r.id));

  let candidates = rows.filter(r => !deleted.has(r.id));
  const skippedDeleted = rows.length - candidates.length;

  let skippedExisting = 0;
  if (!force) {
    const before = candidates.length;
    candidates = candidates.filter(r => !existingIds.has(r.id));
    skippedExisting = before - candidates.length;
  }

  const liveBank = existing.filter(r => r.validation_status === 'validated');
  const report = validateBank(candidates, { existing: liveBank });

  log(`[question-guard] ${rows.length} rows in, ${skippedDeleted} deleted-id skipped, ${skippedExisting} existing skipped${force ? ' (force overwrite on)' : ''}, ${candidates.length} to write`);
  if (!report.ok) {
    log(formatReport(report));
    const validatedWithErrors = candidates.filter(r => {
      const status = r.validation_status ?? r.validationStatus;
      return status === 'validated' && report.results.get(String(r.id))?.errors.length;
    });
    if (!allowInvalid || validatedWithErrors.length) {
      throw new Error(`[question-guard] import blocked: ${report.errorCount} validation errors. Fix the questions or import them as pending.`);
    }
  }
  return candidates;
}

module.exports = { guardQuestionImport };
