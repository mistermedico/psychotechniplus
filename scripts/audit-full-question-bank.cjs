const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, '.full-audit-build');

function compileAllQuestions() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(buildDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(buildDir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(buildDir, 'store'), { recursive: true });
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
    'store/adminStore.ts',
    'utils/questionQuality.ts',
    'utils/smartExam.ts',
    'utils/spatialVisualAssets.ts',
  ]) {
    const sourcePath = path.join(root, relativePath);
    const outputPath = path.join(buildDir, relativePath.replace(/\.ts$/, '.js'));
    const source = fs.readFileSync(sourcePath, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions, fileName: sourcePath });
    fs.writeFileSync(outputPath, output.outputText, 'utf8');
  }
  fs.writeFileSync(path.join(buildDir, 'lib', 'db.js'), `
    const noop = async () => null;
    exports.fetchAllQuestions = async () => [];
    exports.fetchTargets = async () => [];
    exports.fetchTopics = async () => [];
    exports.upsertQuestion = noop;
    exports.deleteQuestion = noop;
    exports.seedDatabase = noop;
    exports.saveSessionRecord = noop;
    exports.loadUserSessionHistory = async () => [];
    exports.loadAllSessionHistory = async () => [];
    exports.upsertTarget = noop;
    exports.upsertTopic = noop;
    exports.deleteTopicFromDB = noop;
    exports.saveTemplates = noop;
    exports.loadTemplates = async () => null;
    exports.saveAdminSettings = noop;
    exports.loadAdminSettings = async () => null;
    exports.saveAdminState = noop;
    exports.loadAdminState = async () => null;
  `, 'utf8');
  fs.writeFileSync(path.join(buildDir, 'lib', 'supabase.js'), 'exports.supabase = null;\n', 'utf8');
  fs.writeFileSync(path.join(buildDir, 'utils', 'logger.js'), 'exports.logger = { info(){}, warn(){}, error(){}, debug(){} };\n', 'utf8');
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

function auditSimulationTemplate(template, generated, knownTopicIds) {
  const issues = [];
  const sourceRules = template.smartRules && template.smartRules.length > 0 ? template.smartRules : template.rules;
  const visibleRules = Array.isArray(template.rules) ? template.rules : [];
  const smartRules = Array.isArray(template.smartRules) ? template.smartRules : [];
  const visibleExpectedQuestions = visibleRules.reduce((sum, rule) => sum + Number(rule.count || 0), 0);
  const expectedQuestions = sourceRules.reduce((sum, rule) => sum + Number(rule.count || 0), 0);
  const generatedIds = generated.allQuestions.map((question) => question.id);
  const duplicateGeneratedIds = generatedIds.filter((id, index) => generatedIds.indexOf(id) !== index);

  if (!template.id) issues.push('template missing id');
  if (!normalizeText(template.name)) issues.push('template missing name');
  if (!template.targetId) issues.push('template missing targetId');
  if (!Array.isArray(visibleRules) || visibleRules.length === 0) issues.push('template has no visible rules');
  if (!Array.isArray(sourceRules) || sourceRules.length === 0) issues.push('template has no runnable rules');
  if (smartRules.length > 0 && smartRules.length !== visibleRules.length) {
    issues.push(`smartRules length ${smartRules.length} differs from visible rules length ${visibleRules.length}`);
  }
  if (Number(template.totalQuestions) !== visibleExpectedQuestions) {
    issues.push(`template totalQuestions ${template.totalQuestions} differs from visible rules total ${visibleExpectedQuestions}`);
  }
  if (generated.totalQuestions !== expectedQuestions) {
    issues.push(`generated ${generated.totalQuestions} questions, expected ${expectedQuestions}`);
  }
  if (duplicateGeneratedIds.length > 0) {
    issues.push(`simulation generated duplicate question ids: ${[...new Set(duplicateGeneratedIds)].join(', ')}`);
  }
  if (generated.sections.length !== sourceRules.length) {
    issues.push(`generated ${generated.sections.length} sections, expected ${sourceRules.length}`);
  }

  if (smartRules.length > 0) {
    visibleRules.forEach((rule, index) => {
      const smartRule = smartRules[index];
      if (!smartRule) return;
      if (smartRule.topicId !== rule.topicId) {
        issues.push(`smartRule ${index + 1} topic ${smartRule.topicId} differs from visible rule topic ${rule.topicId}`);
      }
      if (Number(smartRule.count) !== Number(rule.count)) {
        issues.push(`smartRule ${index + 1} count ${smartRule.count} differs from visible rule count ${rule.count}`);
      }
      if (Number(smartRule.minDifficulty) !== Number(rule.minDifficulty)) {
        issues.push(`smartRule ${index + 1} minDifficulty ${smartRule.minDifficulty} differs from visible rule ${rule.minDifficulty}`);
      }
      if (Number(smartRule.maxDifficulty) !== Number(rule.maxDifficulty)) {
        issues.push(`smartRule ${index + 1} maxDifficulty ${smartRule.maxDifficulty} differs from visible rule ${rule.maxDifficulty}`);
      }
      if (Boolean(smartRule.useAdaptiveAlgorithm) !== Boolean(rule.useAdaptive)) {
        issues.push(`smartRule ${index + 1} adaptive flag differs from visible rule`);
      }
    });
  }

  sourceRules.forEach((rule, index) => {
    const section = generated.sections[index];
    if (!knownTopicIds.has(rule.topicId)) issues.push(`rule ${rule.id} references unknown topic ${rule.topicId}`);
    if (!section) return;
    if (section.topicId !== rule.topicId) {
      issues.push(`section ${index + 1} topic ${section.topicId} differs from rule topic ${rule.topicId}`);
    }
    if (section.questions.length !== rule.count) {
      issues.push(`section ${rule.id} generated ${section.questions.length} questions, expected ${rule.count}`);
    }
    if (section.timeLimitSeconds <= 0) {
      issues.push(`section ${rule.id} has invalid time limit ${section.timeLimitSeconds}`);
    }
    const wrongTopic = section.questions.find((question) => question.topicId !== rule.topicId);
    if (wrongTopic) issues.push(`section ${rule.id} includes question ${wrongTopic.id} from ${wrongTopic.topicId}`);
  });

  return issues;
}

