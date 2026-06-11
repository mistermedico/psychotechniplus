const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function readSupabaseConfig() {
  const src = fs.readFileSync('lib/supabase.ts', 'utf8');
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
      .select('id,topic_id,question_text,options,correct_answer,explanation')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function hasReasoningMarker(explanation) {
  return /[.=:=→×÷+\-/]|לכן|כי|כלומר|מכיוון|סופרים|מחברים|מחשבים|הקשר|הדפוס|הכלל|מתקבל|נובע|משום/.test(explanation);
}

function hasForbiddenExplanation(explanation) {
  return /לא\s+מופיע|לא\s+מופיעה|נבחר.*קרוב|טעות\s+בחישוב|רגע\s*[—-]/.test(explanation);
}

function auditQuestion(q) {
  const issues = [];
  const options = Array.isArray(q.options) ? q.options : [];
  const correct = options.filter((option) => option && option.isCorrect === true);
  const correctOption = correct[0];
  const correctText = normalizeText(correctOption?.text);
  const explanation = normalizeText(q.explanation);
  const questionText = normalizeText(q.question_text);
  const optionTexts = options.map((option) => normalizeText(option?.text)).filter(Boolean);
  const duplicateTexts = optionTexts.filter((text, index) => optionTexts.indexOf(text) !== index);

  if (!questionText || questionText.length < 8) issues.push('question text too short');
  if (explanation.length < 28) issues.push('explanation too short for review quality');
  if (explanation && !hasReasoningMarker(explanation)) issues.push('explanation lacks visible reasoning marker');
  if (hasForbiddenExplanation(explanation)) issues.push('explanation contains contradiction or uncertainty marker');
  if (options.length < 2) issues.push('less than two options');
  if (correct.length !== 1) issues.push(`expected exactly one correct option, got ${correct.length}`);
  if (correctOption && q.correct_answer !== correctOption.id && q.correct_answer !== correctOption.text) {
    issues.push(`correct_answer "${q.correct_answer}" does not match correct option "${correctOption.id}"`);
  }
  if (duplicateTexts.length > 0) issues.push(`duplicate option text: ${[...new Set(duplicateTexts)].join(', ')}`);
  if (correctText && explanation && !explanation.includes(correctText)) {
    issues.push(`explanation does not mention correct answer "${correctText}"`);
  }

  return issues;
}

(async () => {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const questions = await fetchAllQuestions(supabase);
  const failures = questions
    .map((question) => ({ id: question.id, issues: auditQuestion(question) }))
    .filter((row) => row.issues.length > 0);
  const byTopic = questions.reduce((acc, question) => {
    acc[question.topic_id] = (acc[question.topic_id] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    totalRows: questions.length,
    failures: failures.length,
    byTopic,
    sampleFailures: failures.slice(0, 200),
  }, null, 2));

  if (failures.length > 0) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
