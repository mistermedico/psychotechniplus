const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const outputPath = 'C:\\Users\\nitai\\Documents\\Codex\\2026-06-27\\new-chat\\outputs\\deep-live-question-content-audit.json';

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(appRoot, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function parseNumber(value) {
  const normalized = normalizeText(value).replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function correctOption(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  return options.find((option) => option?.isCorrect === true) ?? null;
}

function correctText(question) {
  const option = correctOption(question);
  return normalizeText(option?.text || option?.id || question.correct_answer);
}

function numericCorrect(question) {
  return parseNumber(correctText(question));
}

function pushQuantitativeChecks(question, issues) {
  const text = normalizeText(question.question_text);
  const correct = numericCorrect(question);
  if (correct === null) return;

  let match = text.match(/מה שארית החלוקה של\s*(\d+)\s*ב-(\d+)/);
  if (match) {
    const expected = Number(match[1]) % Number(match[2]);
    if (correct !== expected) issues.push(`wrong remainder: expected ${expected}, got ${correct}`);
  }

  match = text.match(/כמה הם\s*(\d+(?:\.\d+)?)%\s*מ-(\d+(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/);
  if (match) {
    const expected = (Number(match[1]) / 100) * Number(match[2].replace(/,/g, ''));
    if (Math.abs(correct - expected) > 0.001) issues.push(`wrong percentage: expected ${expected}, got ${correct}`);
  }

  match = text.match(/ב-(\d+)\s*ימים.*?(\d+(?:,\d{3})*)\s*עמודים.*?ב-(\d+)\s*ימים/);
  if (match) {
    const days = Number(match[1]);
    const amount = Number(match[2].replace(/,/g, ''));
    const targetDays = Number(match[3]);
    const expected = (amount / days) * targetDays;
    if (Math.abs(correct - expected) > 0.001) issues.push(`wrong direct proportion: expected ${expected}, got ${correct}`);
  }

  match = text.match(/גיל אמא הוא פי\s*(\d+)\s*מגיל בתה.*?בעוד\s*(\d+)\s*שנים.*?פי\s*(\d+)/);
  if (match) {
    const multiplierNow = Number(match[1]);
    const years = Number(match[2]);
    const multiplierFuture = Number(match[3]);
    const expected = ((multiplierFuture * years) - years) / (multiplierNow - multiplierFuture);
    if (Math.abs(correct - expected) > 0.001) issues.push(`wrong age algebra: expected ${expected}, got ${correct}`);
  }
}

function auditQuestion(question) {
  const issues = [];
  const text = normalizeText(question.question_text);
  const explanation = normalizeText(question.explanation);
  const options = Array.isArray(question.options) ? question.options : [];
  const joined = `${text} ${explanation} ${options.map((option) => normalizeText(option?.text)).join(' ')}`;
  const correctOptions = options.filter((option) => option?.isCorrect === true);
  const visibleOptions = options.filter((option) => normalizeText(option?.text) || option?.imageUrl || option?.image_url);
  const optionTexts = options.map((option) => normalizeText(option?.text)).filter(Boolean);
  const duplicateOptionTexts = optionTexts.filter((optionText, index) => optionTexts.indexOf(optionText) !== index);

  if (/[?]{3,}/.test(joined)) issues.push('mojibake question marks');
  if (joined.includes('מה מהי')) issues.push('bad Hebrew phrase: מה מהי');
  if (joined.includes('איזה מהאפשרויות') || joined.includes('איזה אפשרות') || joined.includes('איזה מהצורות')) {
    issues.push('bad Hebrew gender agreement in option phrasing');
  }
  if (!text || text.length < 8) issues.push('question text too short');
  if (!explanation || explanation.length < 28) issues.push('explanation too short');
  if (visibleOptions.length < 2) issues.push('less than two visible options');
  if (correctOptions.length !== 1) issues.push(`expected exactly one correct option, got ${correctOptions.length}`);
  if (duplicateOptionTexts.length > 0) issues.push(`duplicate option text: ${[...new Set(duplicateOptionTexts)].join(', ')}`);

  if (question.topic_id === 'topic_spatial') {
    if (explanation.length < 80) issues.push('spatial explanation too short');
    if (/זו האפשרות היחידה שמתאימה לחוקיות המופיעה בשאלה וליחס בין הצורות\.?$/.test(explanation)) {
      issues.push('generic spatial explanation');
    }
  }

  if (question.topic_id === 'topic_quantitative') pushQuantitativeChecks(question, issues);
  return issues;
}

async function fetchAllQuestions(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, topic_id, question_text, options, correct_answer, explanation')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const questions = await fetchAllQuestions(supabase);
  const failures = questions
    .map((question) => ({
      id: question.id,
      topicId: question.topic_id,
      issues: auditQuestion(question),
      questionText: normalizeText(question.question_text),
      correctAnswer: question.correct_answer,
      correctText: correctText(question),
    }))
    .filter((row) => row.issues.length > 0);

  const report = {
    auditedAt: new Date().toISOString(),
    totalRows: questions.length,
    failures: failures.length,
    byTopic: questions.reduce((acc, question) => {
      acc[question.topic_id] = (acc[question.topic_id] ?? 0) + 1;
      return acc;
    }, {}),
    sampleFailures: failures.slice(0, 200),
  };
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