try {
  const questions = compileAllQuestions();
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'zustand') {
      return {
        create: (initializer) => {
          let state;
          const set = (updater) => {
            const partial = typeof updater === 'function' ? updater(state) : updater;
            state = { ...state, ...(partial || {}) };
            return state;
          };
          const get = () => state;
          state = initializer(set, get);
          const useStore = () => state;
          useStore.getState = get;
          useStore.setState = set;
          return useStore;
        },
      };
    }
    if (request === '@react-native-async-storage/async-storage') {
      return { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined };
    }
    return originalLoad(request, parent, isMain);
  };
  const {
    ensureSpatialVisualAssets,
    getSpatialVisualModeForQa,
    isSpatialQuestion,
  } = require(path.join(buildDir, 'utils', 'spatialVisualAssets.js'));
  const { generateSmartExamQuestions } = require(path.join(buildDir, 'utils', 'smartExam.js'));
  const { useAdminStore } = require(path.join(buildDir, 'store', 'adminStore.js'));
  Module._load = originalLoad;
  const ids = questions.map((question) => question.id);
  const duplicateIds = ids.filter((id, index) => id && ids.indexOf(id) !== index);
  const adminState = useAdminStore.getState();
  const normalizedQuestions = adminState.questions.map((question) => (isSpatialQuestion(question) ? ensureSpatialVisualAssets(question) : question));
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

  const knownTopicIds = new Set(adminState.topics.map((topic) => topic.id));
  const simulationFailures = adminState.templates
    .map((template) => {
      const generated = generateSmartExamQuestions(template, normalizedQuestions, {});
      return {
        id: template.id,
        issues: auditSimulationTemplate(template, generated, knownTopicIds),
      };
    })
    .filter((row) => row.issues.length > 0);

  failures.push(...simulationFailures.map((failure) => ({
    id: `simulation:${failure.id}`,
    issues: failure.issues,
  })));

  console.log(JSON.stringify({
    totalQuestions: normalizedQuestions.length,
    totalSimulations: adminState.templates.length,
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
