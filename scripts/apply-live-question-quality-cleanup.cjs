const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config');
  return { url, key };
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function fetchRows(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('questions')
      .select('id,topic_id,question_text,options,correct_answer,explanation,validation_status,smart_practice_eligible,general_practice_eligible')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function correctOption(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  return options.find(option => option?.isCorrect === true)
    ?? options.find(option => option?.id === question.correct_answer)
    ?? null;
}

function correctLabel(question) {
  const option = correctOption(question);
  const text = clean(option?.text);
  return text || clean(option?.id || question.correct_answer);
}

function polishExplanation(question) {
  const label = correctLabel(question);
  let explanation = clean(question.explanation)
    .replace(/\s*לכן התשובה הנכונה היא "[^"]+", כי היא היחידה שתואמת את הכלל או החישוב שהוצג בשאלה\.?$/u, '')
    .replace(/\s*כי היא היחידה שתואמת את הכלל או החישוב שהוצג בשאלה\.?$/u, '')
    .replace(/התשובה הנוכונה/g, 'התשובה הנכונה')
    .replace(/התשובה הנכונה היא אפשרות\s+([0-9a-dA-Dא-ת]+)/g, 'התשובה הנכונה היא אפשרות $1');

  if (!explanation) {
    explanation = `התשובה הנכונה היא ${label}.`;
  }

  if (label && !explanation.includes(label)) {
    explanation = `${explanation} לכן התשובה היא ${label}.`;
  }

  return explanation;
}

function hasGenericExplanation(question) {
  const explanation = clean(question.explanation);
  return explanation.includes('היחידה שתואמת את הכלל או החישוב שהוצג בשאלה')
    || explanation.includes('התשובה הנוכונה')
    || explanation.includes('לא מופיע')
    || explanation.includes('לא מופיעה')
    || explanation.includes('טעות בחישוב');
}

function shouldDisableKnownBroken(question) {
  if (/^q_exp_logic_series_00[1-8]$/.test(question.id)) return true;
  if (question.id === 'q_exp_logic_series_010') return true;
  return false;
}

async function main() {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const rows = await fetchRows(supabase);
  const changes = [];

  const validatedByText = new Map();
  for (const question of rows) {
    if (question.validation_status !== 'validated') continue;
    const textKey = clean(question.question_text).toLowerCase();
    if (!textKey) continue;
    if (!validatedByText.has(textKey)) validatedByText.set(textKey, []);
    validatedByText.get(textKey).push(question);
  }

  const duplicateDisableIds = new Set();
  for (const group of validatedByText.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const duplicate of sorted.slice(1)) duplicateDisableIds.add(duplicate.id);
  }

  for (const question of rows) {
    const update = {};
    const reasons = [];

    if (question.validation_status === 'validated' && (duplicateDisableIds.has(question.id) || shouldDisableKnownBroken(question))) {
      update.validation_status = 'draft';
      update.smart_practice_eligible = false;
      update.general_practice_eligible = false;
      reasons.push(duplicateDisableIds.has(question.id) ? 'duplicate_validated_question' : 'broken_series_missing_correct_option');
    }

    if (question.validation_status === 'validated' && hasGenericExplanation(question) && !shouldDisableKnownBroken(question) && !duplicateDisableIds.has(question.id)) {
      const nextExplanation = polishExplanation(question);
      if (nextExplanation !== clean(question.explanation)) {
        update.explanation = nextExplanation;
        reasons.push('polished_generic_explanation');
      }
    }

    if (Object.keys(update).length === 0) continue;

    const { error } = await supabase.from('questions').update(update).eq('id', question.id);
    if (error) throw error;
    changes.push({ id: question.id, topic: question.topic_id, reasons, update });
  }

  const report = {
    appliedAt: new Date().toISOString(),
    totalRows: rows.length,
    changesCount: changes.length,
    disabledCount: changes.filter(change => change.update.validation_status === 'draft').length,
    explanationUpdatesCount: changes.filter(change => change.update.explanation).length,
    changes,
  };

  fs.writeFileSync('outputs/live-question-quality-cleanup-report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
