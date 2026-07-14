const fs = require('fs');

const exported = JSON.parse(fs.readFileSync('outputs/live-questions-export.json', 'utf8'));
const rows = Array.isArray(exported)
  ? exported
  : (exported.rows ?? exported.questions ?? exported.data ?? []);

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function correctOption(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  return options.find(option => option?.isCorrect === true)
    ?? options.find(option => option?.id === question.correct_answer)
    ?? null;
}

function optionTexts(question) {
  return (Array.isArray(question.options) ? question.options : [])
    .map(option => clean(option?.text))
    .filter(Boolean);
}

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

const triviaWords = [
  '\u05d1\u05d9\u05e8\u05ea',
  '\u05e0\u05e9\u05d9\u05d0',
  '\u05e8\u05d0\u05e9 \u05d4\u05de\u05de\u05e9\u05dc\u05d4',
  '\u05d0\u05d9\u05d6\u05d5 \u05de\u05d3\u05d9\u05e0\u05d4',
  '\u05de\u05d9 \u05db\u05ea\u05d1',
  '\u05d1\u05d0\u05d9\u05d6\u05d5 \u05e9\u05e0\u05d4',
  '\u05de\u05d4 \u05e6\u05d1\u05e2',
  '\u05db\u05de\u05d4 \u05d7\u05d5\u05d3\u05e9\u05d9\u05dd',
  '\u05d9\u05d3\u05e2 \u05db\u05dc\u05dc\u05d9',
  '\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d4',
  '\u05db\u05d3\u05d5\u05e8\u05d2\u05dc',
  '\u05e1\u05e4\u05d5\u05e8\u05d8',
  '\u05e1\u05e8\u05d8',
  '\u05e9\u05d9\u05e8',
  '\u05d6\u05de\u05e8',
];

const genericExplanationFragments = [
  '\u05d4\u05d9\u05d0 \u05d4\u05d9\u05d7\u05d9\u05d3\u05d4 \u05e9\u05de\u05ea\u05d0\u05d9\u05de\u05d4 \u05dc\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05d5\u05dc\u05d7\u05d5\u05e7\u05d9\u05d5\u05ea \u05e9\u05dc \u05d4\u05e9\u05d0\u05dc\u05d4; \u05e9\u05d0\u05e8 \u05d4\u05d0\u05e4\u05e9\u05e8\u05d5\u05d9\u05d5\u05ea \u05d0\u05d9\u05e0\u05df \u05de\u05e7\u05d9\u05d9\u05de\u05d5\u05ea',
  '\u05d4\u05d9\u05d7\u05d9\u05d3\u05d4 \u05e9\u05ea\u05d5\u05d0\u05de\u05ea \u05d0\u05ea \u05d4\u05db\u05dc\u05dc \u05d0\u05d5 \u05d4\u05d7\u05d9\u05e9\u05d5\u05d1 \u05e9\u05d4\u05d5\u05e6\u05d2 \u05d1\u05e9\u05d0\u05dc\u05d4',
  '\u05d4\u05ea\u05e9\u05d5\u05d1\u05d4 \u05d4\u05e0\u05d5\u05db\u05d5\u05e0\u05d4',
  '\u05dc\u05d0 \u05de\u05d5\u05e4\u05d9\u05e2',
  '\u05dc\u05d0 \u05de\u05d5\u05e4\u05d9\u05e2\u05d4',
  '\u05d8\u05e2\u05d5\u05ea \u05d1\u05d7\u05d9\u05e9\u05d5\u05d1',
];

const vagueQuestions = [
  '\u05de\u05d4\u05d9 \u05d4\u05ea\u05e9\u05d5\u05d1\u05d4 \u05d4\u05e0\u05db\u05d5\u05e0\u05d4?',
  '\u05d1\u05d7\u05e8 \u05d0\u05ea \u05d4\u05ea\u05e9\u05d5\u05d1\u05d4 \u05d4\u05e0\u05db\u05d5\u05e0\u05d4',
  '\u05d0\u05d9\u05d6\u05d5 \u05d0\u05e4\u05e9\u05e8\u05d5\u05ea \u05e0\u05db\u05d5\u05e0\u05d4?',
];

