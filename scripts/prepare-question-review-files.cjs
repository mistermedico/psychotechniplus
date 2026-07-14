const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs', 'live-questions-export.json'), 'utf8')).questions;

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

for (const topic of ['topic_logic', 'topic_quantitative', 'topic_verbal', 'topic_spatial']) {
  const rows = data.filter(q => q.topic_id === topic);
  fs.writeFileSync(
    path.join(ROOT, 'outputs', `${topic}-review.txt`),
    rows.map((q, i) => {
      const opts = (q.options || []).map(o => `${o.id}${o.isCorrect ? '*' : ''}: ${text(o.text).slice(0, 140)}`).join(' | ');
      return `${i + 1}. ${q.id}\nQ: ${text(q.question_text)}\nA: ${q.correct_answer}\nOptions: ${opts}\nExplanation: ${text(q.explanation)}\n`;
    }).join('\n---\n'),
    'utf8',
  );
}

const suspectTerms = [
  '\u05dc\u05d0 \u05de\u05d5\u05e4\u05d9\u05e2',
  '\u05dc\u05d0 \u05de\u05d5\u05e4\u05d9\u05e2\u05d4',
  '\u05e7\u05e8\u05d5\u05d1',
  '\u05d8\u05e2\u05d5\u05ea',
  '\u05dc\u05de\u05e2\u05e9\u05d4',
  '\u05dc\u05d0 \u05d1\u05e8\u05d5\u05e8',
  '\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d3\u05e2\u05ea',
  '\u05d0\u05d9\u05df \u05de\u05d9\u05d3\u05e2',
  '\u05dc\u05d0 \u05d1\u05ea\u05e9\u05d5\u05d1\u05d5\u05ea',
  '\u05e9\u05d2\u05d5\u05d9',
  '\u05de\u05d5\u05e4\u05e8\u05db\u05ea',
  '\u05d1\u05d4\u05db\u05e8\u05d7',
  '\u05e0\u05d1\u05d7\u05e8',
];

const suspects = data.filter(q => {
  const joined = `${text(q.question_text)} ${text(q.explanation)} ${(q.options || []).map(o => text(o.text)).join(' ')}`;
  return suspectTerms.some(term => joined.includes(term));
});

fs.writeFileSync(path.join(ROOT, 'outputs', 'semantic-suspects.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  total: data.length,
  suspectCount: suspects.length,
  suspects: suspects.map(q => ({
    id: q.id,
    topicId: q.topic_id,
    questionText: text(q.question_text),
    correctAnswer: q.correct_answer,
    correctText: text((q.options || []).find(o => o.isCorrect)?.text),
    explanation: text(q.explanation),
    options: (q.options || []).map(o => ({ id: o.id, text: text(o.text), isCorrect: Boolean(o.isCorrect) })),
  })),
}, null, 2), 'utf8');

console.log(JSON.stringify({ total: data.length, suspectCount: suspects.length }, null, 2));
