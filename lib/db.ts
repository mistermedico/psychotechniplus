import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Question, Topic, Target, UserBadge } from '../data/types';
import { QUESTIONS, TOPICS, TARGETS } from '../data/mockData';
import { logger } from '../utils/logger';
import { isPsychotechnicQuestionReady } from '../utils/questionQuality';
import { ensureSpatialVisualAssets } from '../utils/spatialVisualAssets';

// ── Local storage helpers ──────────────────────────────────────────────────

function localGet(key: string): string | null {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return null; // async path below
}
function localSet(key: string, val: string): void {
  if (Platform.OS === 'web') localStorage.setItem(key, val);
}
async function asyncGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}
async function asyncSet(key: string, val: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, val); return; }
  return AsyncStorage.setItem(key, val);
}

const USER_ID_KEY = '@psychotechniplus/userId';

// ── User identity ──────────────────────────────────────────────────────────

export async function getOrCreateUserId(): Promise<string> {
  if (Platform.OS === 'web') {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) { id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`; localStorage.setItem(USER_ID_KEY, id); }
    return id;
  }
  let id = await AsyncStorage.getItem(USER_ID_KEY);
  if (!id) { id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`; await AsyncStorage.setItem(USER_ID_KEY, id); }
  return id;
}

// ── DB bootstrap (runs once per session, ensures FK targets/topics exist) ──

let _seeded = false;

export async function ensureDbSeeded(): Promise<void> {
  if (_seeded) return;
  _seeded = true;
  try {
    // Always upsert all targets + topics so FK constraints are always satisfied.
    // Upsert is idempotent — safe to run every session.
    const T = TARGETS;
    const TOP = TOPICS;
    const { error: te } = await supabase.from('targets').upsert(
      T.map(t => ({
        id: t.id, name: t.name, slug: t.slug ?? t.id, description: t.description ?? '',
        icon: t.icon, color: t.color, gradient_colors: t.gradientColors ?? [],
        order_index: t.order ?? 0, total_questions: t.totalQuestions ?? 0,
        free_questions_count: t.freeQuestionsCount ?? 0,
        is_premium_only: t.isPremiumOnly ?? false,
        is_active: t.isActive ?? true, coming_soon: t.comingSoon ?? false,
        access_settings: t.accessSettings ?? {},
      }))
    );
    if (te) {
      _seeded = false;
      logger.error('db:seed', 'שגיאה בהזרעת מסלולים', te.message);
    }

    const { error: tope } = await supabase.from('topics').upsert(
      TOP.map(t => ({
        id: t.id, target_id: t.targetId, name: t.name, slug: t.slug ?? t.id,
        description: t.description ?? '', icon: t.icon,
        order_index: t.order ?? 0, is_premium_only: t.isPremiumOnly ?? false, color: t.color ?? '',
      }))
    );
    if (tope) {
      _seeded = false;
      logger.error('db:seed', 'שגיאה בהזרעת נושאים', tope.message);
    }

    if (!te && !tope) {
      logger.success('db:seed', `הזרעה הושלמה: ${T.length} מסלולים, ${TOP.length} נושאים`);
    }
  } catch (e: any) {
    _seeded = false;
    logger.error('db:seed', 'שגיאה בהזרעת DB', e?.message);
  }
}

// ── Questions ──────────────────────────────────────────────────────────────

export async function fetchQuestions(opts?: {
  topicId?: string;
  targetId?: string;
  status?: string;
}): Promise<Question[]> {
  let query = supabase.from('questions').select('*');
  if (opts?.topicId) query = query.eq('topic_id', opts.topicId);
  if (opts?.status)  query = query.eq('validation_status', opts.status);
  if (opts?.targetId) query = query.contains('target_ids', [opts.targetId]);
  const { data, error } = await query;
  if (error) {
    logger.error('db:fetchQuestions', 'שגיאה בטעינת שאלות', error.message);
    return [];
  }
  const questions = (data ?? []).map(rowToQuestion);
  if (opts?.status === 'validated') {
    const ready = questions.filter(isPsychotechnicQuestionReady);
    const blocked = questions.length - ready.length;
    if (blocked > 0) {
      logger.warn('db:fetchQuestions', `${blocked} שאלות מאושרות נחסמו כי אינן עומדות בבדיקת איכות פסיכוטכנית`);
    }
    return ready;
  }
  return questions;
}