const topicSignals = {
  topic_logic: [
    '\u05d0\u05dd', '\u05db\u05dc', '\u05d0\u05d9\u05df', '\u05d7\u05dc\u05e7', '\u05dc\u05e4\u05d7\u05d5\u05ea',
    '\u05d1\u05d3\u05d9\u05d5\u05e7', '\u05e8\u05e7', '\u05e1\u05d3\u05e8\u05d4', '\u05d4\u05d1\u05d0',
    '\u05d4\u05e1\u05e7', '\u05de\u05e1\u05e7\u05e0\u05d4', '\u05e1\u05d9\u05d3\u05d5\u05e8',
    '\u05d9\u05de\u05d9\u05df', '\u05e9\u05de\u05d0\u05dc', '\u05dc\u05e4\u05e0\u05d9', '\u05d0\u05d7\u05e8\u05d9',
  ],
  topic_quantitative: [
    '\u05d0\u05d7\u05d5\u05d6', '\u05de\u05de\u05d5\u05e6\u05e2', '\u05d9\u05d7\u05e1', '\u05de\u05d4\u05d9\u05e8\u05d5\u05ea',
    '\u05d6\u05de\u05df', '\u05de\u05e8\u05d7\u05e7', '\u05de\u05d7\u05d9\u05e8', '\u05db\u05de\u05d5\u05ea',
    '\u05e4\u05d9', '\u05d7\u05dc\u05e7', '\u05e9\u05d1\u05e8', '\u05e1\u05db\u05d5\u05dd',
  ],
  topic_verbal: [
    '\u05db\u05de\u05d5', '\u05de\u05e9\u05de\u05e2\u05d5\u05ea', '\u05de\u05d9\u05dc\u05d4', '\u05d4\u05e4\u05da',
    '\u05e0\u05e8\u05d3\u05e4\u05ea', '\u05d0\u05e0\u05dc\u05d5\u05d2\u05d9\u05d4', '\u05e7\u05d8\u05e2',
    '\u05de\u05e9\u05e4\u05d8', '\u05d4\u05e9\u05dc\u05dd', '\u05e9\u05d5\u05e8\u05e9',
    '\u05d1\u05d9\u05d8\u05d5\u05d9', '\u05e4\u05d9\u05e8\u05d5\u05e9',
  ],
};

const validated = rows.filter(question => question.validation_status === 'validated');
const suspects = [];

for (const question of validated) {
  const text = clean(question.question_text);
  const explanation = clean(question.explanation);
  const options = Array.isArray(question.options) ? question.options : [];
  const correct = correctOption(question);
  const texts = optionTexts(question);
  const issues = [];

  if (includesAny(text, triviaWords)) issues.push('general_knowledge_or_trivia');
  if (includesAny(explanation, genericExplanationFragments)) issues.push('generic_or_bad_explanation');
  if (question.topic_id !== 'topic_spatial' && includesAny(text, vagueQuestions)) issues.push('vague_non_spatial_question');
  if (question.topic_id !== 'topic_spatial' && text.length < 18) issues.push('question_text_too_short');
  if (texts.length > 0 && new Set(texts).size !== texts.length) issues.push('duplicate_answer_texts');
  if (options.filter(option => option?.isCorrect === true).length !== 1) issues.push('invalid_correct_option_count');
  if (correct && question.correct_answer !== correct.id) issues.push('correct_answer_mismatch');
  if (question.topic_id === 'topic_quantitative' && !/[0-9]/.test(text) && !includesAny(text, topicSignals.topic_quantitative)) {
    issues.push('quantitative_without_quantitative_signal');
  }
  if (question.topic_id === 'topic_logic' && !includesAny(text, topicSignals.topic_logic)) {
    issues.push('logic_without_logic_signal');
  }
  if (question.topic_id === 'topic_verbal' && !includesAny(text, topicSignals.topic_verbal)) {
    issues.push('verbal_without_verbal_signal');
  }
  if (question.topic_id === 'topic_spatial' && (!question.media_url || !options.every(option => option?.imageUrl))) {
    issues.push('spatial_missing_image_assets');
  }

  if (issues.length > 0) {
    suspects.push({
      id: question.id,
      topic: question.topic_id,
      text,
      correct: clean(correct?.text || correct?.id || question.correct_answer),
      issues,
    });
  }
}

const duplicateTextGroups = [...rows.reduce((map, question) => {
  const key = clean(question.question_text).toLowerCase();
  if (!key) return map;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(question);
  return map;
}, new Map()).values()]
  .filter(group => group.length > 1)
  .map(group => ({
    text: clean(group[0].question_text),
    count: group.length,
    validatedCount: group.filter(question => question.validation_status === 'validated').length,
    statuses: [...new Set(group.map(question => question.validation_status))],
    ids: group.map(question => question.id),
  }))
  .sort((a, b) => b.count - a.count);

const report = {
  auditedAt: new Date().toISOString(),
  totalRows: rows.length,
  validatedRows: validated.length,
  suspectsCount: suspects.length,
  suspects,
  duplicateTextGroups: duplicateTextGroups.length,
  duplicateSamples: duplicateTextGroups.slice(0, 80),
};

fs.writeFileSync('outputs/strict-live-question-quality-audit.json', JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

if (suspects.length > 0) process.exitCode = 1;
