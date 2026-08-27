const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, '.spatial-live-fix-build');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(root, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function compileSpatialUtils() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(buildDir, 'utils'), { recursive: true });
  fs.mkdirSync(path.join(buildDir, 'data'), { recursive: true });

  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  };
  for (const relativePath of ['data/types.ts', 'utils/spatialVisualAssets.ts']) {
    const sourcePath = path.join(root, relativePath);
    const outputPath = path.join(buildDir, relativePath.replace(/\.ts$/, '.js'));
    const source = fs.readFileSync(sourcePath, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions, fileName: sourcePath });
    fs.writeFileSync(outputPath, output.outputText, 'utf8');
  }

  return require(path.join(buildDir, 'utils', 'spatialVisualAssets.js'));
}

async function fetchSpatialQuestions(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('topic_id', 'topic_spatial')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function rowToQuestion(row) {
  return {
    id: row.id,
    targetIds: row.target_ids ?? [],
    topicId: row.topic_id,
    subtopicId: row.subtopic_id ?? undefined,
    questionType: row.question_type,
    questionText: row.question_text ?? '',
    readingPassage: row.reading_passage ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaType: row.media_type ?? undefined,
    explanationImageUrl: row.explanation_image_url ?? undefined,
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: row.correct_answer ?? '',
    explanation: row.explanation ?? '',
    difficulty: row.difficulty ?? 3,
    psychometricStats: row.psychometric_stats ?? { elo: 1200, discrimination: 0.7, guessProbability: 0.25 },
    accessLevel: row.access_level ?? 'free',
    validationStatus: row.validation_status ?? 'draft',
    smartPracticeEligible: row.smart_practice_eligible ?? false,
    generalPracticeEligible: row.general_practice_eligible ?? true,
  };
}

function optionLabel(option) {
  const text = String(option?.text ?? '').trim();
  return text || `אפשרות ${String(option?.id ?? '').toUpperCase()}`;
}

function classifyBefore(row) {
  const text = String(row.question_text ?? '');
  const explanation = String(row.explanation ?? '');
  const options = Array.isArray(row.options) ? row.options : [];
  const hasImages = Boolean(row.media_url) && options.every(option => Boolean(option.imageUrl));
  const hasOldNumericText = /כמה|שטח|היקף|ס"מ|קוביות|צלעות/.test(text);
  const genericExplanation = /היחידה שמתאימה לחוקיות|נבחר.*קרוב|לא מופיע|לא מופיעה/.test(explanation);
  const correct = options.find(option => option?.isCorrect === true);
  const explanationMentionsAnswer = correct ? explanation.includes(optionLabel(correct)) || explanation.includes(String(correct.id).toUpperCase()) : false;
  return {
    hadImages: hasImages,
    hadOldNumericText: hasOldNumericText,
    hadGenericExplanation: genericExplanation,
    explanationMentionedAnswer: explanationMentionsAnswer,
  };
}

async function main() {
  const { ensureSpatialVisualAssets, getSpatialVisualModeForQa } = compileSpatialUtils();
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const rows = await fetchSpatialQuestions(supabase);
  const report = [];

  for (const row of rows) {
    const before = classifyBefore(row);
    const fixed = ensureSpatialVisualAssets(rowToQuestion(row));
    const mode = getSpatialVisualModeForQa(fixed);
    const update = {
      question_type: fixed.questionType,
      question_text: fixed.questionText,
      media_url: fixed.mediaUrl,
      media_type: fixed.mediaType,
      explanation_image_url: fixed.explanationImageUrl ?? null,
      options: fixed.options,
      correct_answer: fixed.correctAnswer,
      explanation: fixed.explanation,
    };
    const { error } = await supabase.from('questions').update(update).eq('id', row.id);
    if (error) throw error;
    report.push({
      id: row.id,
      mode,
      correctAnswer: fixed.correctAnswer,
      before,
      after: {
        questionText: fixed.questionText,
        optionImages: fixed.options.filter(option => Boolean(option.imageUrl)).length,
        explanationMentionsCorrectOption: fixed.explanation.includes(fixed.correctAnswer.toUpperCase()),
      },
    });
  }

  const summary = {
    fixedAt: new Date().toISOString(),
    totalSpatialQuestions: rows.length,
    byMode: report.reduce((acc, row) => {
      acc[row.mode] = (acc[row.mode] ?? 0) + 1;
      return acc;
    }, {}),
    oldNumericTextFixed: report.filter(row => row.before.hadOldNumericText).length,
    missingOrPartialImagesFixed: report.filter(row => !row.before.hadImages).length,
    genericExplanationsFixed: report.filter(row => row.before.hadGenericExplanation || !row.before.explanationMentionedAnswer).length,
    sample: report.slice(0, 20),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    fs.rmSync(buildDir, { recursive: true, force: true });
  });
