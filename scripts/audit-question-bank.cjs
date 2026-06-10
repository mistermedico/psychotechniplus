const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, '.audit-build');

function compileQuestions() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  };
  for (const relativePath of ['data/types.ts', 'data/expandedPsychotechnicQuestions.ts']) {
    const sourcePath = path.join(root, relativePath);
    const outputPath = path.join(buildDir, path.basename(relativePath).replace(/\.ts$/, '.js'));
    const source = fs.readFileSync(sourcePath, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions, fileName: sourcePath });
    fs.writeFileSync(outputPath, output.outputText, 'utf8');
  }
  return require(path.join(buildDir, 'expandedPsychotechnicQuestions.js')).EXPANDED_PSYCHOTECHNIC_QUESTIONS;
}

function auditQuestion(q) {
  const issues = [];
  if (!q.id) issues.push('missing id');
  if (!q.questionText || q.questionText.trim().length < 8) issues.push('question text too short');
  if (!q.explanation || q.explanation.trim().length < 12) issues.push('explanation too short');
  if (!Array.isArray(q.options) || q.options.length < 2) issues.push('less than two options');

  const correctOptions = (q.options ?? []).filter((option) => option.isCorrect);
  if (correctOptions.length !== 1) issues.push(`expected exactly one correct option, got ${correctOptions.length}`);

  const correct = correctOptions[0];
  if (correct && q.correctAnswer !== correct.id && q.correctAnswer !== correct.text) {
    issues.push(`correctAnswer "${q.correctAnswer}" does not match correct option "${correct.id}"`);
  }

  const optionKeys = (q.options ?? []).map((option) => String(option.text ?? '').trim());
  const duplicates = optionKeys.filter((text, index) => text && optionKeys.indexOf(text) !== index);
  if (duplicates.length > 0) issues.push(`duplicate option text: ${[...new Set(duplicates)].join(', ')}`);

  return issues;
}

try {
  const questions = compileQuestions();
  const failures = questions
    .map((question) => ({ id: question.id, issues: auditQuestion(question) }))
    .filter((row) => row.issues.length > 0);
  const byTopic = questions.reduce((acc, question) => {
    acc[question.topicId] = (acc[question.topicId] ?? 0) + 1;
    return acc;
  }, {});
  const byStatus = questions.reduce((acc, question) => {
    acc[question.validationStatus] = (acc[question.validationStatus] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    totalQuestions: questions.length,
    failures: failures.length,
    byTopic,
    byStatus,
    sampleFailures: failures.slice(0, 20),
  }, null, 2));

  if (failures.length > 0) process.exit(1);
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
