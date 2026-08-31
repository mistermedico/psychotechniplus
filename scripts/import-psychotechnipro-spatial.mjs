import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUS_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_PRO_ROOT = 'C:/Users/nitai/Documents/Codex/2026-07-18/vp/work/psychotechnipro-copy';
const PRO_ROOT = process.env.PSYCHOTECHNIPRO_REPO || DEFAULT_PRO_ROOT;
const PRO_APP_ID = '694d3f884717da7cc2e1876c';
const PRO_SPATIAL_TOPIC_ID = '694d436aef4450d1c7d8cdb7';
const PRO_SPATIAL_CATEGORY_ID = '69642bfc5d0a3ce6e79236c9';
const PLUS_TARGET_ID = 'target_psychometric';
const PLUS_TOPIC_ID = 'topic_spatial';
const COPY_ID_PREFIX = 'pro_';
const APPLY = process.argv.includes('--apply');

function readConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`));
  if (!match) throw new Error(`Could not read ${name} from lib/supabase.ts`);
  return match[1];
}

function isSpatialQuestion(question) {
  const exactSpatialValues = new Set(['spatial', 'shapes', 'spatial_reasoning', 'חשיבה מרחבית']);
  return question.topicId === PRO_SPATIAL_TOPIC_ID
    || question.categoryId === PRO_SPATIAL_CATEGORY_ID
    || exactSpatialValues.has(String(question.questionType ?? ''))
    || (question.cognitiveSkills ?? []).some(value => exactSpatialValues.has(String(value)))
    || (question.tags ?? []).some(value => exactSpatialValues.has(String(value)));
}

function normalizeOptions(question) {
  const sourceCorrectAnswer = String(question.correctAnswer ?? '');
  return (question.options ?? []).map((option, index) => ({
    id: String(option.id ?? String.fromCharCode(97 + index)),
    text: String(option.text ?? ''),
    imageUrl: option.imageUrl || undefined,
    isCorrect: String(option.id ?? '') === sourceCorrectAnswer || option.isCorrect === true,
    ...(option.analysisTag ? { analysisTag: option.analysisTag } : {}),
  }));
}

function normalizeCorrectAnswer(question, options) {
  const sourceCorrectAnswer = String(question.correctAnswer ?? '');
  if (options.some(option => option.id === sourceCorrectAnswer)) return sourceCorrectAnswer;
  return options.find(option => option.isCorrect)?.id ?? options[0]?.id ?? '';
}

function toPlusRow(question) {
  const options = normalizeOptions(question);
  const correctAnswer = normalizeCorrectAnswer(question, options);
  const sourceStats = question.psychometricStats && typeof question.psychometricStats === 'object'
    ? question.psychometricStats
    : {};

  return {
    id: `${COPY_ID_PREFIX}${question.id}`,
    target_ids: [PLUS_TARGET_ID],
    topic_id: PLUS_TOPIC_ID,
    subtopic_id: null,
    question_type: 'shapes',
    question_text: String(question.questionText ?? ''),
    reading_passage: question.readingPassage || null,
    media_url: question.mediaUrl || null,
    media_type: question.mediaUrl ? 'image' : null,
    explanation_image_url: question.explanationImageUrl || null,
    options,
    correct_answer: correctAnswer,
    explanation: String(question.explanation ?? ''),
    difficulty: Math.max(1, Math.min(10, Math.round(Number(question.difficulty) || 3))),
    psychometric_stats: {
      elo: Number(sourceStats.elo) || 1200,
      discrimination: Number(sourceStats.discrimination) || 0.7,
      guessProbability: Number(sourceStats.guessProbability) || 0.25,
      sourceApp: 'psychotechnipro',
      sourceId: question.id,
      sourceQuestionType: question.questionType ?? null,
      sourceValidationStatus: question.validationStatus ?? null,
      sourceIsActive: question.isActive !== false,
      sourceCreatedAt: question.created_date ?? null,
      sourceUpdatedAt: question.updated_date ?? null,
      sourceTags: question.tags ?? [],
      sourceCognitiveSkills: question.cognitiveSkills ?? [],
    },
    access_level: question.accessLevel === 'premium' ? 'premium' : 'free',
    validation_status: 'draft',
    smart_practice_eligible: false,
    general_practice_eligible: false,
    created_at: question.created_date || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function audit(rows) {
  const duplicateIds = rows.filter((row, index) => rows.findIndex(item => item.id === row.id) !== index);
  const invalid = rows.filter(row => {
    const markedCorrect = row.options.filter(option => option.isCorrect);
    return (!row.question_text.trim() && !row.media_url)
      || row.options.length < 2
      || !row.options.some(option => option.id === row.correct_answer)
      || markedCorrect.length !== 1;
  });
  if (duplicateIds.length > 0) throw new Error(`Duplicate copy IDs: ${duplicateIds.length}`);
  if (invalid.length > 0) throw new Error(`Invalid transformed questions: ${invalid.map(row => row.id).join(', ')}`);
}

async function main() {
  const proRequire = createRequire(path.join(PRO_ROOT, 'package.json'));
  const { createClient: createBase44Client } = proRequire('@base44/sdk');
  const pro = createBase44Client({ appId: PRO_APP_ID, requiresAuth: false });

  // Source access is intentionally read-only: this script only calls Question.list().
  const allSourceQuestions = await pro.entities.Question.list('-created_date', 5000, 0);
  const spatialSourceQuestions = allSourceQuestions.filter(isSpatialQuestion);
  const rows = spatialSourceQuestions.map(toPlusRow);
  audit(rows);

  const summary = {
    sourceTotal: allSourceQuestions.length,
    spatialCopies: rows.length,
    withQuestionImage: rows.filter(row => !!row.media_url).length,
    withExplanationImage: rows.filter(row => !!row.explanation_image_url).length,
    withAllOptionImages: rows.filter(row => row.options.length > 0 && row.options.every(option => !!option.imageUrl)).length,
    sourceStatuses: Object.fromEntries(
      [...new Set(spatialSourceQuestions.map(question => question.validationStatus ?? 'missing'))]
        .map(status => [status, spatialSourceQuestions.filter(question => (question.validationStatus ?? 'missing') === status).length]),
    ),
    destinationStatus: 'draft',
    sourceMutations: 0,
  };

  if (!APPLY) {
    console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2));
    return;
  }

  const supabaseSource = await fs.readFile(path.join(PLUS_ROOT, 'lib', 'supabase.ts'), 'utf8');
  const plus = createSupabaseClient(
    readConstant(supabaseSource, 'SUPABASE_URL'),
    readConstant(supabaseSource, 'SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let upserted = 0;
  for (let index = 0; index < rows.length; index += 10) {
    const batch = rows.slice(index, index + 10);
    const { data, error } = await plus
      .from('questions')
      .upsert(batch, { onConflict: 'id' })
      .select('id');
    if (error) throw new Error(`Destination batch ${index / 10 + 1} failed: ${error.message}`);
    upserted += data?.length ?? 0;
  }

  const { count, error: verifyError } = await plus
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .like('id', `${COPY_ID_PREFIX}%`)
    .eq('topic_id', PLUS_TOPIC_ID);
  if (verifyError) throw new Error(`Destination verification failed: ${verifyError.message}`);
  if (count !== rows.length) throw new Error(`Expected ${rows.length} copies, found ${count ?? 0}`);

  const sourceCountAfter = (await pro.entities.Question.list('-created_date', 5000, 0)).length;
  if (sourceCountAfter !== allSourceQuestions.length) {
    throw new Error(`Source count changed unexpectedly: ${allSourceQuestions.length} -> ${sourceCountAfter}`);
  }

  console.log(JSON.stringify({ mode: 'applied', ...summary, upserted, verifiedDestinationCopies: count, sourceCountAfter }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
