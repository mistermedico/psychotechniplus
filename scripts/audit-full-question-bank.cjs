const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, '.full-audit-build');

function compileAllQuestions() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(buildDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(buildDir, 'utils'), { recursive: true });
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  };
  for (const relativePath of [
    'data/types.ts',
    'data/expandedPsychotechnicQuestions.ts',
    'data/mockData.ts',
    'utils/spatialVisualAssets.ts',
  ]) {
    const sourcePath = path.join(root, relativePath);
    const outputPath = path.join(buildDir, relativePath.replace(/\.ts$/, '.js'));
    const source = fs.readFileSync(sourcePath, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions, fileName: sourcePath });
    fs.writeFileSync(outputPath, output.outputText, 'utf8');
  }
  return require(path.join(buildDir, 'data', 'mockData.js')).QUESTIONS;
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

function auditQuestion(question) {
  const issues = [];
  const options = Array.isArray(question.options) ? question.options : [];
  const explanation = normalizeText(question.explanation);
  const questionText = normalizeText(question.questionText);
  const optionTexts = options.map((option) => normalizeText(option?.text)).filter(Boolean);
  const duplicateTexts = optionTexts.filter((text, index) => optionTexts.indexOf(text) !== index);
  const correctOptions = options.filter((option) => option && option.isCorrect === true);
  const correctOption = correctOptions[0];
  const correctText = normalizeText(correctOption?.text);

  if (!question.id) issues.push('missing id');
  if (!question.topicId) issues.push('missing topicId');
  if (!questionText || questionText.length < 8) issues.push('question text too short');
  if (explanation.length < 28) issues.push('explanation too short for review quality');
  if (explanation && !hasReasoningMarker(explanation)) issues.push('explanation lacks visible reasoning marker');
  if (hasForbiddenExplanation(explanation)) issues.push('explanation contains contradiction or uncertainty marker');
  if (options.length < 2) issues.push('less than two options');
  if (correctOptions.length !== 1) issues.push(`expected exactly one correct option, got ${correctOptions.length}`);
  if (correctOption && question.correctAnswer !== correctOption.id && question.correctAnswer !== correctOption.text) {
    issues.push(`correctAnswer "${question.correctAnswer}" does not match correct option "${correctOption.id}"`);
  }
  if (duplicateTexts.length > 0) issues.push(`duplicate option text: ${[...new Set(duplicateTexts)].join(', ')}`);
  if (correctText && explanation && !explanation.includes(correctText)) {
    issues.push(`explanation does not mention correct answer "${correctText}"`);
  }

  return issues;
}

function decodeSvgDataUri(value) {
  if (!String(value ?? '').startsWith('data:image/svg+xml;base64,')) return '';
  return Buffer.from(value.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
}

function visiblePalette(svg) {
  const ignored = new Set([
    '#0B1120',
    '#0B1220',
    '#0F172A',
    '#111827',
    '#1E293B',
    '#334155',
    '#94A3B8',
    '#CBD5E1',
    '#E5E7EB',
    '#F8FAFC',
  ]);
  return [...new Set([...svg.matchAll(/(?:fill|stroke)="(#[A-Fa-f0-9]{6})"/g)].map((match) => match[1]).filter((color) => !ignored.has(color)))].sort();
}

function auditSpatialVisualQuestion(question) {
  const issues = [];
  const mediaSvg = decodeSvgDataUri(question.mediaUrl);
  const explanationSvg = decodeSvgDataUri(question.explanationImageUrl);
  const optionSvgs = question.options.map((option) => decodeSvgDataUri(option.imageUrl));

  if (!mediaSvg) issues.push('spatial question missing generated question SVG');
  if (!explanationSvg) issues.push('spatial question missing generated explanation SVG');
  if (optionSvgs.some((svg) => !svg)) issues.push('spatial option missing generated SVG');
  if (new Set(question.options.map((option) => option.imageUrl)).size !== question.options.length) {
    issues.push('spatial option SVGs are not unique');
  }
  if (question.options.some((option) => normalizeText(option.text))) {
    issues.push('spatial image-only option still contains text');
  }
  if (mediaSvg && !mediaSvg.includes('?</text>')) issues.push('spatial question SVG missing visual gap marker');
  if (explanationSvg && !explanationSvg.includes(`אפשרות ${question.correctAnswer.toUpperCase()}`)) {
    issues.push('spatial explanation SVG does not label the correct option');
  }
  const questionPalette = visiblePalette(mediaSvg);
  const questionPaletteSet = new Set(questionPalette);
  const optionPaletteMismatch = optionSvgs.some((svg) => (
    visiblePalette(svg).some((color) => !questionPaletteSet.has(color))
  ));
  if (questionPalette.length > 0 && optionPaletteMismatch) issues.push('spatial option palette differs from question palette');

  return issues;
}

try {
  const questions = compileAllQuestions();
  const {
    ensureSpatialVisualAssets,
    getSpatialVisualModeForQa,
    isSpatialQuestion,
  } = require(path.join(buildDir, 'utils', 'spatialVisualAssets.js'));
  const ids = questions.map((question) => question.id);
  const duplicateIds = ids.filter((id, index) => id && ids.indexOf(id) !== index);
  const normalizedQuestions = questions.map((question) => (isSpatialQuestion(question) ? ensureSpatialVisualAssets(question) : question));
  const failures = normalizedQuestions
    .map((question) => ({
      id: question.id,
      issues: [
        ...auditQuestion(question),
        ...(isSpatialQuestion(question) ? auditSpatialVisualQuestion(question) : []),
      ],
    }))
    .filter((row) => row.issues.length > 0);
  if (duplicateIds.length > 0) {
    failures.unshift({
      id: 'duplicate_ids',
      issues: [`duplicate ids: ${[...new Set(duplicateIds)].join(', ')}`],
    });
  }

  const byTopic = normalizedQuestions.reduce((acc, question) => {
    acc[question.topicId] = (acc[question.topicId] ?? 0) + 1;
    return acc;
  }, {});
  const byStatus = normalizedQuestions.reduce((acc, question) => {
    acc[question.validationStatus] = (acc[question.validationStatus] ?? 0) + 1;
    return acc;
  }, {});

  const spatialModes = normalizedQuestions
    .filter(isSpatialQuestion)
    .reduce((acc, question) => {
      const mode = getSpatialVisualModeForQa(question);
      acc[mode] = (acc[mode] ?? 0) + 1;
      return acc;
    }, {});

  console.log(JSON.stringify({
    totalQuestions: normalizedQuestions.length,
    failures: failures.length,
    byTopic,
    byStatus,
    spatialModes,
    sampleFailures: failures.slice(0, 200),
  }, null, 2));

  if (failures.length > 0) process.exit(1);
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
