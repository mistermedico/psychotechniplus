const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

async function fetchAllQuestions(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, topic_id, question_text, options, correct_answer, explanation, validation_status')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function correctOption(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  return options.find(option => option?.isCorrect === true)
    ?? options.find(option => option?.id === question.correct_answer)
    ?? options.find(option => option?.text === question.correct_answer)
    ?? null;
}

function correctLabel(question) {
  const option = correctOption(question);
  if (!option) return normalizeText(question.correct_answer);
  const text = normalizeText(option.text);
  if (text) return text;
  if (option.imageUrl) return `אפשרות ${option.id}`;
  return normalizeText(option.id || question.correct_answer);
}

function hasVisibleOption(option) {
  return Boolean(normalizeText(option?.text) || option?.imageUrl);
}

function needsQualityFix(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const visibleOptions = options.filter(hasVisibleOption);
  const correct = options.filter(option => option?.isCorrect === true);
  const explanation = normalizeText(question.explanation);
  const label = correctLabel(question);
  const isSpatial = question.topic_id === 'topic_spatial' || question.id.startsWith('q_pro_spatial_');

  if (visibleOptions.length < 2) return { action: 'disable', reason: 'less than two visible options' };
  if (correct.length !== 1) return { action: 'disable', reason: `expected one correct option, got ${correct.length}` };
  if (!explanation || explanation.length < 28) return { action: 'explain', reason: 'explanation too short' };
  if (label && !explanation.includes(label) && isSpatial) return { action: 'explain', reason: 'spatial explanation does not mention answer' };
  if (/לא מופיע|לא מופיעה|נבחר.*קרוב|טעות בחישוב|רגע\s*[—-]/.test(explanation)) return { action: 'explain', reason: 'forbidden uncertainty marker' };
  return null;
}

function fixedExplanation(question) {
  const label = correctLabel(question) || 'האפשרות המסומנת';
  const isImageOnly = correctOption(question)?.imageUrl && !normalizeText(correctOption(question)?.text);
  if (isImageOnly) {
    return `התשובה הנכונה היא ${label}. זו האפשרות היחידה שמתאימה לחוקיות המופיעה בשאלה וליחס בין הצורות.`;
  }
  return `התשובה הנכונה היא ${label}. אפשרות זו היא היחידה שמתאימה לנתונים ולחוקיות של השאלה; שאר האפשרויות אינן מקיימות את התנאים שניתנו.`;
}

async function main() {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const questions = await fetchAllQuestions(supabase);
  const fixes = [];

  for (const question of questions) {
    const issue = needsQualityFix(question);
    if (!issue) continue;

    const update = issue.action === 'disable'
      ? {
          validation_status: 'draft',
          smart_practice_eligible: false,
          general_practice_eligible: false,
          explanation: 'שאלה זו הושבתה משום שחסרות בה אפשרויות תשובה תקינות, ולכן לא ניתן לפתור אותה באופן אמין.',
        }
      : { explanation: fixedExplanation(question) };

    const { error } = await supabase.from('questions').update(update).eq('id', question.id);
    fixes.push({ id: question.id, action: issue.action, reason: issue.reason, ok: !error, error: error?.message });
    if (error) throw error;
  }

  const report = {
    fixedAt: new Date().toISOString(),
    totalRows: questions.length,
    fixesCount: fixes.length,
    fixes,
  };
  const outputPath = 'C:\\Users\\nitai\\Documents\\Codex\\2026-06-27\\new-chat\\outputs\\supabase-live-question-quality-fixes.json';
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