export async function fetchAllQuestions(): Promise<Question[]> {
  try {
    const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    if (error) { logger.error('db:fetchAllQuestions', 'שגיאה בטעינת שאלות', error.message); return []; }
    logger.info('db:fetchAllQuestions', `נטענו ${data?.length ?? 0} שאלות מסופאבייס`);
    return (data ?? []).map(rowToQuestion);
  } catch (e: any) {
    logger.error('db:fetchAllQuestions', 'חריגה בטעינת שאלות', e?.message);
    return [];
  }
}

export async function upsertQuestion(q: Question): Promise<{ error?: string }> {
  const { error } = await supabase.from('questions').upsert(questionToRow(q));
  if (error) {
    logger.error('db:upsertQuestion', `שגיאה בשמירת שאלה ${q.id}`, error.message);
    return { error: error.message };
  }
  logger.success('db:upsertQuestion', `שאלה נשמרה בסופאבייס: ${q.id}`, { status: q.validationStatus });
  return {};
}

export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) {
    logger.error('db:deleteQuestion', `שגיאה במחיקת שאלה ${id}`, error.message);
    return { error: error.message };
  }
  logger.info('db:deleteQuestion', `שאלה נמחקה: ${id}`);
  return {};
}

// ── Targets & Topics ───────────────────────────────────────────────────────

export async function fetchTargets(): Promise<Target[]> {
  try {
    const { data, error } = await supabase.from('targets').select('*').order('order_index');
    if (error || !data?.length) return TARGETS;
    return data.map(rowToTarget);
  } catch {
    return TARGETS;
  }
}

export async function fetchTopics(targetId?: string): Promise<Topic[]> {
  try {
    let query = supabase.from('topics').select('*').order('order_index');
    if (targetId) query = query.eq('target_id', targetId);
    const { data, error } = await query;
    if (error || !data?.length) return targetId ? TOPICS.filter(t => t.targetId === targetId) : TOPICS;
    return data.map(rowToTopic);
  } catch {
    return targetId ? TOPICS.filter(t => t.targetId === targetId) : TOPICS;
  }
}

// ── User Profile ───────────────────────────────────────────────────────────

export interface UserProfileRow {
  name: string;
  selected_target_id: string | null;
  has_completed_onboarding: boolean;
  is_premium?: boolean;
  streak: number;
  longest_streak: number;
  last_practiced_date: string | null;
  level: number;
  xp: number;
  total_sessions: number;
  total_correct: number;
  total_answered: number;
}

export async function loadUserProfile(userId: string): Promise<UserProfileRow | null> {
  try {
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') logger.error('db:loadUserProfile', 'שגיאה בטעינת פרופיל', error.message);
    return data ?? null;
  } catch (e: any) {
    logger.error('db:loadUserProfile', 'חריגה בטעינת פרופיל', e?.message);
    return null;
  }
}

export async function saveUserProfile(userId: string, profile: Partial<UserProfileRow>): Promise<void> {
  try {
    const { error } = await supabase.from('user_profiles').upsert({ id: userId, ...profile, updated_at: new Date().toISOString() });
    if (error) logger.error('db:saveUserProfile', 'שגיאה בשמירת פרופיל', error.message);
  } catch (e: any) {
    logger.error('db:saveUserProfile', 'חריגה בשמירת פרופיל', e?.message);
  }
}

// ── User ELOs ──────────────────────────────────────────────────────────────

export type UserEloHistoryEntry = {
  date: string;
  elo?: number;
  isCorrect?: boolean;
  difficulty?: number;
};

export async function loadUserElos(userId: string): Promise<Record<string, { elo: number; history: UserEloHistoryEntry[] }>> {
  try {
    const { data, error } = await supabase.from('user_elos').select('*').eq('user_id', userId);
    if (error) { logger.error('db:loadUserElos', 'שגיאה בטעינת ELO', error.message); return {}; }
    if (!data) return {};
    const result: Record<string, { elo: number; history: UserEloHistoryEntry[] }> = {};
    data.forEach(row => { result[row.topic_id] = { elo: row.elo, history: row.history ?? [] }; });
    return result;
  } catch (e: any) {
    logger.error('db:loadUserElos', 'חריגה בטעינת ELO', e?.message);
    return {};
  }
}

