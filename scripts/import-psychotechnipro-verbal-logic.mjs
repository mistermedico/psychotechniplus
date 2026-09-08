import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const plusRoot = path.resolve(scriptDir, '..');
const proRoot = process.env.PSYCHOTECHNIPRO_REPO || 'C:/Users/nitai/Documents/Codex/2026-07-18/vp/work/psychotechnipro-copy';
const proAppId = '694d3f884717da7cc2e1876c';
const proTopics = new Map([
  ['694d436aef4450d1c7d8cdb4', 'topic_verbal'],
  ['698caac6fa8d361006688072', 'topic_verbal'],
  ['694d436aef4450d1c7d8cdb6', 'topic_logic'],
]);
const prefix = 'pro_';
const freeCount = 60;
const selectionSeed = 'psychotechniplus-free-verbal-logic-v1';
const apply = process.argv.includes('--apply');

function readConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`));
  if (!match) throw new Error(`Could not read ${name}`);
  return match[1];
}

function stableScore(id) {
  return crypto.createHash('sha256').update(`${selectionSeed}:${id}`).digest('hex');
}

function normalizeOptions(question) {
  const sourceAnswer = String(question.correctAnswer ?? '');
  const options = (question.options ?? []).map((option, index) => ({
    id: String(option.id ?? String.fromCharCode(97 + index)),
    text: String(option.text ?? ''),
    ...(option.imageUrl ? { imageUrl: option.imageUrl } : {}),
    isCorrect: false,
    ...(option.analysisTag ? { analysisTag: option.analysisTag } : {}),
  }));
  const correct = options.find(option => option.id === sourceAnswer)
    || options.find(option => option.text === sourceAnswer)
    || options[(question.options ?? []).findIndex(option => option.isCorrect === true)]
    || null;
  if (correct) correct.isCorrect = true;
  return { options, correctAnswer: correct?.id ?? '' };
}

function toRow(question, freeIds) {
  const topicId = proTopics.get(question.topicId);
  const { options, correctAnswer } = normalizeOptions(question);
  const sourceStats = question.psychometricStats && typeof question.psychometricStats === 'object'
    ? question.psychometricStats
    : {};
  const knownKeys = new Set([
    'id', 'targetId', 'targetIds', 'topicId', 'subtopicId', 'categoryId', 'subcategoryId',
    'questionType', 'questionText', 'readingPassage', 'richContent', 'mediaUrl', 'mediaType',
    'options', 'correctAnswer', 'explanation', 'explanationImageUrl', 'difficulty',
    'cognitiveSkills', 'psychometricStats', 'tags', 'isActive', 'accessLevel', 'isAiGenerated',
    'smartPracticeEligible', 'smartPracticeTargets', 'generalPracticeEligible',
    'generalPracticeTargets', 'smartSimulationEligible', 'smartSimulationTargets', 'examPools',
    'validationStatus', 'isDraft', 'aiQualityScore', 'qualityFeedback', 'autoTags',
    'created_date', 'updated_date', 'created_by_id', 'created_by', 'is_sample',
  ]);
  const sourceExtraFields = Object.fromEntries(Object.entries(question).filter(([key]) => !knownKeys.has(key)));

  return {
    id: `${prefix}${question.id}`,
    target_ids: ['target_psychometric'],
    topic_id: topicId,
    subtopic_id: null,
    question_type: String(question.questionType || (topicId === 'topic_logic' ? 'logic' : 'verbal')),
    question_text: String(question.questionText ?? ''),
    reading_passage: question.readingPassage || null,
    media_url: question.mediaUrl || null,
    media_type: question.mediaType || (question.mediaUrl ? 'image' : null),
    explanation_image_url: question.explanationImageUrl || null,
    options,
    correct_answer: correctAnswer,
    explanation: String(question.explanation ?? ''),
    difficulty: Math.max(1, Math.min(10, Math.round(Number(question.difficulty) || 3))),
    psychometric_stats: {
      ...sourceStats,
      sourceApp: 'psychotechnipro',
      sourceId: question.id,
      sourceTopicId: question.topicId ?? null,
      sourceTargetId: question.targetId ?? null,
      sourceTargetIds: question.targetIds ?? [],
      sourceSubtopicId: question.subtopicId ?? null,
      sourceCategoryId: question.categoryId ?? null,
      sourceSubcategoryId: question.subcategoryId ?? null,
      sourceQuestionType: question.questionType ?? null,
      sourceRichContent: question.richContent ?? null,
      sourceCognitiveSkills: question.cognitiveSkills ?? [],
      sourceTags: question.tags ?? [],
      sourceIsActive: question.isActive !== false,
      sourceAccessLevel: question.accessLevel ?? null,
      sourceIsAiGenerated: question.isAiGenerated ?? null,
      sourceSmartPracticeEligible: question.smartPracticeEligible ?? null,
      sourceSmartPracticeTargets: question.smartPracticeTargets ?? [],
      sourceGeneralPracticeEligible: question.generalPracticeEligible ?? null,
      sourceGeneralPracticeTargets: question.generalPracticeTargets ?? [],
      sourceSmartSimulationEligible: question.smartSimulationEligible ?? null,
      sourceSmartSimulationTargets: question.smartSimulationTargets ?? [],
      sourceExamPools: question.examPools ?? [],
      sourceValidationStatus: question.validationStatus ?? null,
      sourceIsDraft: question.isDraft ?? null,
      sourceAiQualityScore: question.aiQualityScore ?? null,
      sourceQualityFeedback: question.qualityFeedback ?? null,
      sourceAutoTags: question.autoTags ?? [],
      sourceCreatedAt: question.created_date ?? null,
      sourceUpdatedAt: question.updated_date ?? null,
      sourceCreatedById: question.created_by_id ?? null,
      sourceCreatedBy: question.created_by ?? null,
      sourceIsSample: question.is_sample ?? null,
      sourceExtraFields,
      freeSelectionSeed: freeIds.has(question.id) ? selectionSeed : null,
    },
    access_level: freeIds.has(question.id) ? 'free' : 'premium',
    validation_status: 'pending',
    smart_practice_eligible: false,
    general_practice_eligible: false,
    created_at: question.created_date || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function audit(rows) {
  const ids = new Set();
  const errors = [];
  for (const row of rows) {
    if (ids.has(row.id)) errors.push(`${row.id}: duplicate id`);
    ids.add(row.id);
    if ((!row.question_text.trim() && !row.media_url) || row.options.length < 2) errors.push(`${row.id}: missing content`);
    if (row.options.filter(option => option.isCorrect).length !== 1) errors.push(`${row.id}: correct count`);
    if (!row.options.some(option => option.id === row.correct_answer && option.isCorrect)) errors.push(`${row.id}: answer mismatch`);
    if (row.validation_status !== 'pending' || row.smart_practice_eligible || row.general_practice_eligible) errors.push(`${row.id}: unsafe status`);
  }
  if (errors.length) throw new Error(`Audit failed (${errors.length}):\n${errors.slice(0, 30).join('\n')}`);
}

async function main() {
  const proRequire = createRequire(path.join(proRoot, 'package.json'));
  const { createClient: createBase44Client } = proRequire('@base44/sdk');
  const pro = createBase44Client({ appId: proAppId, requiresAuth: false });

  // The source is strictly read-only. No Base44 mutation method is called anywhere in this script.
  const allSource = await pro.entities.Question.list('-created_date', 5000, 0);
  const selected = allSource.filter(question => proTopics.has(question.topicId));
  const freeIds = new Set([...selected].sort((a, b) => stableScore(a.id).localeCompare(stableScore(b.id))).slice(0, freeCount).map(question => question.id));
  const rows = selected.map(question => toRow(question, freeIds));
  audit(rows);

  const summary = {
    sourceTotal: allSource.length,
    copied: rows.length,
    verbal: rows.filter(row => row.topic_id === 'topic_verbal').length,
    logic: rows.filter(row => row.topic_id === 'topic_logic').length,
    free: rows.filter(row => row.access_level === 'free').length,
    premium: rows.filter(row => row.access_level === 'premium').length,
    pending: rows.filter(row => row.validation_status === 'pending').length,
    withQuestionMedia: rows.filter(row => row.media_url).length,
    withOptionMedia: rows.filter(row => row.options.some(option => option.imageUrl)).length,
    sourceMutations: 0,
  };
  if (!apply) return console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2));

  const supabaseSource = await fs.readFile(path.join(plusRoot, 'lib', 'supabase.ts'), 'utf8');
  const plus = createSupabaseClient(readConstant(supabaseSource, 'SUPABASE_URL'), readConstant(supabaseSource, 'SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let upserted = 0;
  for (let index = 0; index < rows.length; index += 10) {
    const { data, error } = await plus.from('questions').upsert(rows.slice(index, index + 10), { onConflict: 'id' }).select('id');
    if (error) throw new Error(`Destination batch ${index / 10 + 1} failed: ${error.message}`);
    upserted += data?.length ?? 0;
  }

  const { count, error } = await plus.from('questions').select('id', { count: 'exact', head: true })
    .like('id', `${prefix}%`).in('topic_id', ['topic_verbal', 'topic_logic']);
  if (error || count !== rows.length) throw new Error(error?.message || `Expected ${rows.length}, found ${count}`);
  const sourceCountAfter = (await pro.entities.Question.list('-created_date', 5000, 0)).length;
  if (sourceCountAfter !== allSource.length) throw new Error(`Source changed: ${allSource.length} -> ${sourceCountAfter}`);
  console.log(JSON.stringify({ mode: 'applied', ...summary, upserted, verified: count, sourceCountAfter }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
