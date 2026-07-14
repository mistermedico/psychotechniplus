const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs', 'live-questions-export.json'), 'utf8')).questions;

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function correctOption(q) {
  return (q.options ?? []).find(option => option.isCorrect);
}

function optionText(q, id) {
  return text((q.options ?? []).find(option => option.id === id)?.text);
}

function assertQuestion(id, predicate, issue, failures) {
  const q = questions.find(row => row.id === id);
  if (!q) {
    failures.push({ id, issue: 'missing question' });
    return;
  }
  if (!predicate(q)) failures.push({ id, issue, correctAnswer: q.correct_answer, correctText: text(correctOption(q)?.text), explanation: text(q.explanation) });
}

const failures = [];

for (const id of ['q_logic_008', 'q_logic_036']) {
  assertQuestion(id, q => q.correct_answer === 'c' && correctOption(q)?.id === 'c' && text(correctOption(q)?.text) === 'ג', 'leftmost seating question should be ג', failures);
}
for (const id of ['q_logic_011', 'q_logic_039', 'q_logic_019', 'q_logic_047']) {
  assertQuestion(id, q => q.correct_answer === 'd' && correctOption(q)?.id === 'd' && text(correctOption(q)?.text).includes('אי אפשר'), 'ambiguous order question should be אי אפשר לדעת', failures);
}
for (const id of ['q_logic_023', 'q_logic_051']) {
  assertQuestion(id, q => q.correct_answer === 'a' && correctOption(q)?.id === 'a' && text(correctOption(q)?.text) === 'A', 'A/B/C project winner should be A', failures);
}
for (const id of ['q_logic_021', 'q_logic_049']) {
  assertQuestion(id, q => optionText(q, 'd') === 'מצנח' && text(q.explanation).includes('מצנח'), 'odd-one-out option should be מצנח', failures);
}
for (const id of ['q_logic_033', 'q_logic_061']) {
  assertQuestion(id, q => text(q.question_text).includes('יקבלו שירות') && text(q.explanation).includes('יקבלו שירות'), 'seller wording should use יקבלו שירות', failures);
}
assertQuestion('q_logic_002', q => q.correct_answer === 'd' && text(correctOption(q)?.text).includes('אי אפשר'), 'height question should be undetermined', failures);
assertQuestion('q_exp_logic_deduction_117', q => q.correct_answer === 'b' && text(correctOption(q)?.text).includes('אין מסקנה'), 'middle-seat deduction should be no conclusion', failures);
assertQuestion('q_exp_logic_series_009', q => q.correct_answer === 'a' && text(correctOption(q)?.text) === '-2', 'power-of-two subtraction series should end with -2', failures);
assertQuestion('q_pro_spatial_69564ba92ef39aa110626958', q => q.correct_answer === '4' && text(correctOption(q)?.text) === 'טרפז', 'spatial odd shape should be טרפז', failures);

for (const q of questions) {
  const qText = text(q.question_text);
  const explanation = text(q.explanation);
  if (explanation.includes('999999')) failures.push({ id: q.id, issue: 'floating point artifact in explanation' });
  if (!qText.includes('%') || qText.includes('בקירוב')) continue;
  const match = qText.match(/(\d+(?:\.\d+)?)%\D+(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (!match) continue;
  const percent = Number(match[1]);
  const base = Number(match[2].replace(/,/g, ''));
  const expected = (percent / 100) * base;
  if (Number.isInteger(expected)) continue;
  const correctNumber = Number(text(correctOption(q)?.text));
  if (Number.isFinite(correctNumber) && correctNumber === Math.round(expected)) {
    failures.push({ id: q.id, issue: 'rounded percentage question missing בקירוב', questionText: qText });
  }
}

const report = { verifiedAt: new Date().toISOString(), checkedRows: questions.length, failures };
fs.writeFileSync(path.join(ROOT, 'outputs', 'semantic-question-fixes-verify.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