export async function saveUserElo(userId: string, topicId: string, elo: number, history: UserEloHistoryEntry[]): Promise<void> {
  try {
    const { error } = await supabase.from('user_elos').upsert(
      { user_id: userId, topic_id: topicId, elo, history, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,topic_id' }
    );
    if (error) logger.error('db:saveUserElo', `שגיאה בשמירת ELO ${topicId}`, error.message);
  } catch (e: any) {
    logger.error('db:saveUserElo', `חריגה בשמירת ELO ${topicId}`, e?.message);
  }
}

// ── User Badges ────────────────────────────────────────────────────────────

export async function loadUserBadges(userId: string): Promise<UserBadge[]> {
  try {
    const { data, error } = await supabase.from('user_badges').select('*').eq('user_id', userId);
    if (error) { logger.error('db:loadUserBadges', 'שגיאה בטעינת תגים', error.message); return []; }
    if (!data) return [];
    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      badgeType: row.badge_type,
      earnedAt: new Date(row.earned_at),
      metadata: row.metadata,
    }));
  } catch (e: any) {
    logger.error('db:loadUserBadges', 'חריגה בטעינת תגים', e?.message);
    return [];
  }
}

export async function saveUserBadge(badge: UserBadge): Promise<void> {
  try {
    const { error } = await supabase.from('user_badges').upsert({
      id: badge.id,
      user_id: badge.userId,
      badge_type: badge.badgeType,
      earned_at: badge.earnedAt.toISOString(),
      metadata: badge.metadata,
    }, { onConflict: 'user_id,badge_type' });
    if (error) logger.error('db:saveUserBadge', `שגיאה בשמירת תג ${badge.badgeType}`, error.message);
  } catch (e: any) {
    logger.error('db:saveUserBadge', `חריגה בשמירת תג ${badge.badgeType}`, e?.message);
  }
}

// ── Database Seed (called once from Admin panel) ───────────────────────────

export async function seedDatabase(): Promise<{ ok: boolean; message: string }> {
  try {
    // Seed targets
    const targetRows = TARGETS.map(t => ({
      id: t.id, name: t.name, slug: t.slug, description: t.description,
      icon: t.icon, color: t.color, gradient_colors: t.gradientColors,
      order_index: t.order, total_questions: t.totalQuestions,
      free_questions_count: t.freeQuestionsCount, is_premium_only: t.isPremiumOnly,
      is_active: t.isActive, coming_soon: t.comingSoon, access_settings: t.accessSettings,
    }));
    const { error: te } = await supabase.from('targets').upsert(targetRows);
    if (te) return { ok: false, message: `targets: ${te.message}` };

    // Seed topics
    const topicRows = TOPICS.map(t => ({
      id: t.id, target_id: t.targetId, name: t.name, slug: t.slug,
      description: t.description, icon: t.icon, order_index: t.order,
      is_premium_only: t.isPremiumOnly, color: t.color,
    }));
    const { error: topE } = await supabase.from('topics').upsert(topicRows);
    if (topE) return { ok: false, message: `topics: ${topE.message}` };

    // Seed questions in batches of 50
    for (let i = 0; i < QUESTIONS.length; i += 50) {
      const batch = QUESTIONS.slice(i, i + 50).map(questionToRow);
      const { error: qe } = await supabase.from('questions').upsert(batch);
      if (qe) return { ok: false, message: `questions batch ${i}: ${qe.message}` };
    }

    return { ok: true, message: `נזרעו ${TARGETS.length} מסלולים, ${TOPICS.length} נושאים, ${QUESTIONS.length} שאלות` };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'שגיאה לא ידועה' };
  }
}

// ── Row mappers ────────────────────────────────────────────────────────────

function targetToRow(t: Target) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug ?? t.id,
    description: t.description ?? '',
    icon: t.icon,
    color: t.color,
    gradient_colors: t.gradientColors ?? [],
    order_index: t.order ?? 0,
    total_questions: t.totalQuestions ?? 0,
    free_questions_count: t.freeQuestionsCount ?? 0,
    is_premium_only: t.isPremiumOnly ?? false,
    is_active: t.isActive ?? true,
    coming_soon: t.comingSoon ?? false,
    access_settings: t.accessSettings ?? {},
  };
}

function questionToRow(q: Question) {
  const prepared = ensureSpatialVisualAssets(q);
  return {
    id: prepared.id,
    target_ids: prepared.targetIds,
    topic_id: prepared.topicId,
    subtopic_id: prepared.subtopicId ?? null,
    question_type: prepared.questionType,
    question_text: prepared.questionText,
    reading_passage: prepared.readingPassage ?? null,
    media_url: prepared.mediaUrl ?? null,
    media_type: prepared.mediaType ?? null,
    options: prepared.options,
    correct_answer: prepared.correctAnswer,
    explanation: prepared.explanation,
    difficulty: prepared.difficulty,
    psychometric_stats: prepared.psychometricStats,
    access_level: prepared.accessLevel,
    validation_status: prepared.validationStatus,
    smart_practice_eligible: prepared.smartPracticeEligible,
    general_practice_eligible: prepared.generalPracticeEligible,
  };
}

