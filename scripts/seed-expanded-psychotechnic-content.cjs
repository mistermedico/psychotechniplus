const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, '.seed-build');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(root, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function compileExpandedQuestions() {
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

const expandedTemplates = [
  {
    id: 'tmpl_full_psychotech_plus_2026_001',
    name: 'מבחן פסיכוטכני פלוס מלא',
    description: '60 שאלות במבנה מלא: כמותי, מילולי, לוגי ומרחבי, כולל בחירת שאלות אדפטיבית לפי רמת המשתמש.',
    targetId: 'target_psychometric',
    totalQuestions: 60,
    timeLimitMinutes: 75,
    rules: [
      { id: 'r_quant', topicId: 'topic_quantitative', count: 16, minDifficulty: 2, maxDifficulty: 10, useAdaptive: true },
      { id: 'r_verbal', topicId: 'topic_verbal', count: 14, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_logic', topicId: 'topic_logic', count: 16, minDifficulty: 3, maxDifficulty: 10, useAdaptive: true },
      { id: 'r_spatial', topicId: 'topic_spatial', count: 14, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr_quant_plus', name: 'כמותי - חישוב מהיר', topicId: 'topic_quantitative', count: 16, minDifficulty: 2, maxDifficulty: 10, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_verbal_plus', name: 'מילולי - דיוק והבנה', topicId: 'topic_verbal', count: 14, minDifficulty: 2, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_logic_plus', name: 'לוגי - סדרות והסקה', topicId: 'topic_logic', count: 16, minDifficulty: 3, maxDifficulty: 10, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_spatial_plus', name: 'מרחבי - סיבובים וקוביות', topicId: 'topic_spatial', count: 14, minDifficulty: 2, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
    ],
    topicTimeSettings: { topic_quantitative: 75, topic_verbal: 65, topic_logic: 72, topic_spatial: 60 },
    restTimeBetweenRules: 25,
    restScreenMessage: 'סיימת חלק. נשימה קצרה, בדוק קצב, והמשך לחלק הבא.',
    passingScore: 68,
    createdAt: '2026-06-09T00:00:00.000Z',
    isActive: true,
  },
  {
    id: 'tmpl_spatial_mastery_2026_001',
    name: 'מבחן חשיבה מרחבית מלא',
    description: '36 שאלות צורות: סיבובים, מראות, קוביות, פריסות גופים ותפיסה תלת-ממדית.',
    targetId: 'target_tayyas',
    totalQuestions: 36,
    timeLimitMinutes: 35,
    rules: [
      { id: 'r_spatial_easy', topicId: 'topic_spatial', count: 10, minDifficulty: 2, maxDifficulty: 5, useAdaptive: true },
      { id: 'r_spatial_mid', topicId: 'topic_spatial', count: 14, minDifficulty: 4, maxDifficulty: 7, useAdaptive: true },
      { id: 'r_spatial_hard', topicId: 'topic_spatial', count: 12, minDifficulty: 6, maxDifficulty: 10, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr_spatial_rotation', name: 'סיבובי צורות', topicId: 'topic_spatial', count: 12, minDifficulty: 2, maxDifficulty: 8, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr_spatial_cubes', name: 'קוביות ומבנים', topicId: 'topic_spatial', count: 12, minDifficulty: 3, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr_spatial_nets', name: 'פריסות גופים', topicId: 'topic_spatial', count: 12, minDifficulty: 4, maxDifficulty: 10, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
    ],
    topicTimeSettings: { topic_spatial: 55 },
    restTimeBetweenRules: 15,
    passingScore: 70,
    createdAt: '2026-06-09T00:00:00.000Z',
    isActive: true,
  },
  {
    id: 'tmpl_officer_screening_2026_001',
    name: 'מבחן קצונה פסיכוטכני מלא',
    description: '45 שאלות למיון קצונה: דגש על לוגיקה, כמותי ומילולי תחת זמן.',
    targetId: 'target_ktzina',
    totalQuestions: 45,
    timeLimitMinutes: 50,
    rules: [
      { id: 'r_logic', topicId: 'topic_logic', count: 18, minDifficulty: 3, maxDifficulty: 10, useAdaptive: true },
      { id: 'r_quant', topicId: 'topic_quantitative', count: 15, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_verbal', topicId: 'topic_verbal', count: 8, minDifficulty: 2, maxDifficulty: 8, useAdaptive: true },
      { id: 'r_spatial', topicId: 'topic_spatial', count: 4, minDifficulty: 3, maxDifficulty: 8, useAdaptive: true },
    ],
    topicTimeSettings: { topic_logic: 70, topic_quantitative: 75, topic_verbal: 60, topic_spatial: 55 },
    restTimeBetweenRules: 20,
    passingScore: 72,
    createdAt: '2026-06-09T00:00:00.000Z',
    isActive: true,
  },
  {
    id: 'tmpl_final_sprint_plus_2026_001',
    name: 'ספרינט פסיכוטכני פלוס',
    description: '28 שאלות מהירות לכל התחומים, מיועד לחזרה אחרונה לפני מבחן.',
    targetId: 'target_psychometric',
    totalQuestions: 28,
    timeLimitMinutes: 24,
    rules: [
      { id: 'r_quant', topicId: 'topic_quantitative', count: 7, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_verbal', topicId: 'topic_verbal', count: 7, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_logic', topicId: 'topic_logic', count: 7, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_spatial', topicId: 'topic_spatial', count: 7, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
    ],
    topicTimeSettings: { topic_quantitative: 55, topic_verbal: 48, topic_logic: 55, topic_spatial: 45 },
    restTimeBetweenRules: 8,
    passingScore: 65,
    createdAt: '2026-06-09T00:00:00.000Z',
    isActive: true,
  },
  {
    id: 'tmpl_shape_matrix_master_2026_001',
    name: 'מבחן מטריצות וצורות מתקדם',
    description: '42 שאלות חשיבה צורנית: מטריצות, קיפול, קוביות צבועות וסיבובים תחת זמן.',
    targetId: 'target_tayyas',
    totalQuestions: 42,
    timeLimitMinutes: 42,
    rules: [
      { id: 'r_spatial_warmup', topicId: 'topic_spatial', count: 10, minDifficulty: 3, maxDifficulty: 5, useAdaptive: true },
      { id: 'r_spatial_matrix', topicId: 'topic_spatial', count: 14, minDifficulty: 4, maxDifficulty: 8, useAdaptive: true },
      { id: 'r_spatial_cube', topicId: 'topic_spatial', count: 10, minDifficulty: 5, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_spatial_fold', topicId: 'topic_spatial', count: 8, minDifficulty: 6, maxDifficulty: 10, useAdaptive: true },
    ],
    topicTimeSettings: { topic_spatial: 55 },
    restTimeBetweenRules: 12,
    passingScore: 72,
    createdAt: '2026-06-09T00:00:00.000Z',
    isActive: true,
  },
  {
    id: 'tmpl_quant_logic_heavy_2026_001',
    name: 'מבחן כמותי-לוגי מלא',
    description: '54 שאלות עומק בכמותי ולוגיקה: אחוזים, אלגברה, ממוצעים, הסקה וטבלאות.',
    targetId: 'target_psychometric',
    totalQuestions: 54,
    timeLimitMinutes: 62,
    rules: [
      { id: 'r_quant_core', topicId: 'topic_quantitative', count: 28, minDifficulty: 3, maxDifficulty: 10, useAdaptive: true },
      { id: 'r_logic_core', topicId: 'topic_logic', count: 26, minDifficulty: 3, maxDifficulty: 10, useAdaptive: true },
    ],
    topicTimeSettings: { topic_quantitative: 72, topic_logic: 68 },
    restTimeBetweenRules: 20,
    passingScore: 70,
    createdAt: '2026-06-09T00:00:00.000Z',
    isActive: true,
  },
  {
    id: 'tmpl_verbal_logic_screening_2026_001',
    name: 'מבחן מילולי-לוגי למיון',
    description: '38 שאלות אנלוגיות, השלמות משפטים, אוצר מילים והסקה לוגית.',
    targetId: 'target_modiin',
    totalQuestions: 38,
    timeLimitMinutes: 42,
    rules: [
      { id: 'r_verbal', topicId: 'topic_verbal', count: 20, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_logic', topicId: 'topic_logic', count: 18, minDifficulty: 3, maxDifficulty: 10, useAdaptive: true },
    ],
    topicTimeSettings: { topic_verbal: 58, topic_logic: 68 },
    restTimeBetweenRules: 15,
    passingScore: 68,
    createdAt: '2026-06-09T00:00:00.000Z',
    isActive: true,
  },
  {
    id: 'tmpl_full_exam_long_2026_001',
    name: 'סימולציה פסיכוטכנית ארוכה',
    description: '72 שאלות במבחן ארוך המדמה עומס אמיתי: כל התחומים, קושי מדורג ומנוחות קצרות.',
    targetId: 'target_psychometric',
    totalQuestions: 72,
    timeLimitMinutes: 90,
    rules: [
      { id: 'r_quant', topicId: 'topic_quantitative', count: 20, minDifficulty: 2, maxDifficulty: 10, useAdaptive: true },
      { id: 'r_verbal', topicId: 'topic_verbal', count: 16, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_logic', topicId: 'topic_logic', count: 20, minDifficulty: 3, maxDifficulty: 10, useAdaptive: true },
      { id: 'r_spatial', topicId: 'topic_spatial', count: 16, minDifficulty: 3, maxDifficulty: 10, useAdaptive: true },
    ],
    topicTimeSettings: { topic_quantitative: 75, topic_verbal: 60, topic_logic: 70, topic_spatial: 55 },
    restTimeBetweenRules: 25,
    passingScore: 70,
    createdAt: '2026-06-09T00:00:00.000Z',
    isActive: true,
  },
];

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

async function upsertTemplates(supabase) {
  const current = await supabase.from('admin_state').select('value').eq('key', 'templates').maybeSingle();
  if (current.error) throw current.error;
  const existing = Array.isArray(current.data?.value) ? current.data.value : [];
  const merged = new Map(existing.map((template) => [template.id, template]));
  expandedTemplates.forEach((template) => merged.set(template.id, template));
  const templates = Array.from(merged.values());
  const { error } = await supabase.from('admin_state').upsert(
    { key: 'templates', value: templates, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw error;
  return templates.length;
}

async function verifyQuestions(supabase, questionIds) {
  const batchSize = 80;
  let count = 0;
  for (let i = 0; i < questionIds.length; i += batchSize) {
    const batch = questionIds.slice(i, i + batchSize);
    const result = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .in('id', batch);
    if (result.error) throw result.error;
    count += result.count ?? 0;
  }
  return count;
}

(async () => {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const questions = compileExpandedQuestions();

  const savedQuestions = await upsertQuestions(supabase, questions);
  const totalTemplates = await upsertTemplates(supabase);
  const verifiedExpandedRows = await verifyQuestions(supabase, questions.map((q) => q.id));

  const byTopic = questions.reduce((acc, question) => {
    acc[question.topicId] = (acc[question.topicId] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    savedQuestions,
    verifiedExpandedRows,
    byTopic,
    addedTemplates: expandedTemplates.length,
    totalTemplates,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  fs.rmSync(buildDir, { recursive: true, force: true });
});
