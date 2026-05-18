import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Question, Topic, Target, UserBadge } from '../data/types';
import { QUESTIONS, TOPICS, TARGETS } from '../data/mockData';

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

// ── Questions ──────────────────────────────────────────────────────────────

export async function fetchQuestions(opts?: {
  topicId?: string;
  targetId?: string;
  status?: string;
}): Promise<Question[]> {
  try {
    let query = supabase.from('questions').select('*');
    if (opts?.topicId) query = query.eq('topic_id', opts.topicId);
    if (opts?.status)  query = query.eq('validation_status', opts.status);
    if (opts?.targetId) query = query.contains('target_ids', [opts.targetId]);
    const { data, error } = await query;
    if (error || !data?.length) return fallbackQuestions(opts);
    return data.map(rowToQuestion);
  } catch {
    return fallbackQuestions(opts);
  }
}

export async function fetchAllQuestions(): Promise<Question[]> {
  try {
    const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    if (error || !data) return QUESTIONS;
    return data.map(rowToQuestion);
  } catch {
    return QUESTIONS;
  }
}

export async function upsertQuestion(q: Question): Promise<{ error?: string }> {
  const { error } = await supabase.from('questions').upsert(questionToRow(q));
  return error ? { error: error.message } : {};
}

export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  return error ? { error: error.message } : {};
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
    const { data } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function saveUserProfile(userId: string, profile: Partial<UserProfileRow>): Promise<void> {
  try {
    await supabase.from('user_profiles').upsert({ id: userId, ...profile, updated_at: new Date().toISOString() });
  } catch {}
}

// ── User ELOs ──────────────────────────────────────────────────────────────

export async function loadUserElos(userId: string): Promise<Record<string, { elo: number; history: { elo: number; date: string }[] }>> {
  try {
    const { data } = await supabase.from('user_elos').select('*').eq('user_id', userId);
    if (!data) return {};
    const result: Record<string, { elo: number; history: { elo: number; date: string }[] }> = {};
    data.forEach(row => { result[row.topic_id] = { elo: row.elo, history: row.history ?? [] }; });
    return result;
  } catch {
    return {};
  }
}

export async function saveUserElo(userId: string, topicId: string, elo: number, history: { elo: number; date: string }[]): Promise<void> {
  try {
    await supabase.from('user_elos').upsert(
      { user_id: userId, topic_id: topicId, elo, history, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,topic_id' }
    );
  } catch {}
}

// ── User Badges ────────────────────────────────────────────────────────────

export async function loadUserBadges(userId: string): Promise<UserBadge[]> {
  try {
    const { data } = await supabase.from('user_badges').select('*').eq('user_id', userId);
    if (!data) return [];
    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      badgeType: row.badge_type,
      earnedAt: new Date(row.earned_at),
      metadata: row.metadata,
    }));
  } catch {
    return [];
  }
}

export async function saveUserBadge(badge: UserBadge): Promise<void> {
  try {
    await supabase.from('user_badges').upsert({
      id: badge.id,
      user_id: badge.userId,
      badge_type: badge.badgeType,
      earned_at: badge.earnedAt.toISOString(),
      metadata: badge.metadata,
    });
  } catch {}
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

function questionToRow(q: Question) {
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

function rowToQuestion(row: any): Question {
  return {
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
  };
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

function fallbackQuestions(opts?: { topicId?: string; targetId?: string }): Question[] {
  let q = QUESTIONS;
  if (opts?.topicId) q = q.filter(x => x.topicId === opts.topicId);
  if (opts?.targetId) q = q.filter(x => x.targetIds.includes(opts.targetId!));
  return q;
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
    isCorrect: boolean;
    isSkipped: boolean;
    timeSpent: number;
    difficulty: number;
  }>;
}

export async function saveSessionRecord(record: SessionRecord): Promise<void> {
  try {
    await supabase.from('practice_sessions').upsert({
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
  } catch {}
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

export async function loadAllSessionHistory(limit = 200): Promise<SessionRecord[]> {
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