function rowToQuestion(row: any): Question {
  return ensureSpatialVisualAssets({
    id: row.id,
    targetIds: row.target_ids ?? [],
    topicId: row.topic_id,
    subtopicId: row.subtopic_id,
    questionType: row.question_type,
    questionText: row.question_text,
    readingPassage: row.reading_passage,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    options: row.options,
    correctAnswer: row.correct_answer,
    explanation: row.explanation ?? '',
    difficulty: row.difficulty ?? 3,
    psychometricStats: row.psychometric_stats ?? { elo: 1200, discrimination: 0.7, guessProbability: 0.25 },
    accessLevel: row.access_level ?? 'free',
    validationStatus: row.validation_status ?? 'draft',
    smartPracticeEligible: row.smart_practice_eligible ?? false,
    generalPracticeEligible: row.general_practice_eligible ?? true,
  });
}

function rowToTarget(row: any): Target {
  return {
    id: row.id, name: row.name, slug: row.slug, description: row.description,
    icon: row.icon, color: row.color, gradientColors: row.gradient_colors,
    order: row.order_index, totalQuestions: row.total_questions,
    freeQuestionsCount: row.free_questions_count, isPremiumOnly: row.is_premium_only,
    isActive: row.is_active, comingSoon: row.coming_soon, accessSettings: row.access_settings,
  };
}

function rowToTopic(row: any): Topic {
  return {
    id: row.id, targetId: row.target_id, name: row.name, slug: row.slug,
    description: row.description, icon: row.icon, order: row.order_index,
    isPremiumOnly: row.is_premium_only, color: row.color,
  };
}

// ── Target persistence ─────────────────────────────────────────────────────

export async function upsertTarget(t: Target): Promise<void> {
  try {
    const { error } = await supabase.from('targets').upsert(targetToRow(t));
    if (error) logger.error('db:upsertTarget', `שגיאה בשמירת מסלול ${t.id}`, error.message);
  } catch (e: any) {
    logger.error('db:upsertTarget', `חריגה בשמירת מסלול ${t.id}`, e?.message);
  }
}

// ── Topic persistence ──────────────────────────────────────────────────────

export async function upsertTopic(t: Topic): Promise<void> {
  try {
    const { error } = await supabase.from('topics').upsert({
      id: t.id,
      target_id: t.targetId,
      name: t.name,
      slug: t.slug ?? t.id,
      description: t.description ?? '',
      icon: t.icon,
      order_index: t.order ?? 99,
      is_premium_only: t.isPremiumOnly ?? false,
      color: t.color,
    });
    if (error) logger.error('db:upsertTopic', `שגיאה בשמירת נושא ${t.id}`, error.message);
  } catch (e: any) {
    logger.error('db:upsertTopic', `חריגה בשמירת נושא ${t.id}`, e?.message);
  }
}

export async function deleteTopicFromDB(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (error) logger.error('db:deleteTopicFromDB', `שגיאה במחיקת נושא ${id}`, error.message);
  } catch (e: any) {
    logger.error('db:deleteTopicFromDB', `חריגה במחיקת נושא ${id}`, e?.message);
  }
}

// ── Admin cloud state + local fallback ─────────────────────────────────────

export async function saveAdminState(key: string, value: unknown): Promise<void> {
  try {
    const { error } = await supabase.from('admin_state').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
    if (error) logger.info('db:saveAdminState', `שמירה מקומית בלבד עבור ${key}: ${error.message}`);
  } catch (e: any) {
    logger.info('db:saveAdminState', `שמירה מקומית בלבד עבור ${key}: ${e?.message}`);
  }
}

export async function loadAdminState<T>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('admin_state')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) {
      logger.info('db:loadAdminState', `טעינה מקומית בלבד עבור ${key}: ${error.message}`);
      return null;
    }
    return (data?.value ?? null) as T | null;
  } catch (e: any) {
    logger.info('db:loadAdminState', `טעינה מקומית בלבד עבור ${key}: ${e?.message}`);
    return null;
  }
}

