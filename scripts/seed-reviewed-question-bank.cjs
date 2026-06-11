const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, '.reviewed-seed-build');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(root, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function compileQuestions() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(buildDir, 'data'), { recursive: true });
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  };
  for (const relativePath of ['data/types.ts', 'data/expandedPsychotechnicQuestions.ts', 'data/mockData.ts']) {
    const sourcePath = path.join(root, relativePath);
    const outputPath = path.join(buildDir, relativePath.replace(/\.ts$/, '.js'));
    const source = fs.readFileSync(sourcePath, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions, fileName: sourcePath });
    fs.writeFileSync(outputPath, output.outputText, 'utf8');
  }
  return require(path.join(buildDir, 'data', 'mockData.js')).QUESTIONS;
}

function questionToRow(q) {
  return {
    id: q.id,
    target_ids: q.targetIds,
    topic_id: q.topicId,
    subtopic_id: q.subtopicId ?? null,
    question_type: q.questionType,
    question_text: q.questionText,
    reading_passage: q.readingPassage ?? null,
    media_url: q.mediaUrl ?? null,
    media_type: q.mediaType ?? null,
    options: q.options,
    correct_answer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    psychometric_stats: q.psychometricStats,
    access_level: q.accessLevel,
    validation_status: q.validationStatus,
    smart_practice_eligible: q.smartPracticeEligible,
    general_practice_eligible: q.generalPracticeEligible,
  };
}

async function upsertQuestions(supabase, questions) {
  const rows = questions.map(questionToRow);
  const batchSize = 50;
  let saved = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('questions').upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`questions batch ${i}-${i + batch.length}: ${error.message}`);
    saved += batch.length;
  }
  return saved;
}

(async () => {
  try {
    const { url, key } = readSupabaseConfig();
    const supabase = createClient(url, key);
    const questions = compileQuestions();
    const savedQuestions = await upsertQuestions(supabase, questions);
    const byTopic = questions.reduce((acc, question) => {
      acc[question.topicId] = (acc[question.topicId] ?? 0) + 1;
      return acc;
    }, {});

    console.log(JSON.stringify({
      savedQuestions,
      byTopic,
    }, null, 2));
  } finally {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