// ── Template persistence (Supabase + AsyncStorage fallback) ────────────────

const TEMPLATES_KEY = '@psychotechniplus/admin/templates';

export async function saveTemplates(templates: any[]): Promise<void> {
  try {
    const normalized = templates.map(t => ({
      ...t,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    }));
    await saveAdminState('templates', normalized);
    const serialized = JSON.stringify(normalized);
    await asyncSet(TEMPLATES_KEY, serialized);
  } catch {}
}

export async function loadTemplates(): Promise<any[] | null> {
  try {
    const remote = await loadAdminState<any[]>('templates');
    if (remote && remote.length > 0) {
      await asyncSet(TEMPLATES_KEY, JSON.stringify(remote)).catch(() => null);
      return remote.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) }));
    }
    const raw = await asyncGet(TEMPLATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) }));
  } catch {
    return null;
  }
}

// ── Admin settings persistence (Supabase + AsyncStorage fallback) ──────────

const ADMIN_SETTINGS_KEY = '@psychotechniplus/admin/settings';

export async function saveAdminSettings(settings: Record<string, any>): Promise<void> {
  try {
    await saveAdminState('settings', settings);
    await asyncSet(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export async function loadAdminSettings(): Promise<Record<string, any> | null> {
  try {
    const remote = await loadAdminState<Record<string, any>>('settings');
    if (remote) {
      await asyncSet(ADMIN_SETTINGS_KEY, JSON.stringify(remote)).catch(() => null);
      return remote;
    }
    const raw = await asyncGet(ADMIN_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Session Records ────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  userId: string;
  userName?: string;
  targetId: string;
  topicId: string;
  mode: string;
  templateId?: string;
  templateName?: string;
  totalQuestions: number;
  correctAnswers: number;
  skippedQuestions: number;
  score: number;
  timeSpentSeconds: number;
  startedAt: string;
  completedAt: string;
  answers: Array<{
    questionId: string;
    selectedAnswerId?: string;
    correctAnswerId?: string;
    isCorrect: boolean;
    isSkipped: boolean;
    timeSpent: number;
    difficulty: number;
  }>;
}

export async function saveSessionRecord(record: SessionRecord): Promise<void> {
  if (!record.userId) { logger.error('db:saveSessionRecord', 'userId חסר — סשן לא נשמר'); return; }
  try {
    await supabase.from('user_profiles').upsert({
      id: record.userId,
      name: record.userName ?? '',
      updated_at: new Date().toISOString(),
    });

    const { error } = await supabase.from('practice_sessions').upsert({
      id: record.id,
      user_id: record.userId,
      user_name: record.userName ?? null,
      target_id: record.targetId,
      topic_id: record.topicId,
      mode: record.mode,
      template_id: record.templateId ?? null,
      template_name: record.templateName ?? null,
      total_questions: record.totalQuestions,
      correct_answers: record.correctAnswers,
      skipped_questions: record.skippedQuestions,
      score: record.score,
      time_spent_seconds: record.timeSpentSeconds,
      started_at: record.startedAt,
      completed_at: record.completedAt,
      answers: record.answers,
    });
    if (error) logger.error('db:saveSessionRecord', 'שגיאה בשמירת סשן', error.message);
    else logger.success('db:saveSessionRecord', `סשן נשמר: ${record.id}`);
  } catch (e: any) {
    logger.error('db:saveSessionRecord', 'חריגה בשמירת סשן', e?.message);
  }
}

export async function loadUserSessionHistory(userId: string, limit = 50): Promise<SessionRecord[]> {
  try {
    const { data } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToSessionRecord);
  } catch {
    return [];
  }
}

export async function loadAllSessionHistory(limit = 500): Promise<SessionRecord[]> {
  try {
    const { data } = await supabase
      .from('practice_sessions')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToSessionRecord);
  } catch {
    return [];
  }
}

function rowToSessionRecord(row: any): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? undefined,
    targetId: row.target_id,
    topicId: row.topic_id,
    mode: row.mode,
    templateId: row.template_id ?? undefined,
    templateName: row.template_name ?? undefined,
    totalQuestions: row.total_questions ?? 0,
    correctAnswers: row.correct_answers ?? 0,
    skippedQuestions: row.skipped_questions ?? 0,
    score: row.score ?? 0,
    timeSpentSeconds: row.time_spent_seconds ?? 0,
    startedAt: row.started_at ?? '',
    completedAt: row.completed_at ?? '',
    answers: row.answers ?? [],
  };
}
