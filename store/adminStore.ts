import { create } from 'zustand';
import { Question, Topic, Target, ValidationStatus, QuestionType, AccessLevel } from '../data/types';
import { fetchAllQuestions, fetchTargets, upsertQuestions as dbUpsertMany, deleteQuestion as dbDelete, seedDatabase, saveSessionRecord, loadUserSessionHistory, loadAllSessionHistory, SessionRecord, upsertTarget as dbUpsertTarget, upsertTopic as dbUpsertTopic, deleteTopicFromDB, saveTemplates, loadTemplates, saveAdminSettings, loadAdminSettings, fetchTopics, saveAdminState, loadAdminState } from '../lib/db';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { ensureSpatialVisualAssets } from '../utils/spatialVisualAssets';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVITY_LOG_KEY = '@psychotechniplus/admin/activityLog';
const DELETED_QUESTIONS_KEY = '@psychotechniplus/admin/deletedQuestionIds';
const DELETED_QUESTIONS_REMOTE_KEY = 'deleted_question_ids';
const ADMIN_COLLECTIONS_KEY = 'collections';
let adminRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let adminRealtimeReloadTimer: ReturnType<typeof setTimeout> | null = null;
let adminDataLoadPromise: Promise<void> | null = null;
let deletedQuestionsLoadPromise: Promise<void> | null = null;
const deletedQuestionIds = new Set<string>();
let lastAdminDataLoadStartedAt = 0;
let adminCollectionsSaveTimer: ReturnType<typeof setTimeout> | null = null;
let adminRealtimeMutedUntil = 0;
const ADMIN_RELOAD_MIN_INTERVAL_MS = 1500;
const ADMIN_REALTIME_RELOAD_DEBOUNCE_MS = 900;
const ADMIN_COLLECTION_SAVE_DEBOUNCE_MS = 700;
const ADMIN_REALTIME_SELF_WRITE_MUTE_MS = 1800;

async function loadDeletedQuestionIds(): Promise<void> {
  if (deletedQuestionsLoadPromise) return deletedQuestionsLoadPromise;
  deletedQuestionsLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(DELETED_QUESTIONS_KEY);
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) {
          deletedQuestionIds.clear();
          ids.filter(id => typeof id === 'string').forEach(id => deletedQuestionIds.add(id));
        }
      }
      const remote = await loadAdminState<string[]>(DELETED_QUESTIONS_REMOTE_KEY).catch(() => null);
      if (Array.isArray(remote)) {
        remote.filter(id => typeof id === 'string').forEach(id => deletedQuestionIds.add(id));
        await AsyncStorage.setItem(DELETED_QUESTIONS_KEY, JSON.stringify([...deletedQuestionIds]));
      }
    } catch (e: any) {
      logger.warn('adminStore:deletedQuestions', 'לא ניתן לטעון רשימת שאלות שנמחקו', e?.message);
    }
  })().finally(() => {
    deletedQuestionsLoadPromise = null;
  });
  return deletedQuestionsLoadPromise;
}

async function persistDeletedQuestionIds(): Promise<void> {
  try {
    const ids = [...deletedQuestionIds];
    await AsyncStorage.setItem(DELETED_QUESTIONS_KEY, JSON.stringify(ids));
    await saveAdminState(DELETED_QUESTIONS_REMOTE_KEY, ids).catch((e: any) => {
      logger.warn('adminStore:deletedQuestions', 'לא ניתן לשמור רשימת מחיקות ב-Supabase', e?.message);
    });
  } catch (e: any) {
    logger.warn('adminStore:deletedQuestions', 'לא ניתן לשמור רשימת שאלות שנמחקו', e?.message);
  }
}

async function markQuestionDeletedLocally(id: string): Promise<void> {
  await loadDeletedQuestionIds();
  deletedQuestionIds.add(id);
  await persistDeletedQuestionIds();
}

function filterDeletedQuestions(questions: Question[]): Question[] {
  if (deletedQuestionIds.size === 0) return questions;
  return questions.filter(q => !deletedQuestionIds.has(q.id));
}

function pickAdminCollections(s: any) {
  return {
    dailyChallenges: s.dailyChallenges,
    userNotes: s.userNotes,
    promoCodes: s.promoCodes,
    pushNotifications: s.pushNotifications,
    revenueSnapshots: s.revenueSnapshots,
    activityLog: s.activityLog,
    generationSessions: s.generationSessions,
    generationPresets: s.generationPresets,
  };
}

function saveAdminCollections(s: any) {
  if (adminCollectionsSaveTimer) clearTimeout(adminCollectionsSaveTimer);
  adminCollectionsSaveTimer = setTimeout(() => {
    adminRealtimeMutedUntil = Date.now() + ADMIN_REALTIME_SELF_WRITE_MUTE_MS;
    saveAdminState(ADMIN_COLLECTIONS_KEY, pickAdminCollections(s));
    adminCollectionsSaveTimer = null;
  }, ADMIN_COLLECTION_SAVE_DEBOUNCE_MS);
}

function normalizeAdminCollections(collections: any) {
  if (!collections || typeof collections !== 'object') return null;
  const next: any = {};
  for (const key of Object.keys(pickAdminCollections({}))) {
    if (Array.isArray(collections[key])) next[key] = collections[key];
  }
  if (Array.isArray(next.promoCodes)) {
    next.promoCodes = next.promoCodes.filter((item: any) => !String(item?.id ?? '').startsWith('promo_00'));
  }
  if (Array.isArray(next.pushNotifications)) {
    next.pushNotifications = next.pushNotifications.filter((item: any) => !String(item?.id ?? '').startsWith('notif_00'));
  }
  if (Array.isArray(next.activityLog)) {
    next.activityLog = next.activityLog.filter((item: any) => !/^log_00[1-8]$/.test(String(item?.id ?? '')));
  }
  if (Array.isArray(next.generationSessions)) {
    next.generationSessions = next.generationSessions.filter((item: any) => !String(item?.id ?? '').startsWith('gen_00'));
  }
  if (Array.isArray(next.generationPresets)) {
    next.generationPresets = next.generationPresets.filter((item: any) => !String(item?.id ?? '').startsWith('preset_00'));
  }
  next.revenueSnapshots = [];
  return Object.keys(next).length > 0 ? next : null;
}

function syncQuestionsToSupabase(
  set: (partial: Partial<AdminState> | ((state: AdminState) => Partial<AdminState>)) => void,
  questions: Question[],
  context: string
) {
  const questionsToSync = filterDeletedQuestions(questions);
  if (questionsToSync.length === 0) return;
  set({ isSyncing: true, syncError: null });
  dbUpsertMany(questionsToSync).then(result => {
    if (result.error) {
      set({ isSyncing: false, syncError: result.error });
      logger.error(context, `שגיאה בסנכרון ${questionsToSync.length} שאלות`, result.error);
      return;
    }
    set({ isSyncing: false, lastSyncedAt: new Date().toISOString(), syncError: null });
    logger.success(context, `${questionsToSync.length} שאלות סונכרנו ל-Supabase`);
  }).catch((e: any) => {
    const message = e?.message ?? 'שגיאת סנכרון שאלות';
    set({ isSyncing: false, syncError: message });
    logger.error(context, message);
  });
}

function trackAdminPersistence(
  set: (partial: Partial<AdminState>) => void,
  promise: Promise<unknown>,
  context: string,
  successMessage: string
) {
  set({ isSyncing: true, syncError: null });
  adminRealtimeMutedUntil = Date.now() + ADMIN_REALTIME_SELF_WRITE_MUTE_MS;
  promise.then(() => {
    set({ isSyncing: false, lastSyncedAt: new Date().toISOString(), syncError: null });
    logger.success(context, successMessage);
  }).catch((e: any) => {
    const message = e?.message ?? 'שגיאת סנכרון ניהול';
    set({ isSyncing: false, syncError: message });
    logger.error(context, message);
  });
}

async function buildRevenueSnapshotsFromProfiles(): Promise<RevenueSnapshot[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('created_at,is_premium');
  if (error) throw error;

  const profiles = data ?? [];
  const months: string[] = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }

  return months.map(month => {
    const end = new Date(`${month}-01T00:00:00.000Z`);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const profilesByMonthEnd = profiles.filter(profile =>
      !profile.created_at || new Date(profile.created_at) < end
    );
    const premiumByMonthEnd = profilesByMonthEnd.filter(profile => profile.is_premium);
    const newSubscribers = profiles.filter(profile =>
      profile.is_premium && String(profile.created_at ?? '').slice(0, 7) === month
    ).length;

    return {
      month,
      mrr: 0,
      newSubscribers,
      churnedSubscribers: 0,
      totalPremiumUsers: premiumByMonthEnd.length,
      conversionRate: profilesByMonthEnd.length > 0 ? premiumByMonthEnd.length / profilesByMonthEnd.length : 0,
    };
  });
}

function withDefaultAppConfig(config: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_APP_CONFIG,
    ...config,
    featureFlags: {
      ...DEFAULT_APP_CONFIG.featureFlags,
      ...(config.featureFlags ?? {}),
    },
  };
}

export const ADMIN_EMAIL = 'mrmedico111@gmail.com';

// ── Pending questions (validation queue seed) ──────────────────────────────
const PENDING_SEED: Question[] = [
  {
    id: 'q_pending_001',
    targetIds: ['target_psychometric'],
    topicId: 'topic_quantitative',
    questionType: 'multiple_choice',
    questionText: 'בחנות יש 240 מוצרים. 35% מהם נמכרו. כמה מוצרים נותרו?',
    options: [
      { id: 'a', text: '84', isCorrect: false },
      { id: 'b', text: '156', isCorrect: true },
      { id: 'c', text: '144', isCorrect: false },
      { id: 'd', text: '168', isCorrect: false },
    ],
    correctAnswer: 'b',
    explanation: '35% מ-240 = 84 נמכרו. נותרו: 240 - 84 = 156.',
    difficulty: 3,
    psychometricStats: { elo: 1150, discrimination: 0.75, guessProbability: 0.25 },
    accessLevel: 'free',
    validationStatus: 'pending',
    smartPracticeEligible: false,
    generalPracticeEligible: false,
  },
  {
    id: 'q_pending_002',
    targetIds: ['target_psychometric'],
    topicId: 'topic_verbal',
    questionType: 'verbal',
    questionText: 'מה ההפך של "מצמצם"?',
    options: [
      { id: 'a', text: 'מרחיב', isCorrect: true },
      { id: 'b', text: 'מחזיק', isCorrect: false },
      { id: 'c', text: 'מוסיף', isCorrect: false },
      { id: 'd', text: 'מגדיל', isCorrect: false },
    ],
    correctAnswer: 'a',
    explanation: '"מצמצם" = מקטין, מגביל. ההפך הדיוק הוא "מרחיב".',
    difficulty: 4,
    psychometricStats: { elo: 1200, discrimination: 0.7, guessProbability: 0.25 },
    accessLevel: 'free',
    validationStatus: 'pending',
    smartPracticeEligible: false,
    generalPracticeEligible: false,
  },
  {
    id: 'q_pending_003',
    targetIds: ['target_ktzina'],
    topicId: 'topic_logic',
    questionType: 'logic',
    questionText: 'כולם שיחקו שחמט. יוסי לא שיחק שחמט. מה ניתן להסיק על יוסי?',
    options: [
      { id: 'a', text: 'יוסי לא שייך לקבוצה', isCorrect: true },
      { id: 'b', text: 'יוסי לא אוהב שחמט', isCorrect: false },
      { id: 'c', text: 'יוסי אינו מוכשר', isCorrect: false },
      { id: 'd', text: 'אי אפשר להסיק', isCorrect: false },
    ],
    correctAnswer: 'a',
    explanation: 'אם כולם בקבוצה שיחקו, ויוסי לא שיחק, המסקנה היחידה היא שיוסי לא שייך לקבוצה. לא ניתן להסיק מכך על העדפות או כישרון.',
    difficulty: 2,
    psychometricStats: { elo: 1050, discrimination: 0.8, guessProbability: 0.25 },
    accessLevel: 'free',
    validationStatus: 'pending',
    smartPracticeEligible: false,
    generalPracticeEligible: false,
  },
  {
    id: 'q_pending_004',
    targetIds: ['target_psychometric'],
    topicId: 'topic_spatial',
    questionType: 'shapes',
    questionText: 'כמה מישורי סימטריה יש לריבוע?',
    options: [
      { id: 'a', text: '2', isCorrect: false },
      { id: 'b', text: '3', isCorrect: false },
      { id: 'c', text: '4', isCorrect: true },
      { id: 'd', text: '8', isCorrect: false },
    ],
    correctAnswer: 'c',
    explanation: 'לריבוע יש 4 מישורי סימטריה: 2 לאורך האלכסונות + 2 לאורך האמצעים (אנכי ואופקי).',
    difficulty: 3,
    psychometricStats: { elo: 1140, discrimination: 0.72, guessProbability: 0.25 },
    accessLevel: 'free',
    validationStatus: 'pending',
    smartPracticeEligible: false,
    generalPracticeEligible: false,
  },
  {
    id: 'q_draft_001',
    targetIds: ['target_hightech'],
    topicId: 'topic_logic',
    questionType: 'multiple_choice',
    questionText: 'איזה מהבאים גדול יותר: 2^10 או 10^3?',
    options: [
      { id: 'a', text: '2^10 (1024)', isCorrect: true },
      { id: 'b', text: '10^3 (1000)', isCorrect: false },
      { id: 'c', text: 'שווים', isCorrect: false },
      { id: 'd', text: 'תלוי ב-x', isCorrect: false },
    ],
    correctAnswer: 'a',
    explanation: '2^10 = 1024, ואילו 10^3 = 1000. לכן הערך הגדול יותר הוא 2^10 (1024).',
    difficulty: 3,
    psychometricStats: { elo: 1130, discrimination: 0.78, guessProbability: 0.25 },
    accessLevel: 'free',
    validationStatus: 'draft',
    smartPracticeEligible: false,
    generalPracticeEligible: false,
  },
];

export interface SimulationRule {
  id: string;
  topicId: string;
  count: number;
  minDifficulty: number;
  maxDifficulty: number;
  useAdaptive: boolean;
}

export interface SubRule {
  type: 'subcategory' | 'questionType';
  value: string;
  count: number;
}

export interface ExamCondition {
  type: 'correctStreak' | 'incorrectStreak' | 'timeSpent';
  operator: 'greaterThan' | 'lessThan' | 'equals';
  value: number;
}

export interface ExcludeRule {
  type: 'difficulty' | 'questionIds';
  minDifficulty: number;
  maxDifficulty: number;
  ids?: string[];
}

export interface SmartRule {
  id: string;
  name: string;
  topicId: string;
  count: number;
  minDifficulty: number;
  maxDifficulty: number;
  useAdaptiveAlgorithm: boolean;
  subRules: SubRule[];
  conditions: ExamCondition[];
  fallback: { type: 'nextRule' | 'anyTopic' | 'skip' };
}

export interface SmartExamTemplate {
  id: string;
  name: string;
  description: string;
  targetId: string;
  totalQuestions: number;
  timeLimitMinutes: number;
  rules: SimulationRule[];
  // Extended smart exam fields
  smartRules?: SmartRule[];
  topicTimeSettings?: Record<string, number>;
  excludeRules?: ExcludeRule[];
  restTimeBetweenRules?: number;
  restScreenMessage?: string;
  passingScore: number;
  createdAt: Date;
  isActive: boolean;
  pinnedQuestionIds?: string[];  // specific questions always included
}

function toSmartRule(rule: SimulationRule, existing?: SmartRule, index = 0): SmartRule {
  return {
    id: existing?.id ?? rule.id,
    name: existing?.name ?? `כלל ${index + 1}`,
    topicId: rule.topicId,
    count: rule.count,
    minDifficulty: rule.minDifficulty,
    maxDifficulty: rule.maxDifficulty,
    useAdaptiveAlgorithm: rule.useAdaptive,
    subRules: existing?.subRules ?? [],
    conditions: existing?.conditions ?? [],
    fallback: existing?.fallback ?? { type: 'nextRule' },
  };
}

function normalizeTemplateRules(template: SmartExamTemplate): SmartExamTemplate {
  const smartRulesById = new Map((template.smartRules ?? []).map(rule => [rule.id, rule]));
  const rules = Array.isArray(template.rules) ? template.rules : [];
  const smartRules = rules.map((rule, index) => (
    toSmartRule(rule, smartRulesById.get(rule.id) ?? template.smartRules?.[index], index)
  ));
  return {
    ...template,
    rules,
    totalQuestions: rules.reduce((sum, rule) => sum + Number(rule.count || 0), 0),
    smartRules,
  };
}

export interface PracticeSessionSettings {
  speedModeSecondsPerQuestion: number;   // default: 60
  showExplanationsAuto: boolean;          // default: false
  autoAdvanceDelaySeconds: number;        // default: 0 (off)
  shuffleAnswerOptions: boolean;          // default: false
  showTimerAlways: boolean;               // default: false
  premiumOnlyModes: string[];             // default: []
  freeUserMaxDifficulty: number;          // default: 10
  premiumUserQuestionLimit: number;       // default: 999 (effectively unlimited)
}

export interface ExamSessionSettings {
  defaultPassingScore: number;            // default: 65
  allowSkipInExam: boolean;              // default: true
  defaultRestTimeBetweenRules: number;   // default: 30 (seconds)
  showPercentileRankInResults: boolean;  // default: true
  showDetailedScoreBreakdown: boolean;   // default: true
  showCorrectAnswersAfterExam: boolean;  // default: true
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSessionSettings = {
  speedModeSecondsPerQuestion: 60,
  showExplanationsAuto: false,
  autoAdvanceDelaySeconds: 0,
  shuffleAnswerOptions: false,
  showTimerAlways: false,
  premiumOnlyModes: [],
  freeUserMaxDifficulty: 10,
  premiumUserQuestionLimit: 999,
};

export const DEFAULT_EXAM_SETTINGS: ExamSessionSettings = {
  defaultPassingScore: 65,
  allowSkipInExam: true,
  defaultRestTimeBetweenRules: 30,
  showPercentileRankInResults: true,
  showDetailedScoreBreakdown: true,
  showCorrectAnswersAfterExam: true,
};

export type { SessionRecord };

export interface AppConfig {
  maintenanceMode: boolean;
  announcementText: string;
  announcementEnabled: boolean;
  announcementLevel: 'info' | 'warning' | 'critical';
  registrationOpen: boolean;
  freeSessionsPerDay: number;
  sessionCooldownMinutes: number;
  leaderboardVisible: boolean;
  featureFlags: {
    speedMode: boolean;
    streakMode: boolean;
    simulations: boolean;
    leaderboard: boolean;
    socialSharing: boolean;
    dailyChallenge: boolean;
  };
}

export interface DailyChallenge {
  id: string;
  date: string; // YYYY-MM-DD
  questionId: string;
  title: string;
  bonusXp: number;
}

export interface UserNote {
  userId: string;
  note: string;
  updatedAt: string;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  maintenanceMode: false,
  announcementText: '',
  announcementEnabled: false,
  announcementLevel: 'info',
  registrationOpen: true,
  freeSessionsPerDay: 10,
  sessionCooldownMinutes: 0,
  leaderboardVisible: true,
  featureFlags: {
    speedMode: true,
    streakMode: true,
    simulations: true,
    leaderboard: true,
    socialSharing: false,
    dailyChallenge: false,
  },
};

export type AppControlPreset = 'normal' | 'launch' | 'contentFreeze' | 'maintenance';

export const APP_CONTROL_PRESETS: Record<AppControlPreset, { label: string; config: AppConfig }> = {
  normal: {
    label: 'Normal operations',
    config: DEFAULT_APP_CONFIG,
  },
  launch: {
    label: 'Launch mode',
    config: {
      ...DEFAULT_APP_CONFIG,
      announcementEnabled: true,
      announcementLevel: 'info',
      announcementText: 'ברוכים הבאים לפסיכוטכני פלוס - כל הכלים פתוחים לתרגול.',
      freeSessionsPerDay: 20,
      sessionCooldownMinutes: 0,
      featureFlags: {
        ...DEFAULT_APP_CONFIG.featureFlags,
        socialSharing: true,
        dailyChallenge: true,
      },
    },
  },
  contentFreeze: {
    label: 'Content review mode',
    config: {
      ...DEFAULT_APP_CONFIG,
      announcementEnabled: true,
      announcementLevel: 'warning',
      announcementText: 'אנחנו מעדכנים תוכן ושאלות. חלק מהפיצ׳רים עשויים להיות מוגבלים זמנית.',
      registrationOpen: true,
      freeSessionsPerDay: 5,
      sessionCooldownMinutes: 15,
      leaderboardVisible: false,
      featureFlags: {
        ...DEFAULT_APP_CONFIG.featureFlags,
        simulations: false,
        leaderboard: false,
        socialSharing: false,
        dailyChallenge: false,
      },
    },
  },
  maintenance: {
    label: 'Maintenance mode',
    config: {
      ...DEFAULT_APP_CONFIG,
      maintenanceMode: true,
      announcementEnabled: true,
      announcementLevel: 'critical',
      announcementText: 'האפליקציה בתחזוקה קצרה. נחזור לפעילות מלאה בקרוב.',
      registrationOpen: false,
      freeSessionsPerDay: 1,
      sessionCooldownMinutes: 60,
      leaderboardVisible: false,
      featureFlags: {
        ...DEFAULT_APP_CONFIG.featureFlags,
        speedMode: false,
        streakMode: false,
        simulations: false,
        leaderboard: false,
        socialSharing: false,
        dailyChallenge: false,
      },
    },
  },
};

export interface PremiumConfig {
  premiumFeatures: {
    speedMode: boolean;
    streakMode: boolean;
    simulations: boolean;
    unlimitedQuestions: boolean;
    adaptiveAlgorithm: boolean;
    detailedAnalytics: boolean;
    dailyChallenge: boolean;
    allTopics: boolean;
  };
  freeUserDailyQuestionLimit: number;  // default: 30
  freeUserMaxDifficulty: number;       // default: 6 (out of 10)
  freeUserSessionLimit: number;        // default: 3 sessions/day
  freePremiumTopics: string[];         // topic IDs accessible to free users (empty = all)
  trialDays: number;                   // default: 7
  paywallTitle: string;
  paywallSubtitle: string;
}

export const DEFAULT_PREMIUM_CONFIG: PremiumConfig = {
  premiumFeatures: {
    speedMode: true,
    streakMode: true,
    simulations: true,
    unlimitedQuestions: true,
    adaptiveAlgorithm: true,
    detailedAnalytics: true,
    dailyChallenge: true,
    allTopics: true,
  },
  freeUserDailyQuestionLimit: 30,
  freeUserMaxDifficulty: 6,
  freeUserSessionLimit: 3,
  freePremiumTopics: [],
  trialDays: 7,
  paywallTitle: 'שדרג לפרמיום',
  paywallSubtitle: 'קבל גישה מלאה לכל הכלים',
};

function withDefaultPremiumConfig(config?: Partial<PremiumConfig>): PremiumConfig {
  return {
    ...DEFAULT_PREMIUM_CONFIG,
    ...(config ?? {}),
    premiumFeatures: {
      ...DEFAULT_PREMIUM_CONFIG.premiumFeatures,
      ...(config?.premiumFeatures ?? {}),
    },
    freePremiumTopics: config?.freePremiumTopics ?? DEFAULT_PREMIUM_CONFIG.freePremiumTopics,
  };
}

interface AdminStats {
  totalQuestions: number;
  validatedCount: number;
  pendingCount: number;
  draftCount: number;
  rejectedCount: number;
  questionsPerTopic: Record<string, number>;
  questionsPerDifficulty: Record<number, number>;
  questionsPerType: Record<string, number>;
  avgDifficulty: number;
  totalTargets: number;
  totalTopics: number;
}

// ── Promo Codes ────────────────────────────────────────────────────────────
export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percent' | 'days_free' | 'full_access';
  discountValue: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  description: string;
}

// ── Push Notifications ─────────────────────────────────────────────────────
export interface PushNotification {
  id: string;
  title: string;
  body: string;
  targetSegment: 'all' | 'free' | 'premium' | 'inactive_7d' | 'inactive_30d';
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  scheduledAt: string | null;
  sentAt: string | null;
  estimatedReach: number;
  openRate: number | null;
  createdAt: string;
}

// ── Revenue Snapshots ──────────────────────────────────────────────────────
export interface RevenueSnapshot {
  month: string;
  mrr: number;
  newSubscribers: number;
  churnedSubscribers: number;
  totalPremiumUsers: number;
  conversionRate: number;
}

// ── Activity Log ───────────────────────────────────────────────────────────
export interface AdminActivityLog {
  id: string;
  action: string;
  timestamp: string;
  category: 'question' | 'user' | 'promo' | 'notification' | 'system' | 'page' | 'session' | 'import';
}

// ── AI Generation Sessions ─────────────────────────────────────────────────
export interface GenerationSession {
  id: string;
  createdAt: string;
  topicId: string;
  topicName: string;
  questionType: string;
  difficulty: number;
  count: number;
  customPrompt: string;
  savedCount: number;
  discardedCount: number;
}

// ── AI Generation Presets ──────────────────────────────────────────────────
export interface GenerationPreset {
  id: string;
  name: string;
  topicId: string;
  questionType: string;
  difficulty: number;
  count: number;
  customPrompt: string;
}

// ── Seed data ──────────────────────────────────────────────────────────────
const SEED_PROMO_CODES: PromoCode[] = [
  {
    id: 'promo_001',
    code: 'STUDENT2025',
    discountType: 'percent',
    discountValue: 50,
    maxUses: 100,
    usedCount: 34,
    expiresAt: '2025-09-01',
    isActive: true,
    createdAt: '2025-01-15T10:00:00Z',
    description: 'הנחה לסטודנטים — 50% הנחה על מנוי',
  },
  {
    id: 'promo_002',
    code: 'TRIAL7',
    discountType: 'days_free',
    discountValue: 7,
    maxUses: 0,
    usedCount: 127,
    expiresAt: null,
    isActive: true,
    createdAt: '2025-02-01T10:00:00Z',
    description: '7 ימי ניסיון חינמי ללא הגבלת שימוש',
  },
  {
    id: 'promo_003',
    code: 'BETA',
    discountType: 'full_access',
    discountValue: 100,
    maxUses: 50,
    usedCount: 48,
    expiresAt: '2025-06-30',
    isActive: false,
    createdAt: '2025-03-01T10:00:00Z',
    description: 'גישה מלאה למשתמשי בטא',
  },
];

const SEED_PUSH_NOTIFICATIONS: PushNotification[] = [
  {
    id: 'notif_001',
    title: 'אל תפספסו — מבחן קרב!',
    body: 'יש לך סימולציה שמחכה. לחץ לתרגול עכשיו ושפר את הציון שלך.',
    targetSegment: 'all',
    status: 'sent',
    scheduledAt: null,
    sentAt: '2025-05-10T09:00:00Z',
    estimatedReach: 0,
    openRate: 0.31,
    createdAt: '2025-05-09T14:00:00Z',
  },
  {
    id: 'notif_002',
    title: 'תזכורת למשתמשי פרמיום',
    body: 'שבוע חדש, אתגרים חדשים! האתגר היומי שלך מחכה.',
    targetSegment: 'premium',
    status: 'scheduled',
    scheduledAt: '2025-06-01T08:00:00Z',
    sentAt: null,
    estimatedReach: 0,
    openRate: null,
    createdAt: '2025-05-18T10:00:00Z',
  },
  {
    id: 'notif_003',
    title: 'חדש: מסלול קצינות מורחב',
    body: 'הוספנו 50 שאלות חדשות למסלול קצינות. זמינות עכשיו!',
    targetSegment: 'inactive_7d',
    status: 'draft',
    scheduledAt: null,
    sentAt: null,
    estimatedReach: 0,
    openRate: null,
    createdAt: '2025-05-17T16:00:00Z',
  },
];

const SEED_ACTIVITY_LOG: AdminActivityLog[] = [
  { id: 'log_001', action: 'אישר שאלה #q_pending_001', timestamp: '2025-05-18T11:30:00Z', category: 'question' },
  { id: 'log_002', action: 'הוסיף קוד קופון STUDENT2025', timestamp: '2025-05-18T10:15:00Z', category: 'promo' },
  { id: 'log_003', action: 'שלח הודעת Push לכלל המשתמשים', timestamp: '2025-05-18T09:00:00Z', category: 'notification' },
  { id: 'log_004', action: 'עדכן הגדרות אפליקציה — מגבלת שאלות חינמיות', timestamp: '2025-05-17T17:45:00Z', category: 'system' },
  { id: 'log_005', action: 'הסתיר קוד קופון BETA', timestamp: '2025-05-17T16:20:00Z', category: 'promo' },
  { id: 'log_006', action: 'שדרג משתמש user_042 לפרמיום', timestamp: '2025-05-17T14:00:00Z', category: 'user' },
  { id: 'log_007', action: 'ייבא 12 שאלות חדשות מ-JSON', timestamp: '2025-05-16T11:00:00Z', category: 'question' },
  { id: 'log_008', action: 'הפעיל מצב תחזוקה לבדיקה', timestamp: '2025-05-15T09:30:00Z', category: 'system' },
];

const SEED_GENERATION_SESSIONS: GenerationSession[] = [
  {
    id: 'gen_001',
    createdAt: '2025-05-17T14:22:00Z',
    topicId: 'topic_quantitative',
    topicName: 'כמותי',
    questionType: 'quantitative',
    difficulty: 6,
    count: 10,
    customPrompt: 'שאלות הסתברות עם תנאי',
    savedCount: 8,
    discardedCount: 2,
  },
  {
    id: 'gen_002',
    createdAt: '2025-05-16T10:05:00Z',
    topicId: 'topic_verbal',
    topicName: 'מילולי',
    questionType: 'verbal',
    difficulty: 5,
    count: 5,
    customPrompt: '',
    savedCount: 5,
    discardedCount: 0,
  },
  {
    id: 'gen_003',
    createdAt: '2025-05-15T09:30:00Z',
    topicId: 'topic_logic',
    topicName: 'היגיון',
    questionType: 'logic',
    difficulty: 7,
    count: 3,
    customPrompt: 'סדרות מספריות מורכבות',
    savedCount: 1,
    discardedCount: 2,
  },
];

const SEED_GENERATION_PRESETS: GenerationPreset[] = [
  {
    id: 'preset_001',
    name: 'כמותי קשה',
    topicId: 'topic_quantitative',
    questionType: 'quantitative',
    difficulty: 8,
    count: 5,
    customPrompt: 'שאלות אלגברה ואנליזה ברמה גבוהה',
  },
  {
    id: 'preset_002',
    name: 'מילולי — אנלוגיות',
    topicId: 'topic_verbal',
    questionType: 'verbal',
    difficulty: 5,
    count: 10,
    customPrompt: 'שאלות אנלוגיה בלבד',
  },
];

interface AdminState {
  isAdmin: boolean;
  freePracticeLimit: number;
  questions: Question[];
  topics: Topic[];
  targets: Target[];
  templates: SmartExamTemplate[];
  selectedQuestionIds: string[];
  practiceSettings: PracticeSessionSettings;
  examSettings: ExamSessionSettings;
  premiumConfig: PremiumConfig;
  sessionHistory: SessionRecord[];
  appConfig: AppConfig;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  dailyChallenges: DailyChallenge[];
  userNotes: UserNote[];

  // New fields
  promoCodes: PromoCode[];
  pushNotifications: PushNotification[];
  revenueSnapshots: RevenueSnapshot[];
  activityLog: AdminActivityLog[];

  // Actions — app config
  setAppConfig: (updates: Partial<AppConfig>) => void;
  setFeatureFlag: (flag: keyof AppConfig['featureFlags'], value: boolean) => void;
  applyAppControlPreset: (preset: AppControlPreset) => void;
  resetAppConfig: () => void;

  // Actions — daily challenges
  addDailyChallenge: (challenge: Omit<DailyChallenge, 'id'>) => DailyChallenge;
  updateDailyChallenge: (id: string, updates: Partial<Omit<DailyChallenge, 'id'>>) => void;
  removeDailyChallenge: (id: string) => void;

  // Actions — user notes
  setUserNote: (userId: string, note: string) => void;
  getUserNote: (userId: string) => string;

  // Actions — auth
  setIsAdmin: (val: boolean) => void;
  setFreePracticeLimit: (n: number) => void;
  setPracticeSettings: (updates: Partial<PracticeSessionSettings>) => void;
  setExamSettings: (updates: Partial<ExamSessionSettings>) => void;
  setPremiumConfig: (updates: Partial<PremiumConfig>) => void;
  addSessionRecord: (record: SessionRecord) => void;
  loadSessionHistory: (userId?: string) => Promise<void>;
  getSessionsByUser: (userId: string) => SessionRecord[];
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Actions — questions
  addQuestion: (q: Omit<Question, 'id'>) => Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  deleteQuestion: (id: string) => Promise<{ ok: boolean; error?: string }>;
  deleteQuestions: (ids: string[]) => Promise<{ ok: boolean; error?: string }>;
  validateQuestion: (id: string, status: ValidationStatus) => void;
  bulkValidate: (ids: string[], status: ValidationStatus) => void;
  toggleSelectQuestion: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  assignQuestionsToTopic: (questionIds: string[], topicId: string) => void;
  assignQuestionsToTargets: (questionIds: string[], targetIds: string[]) => void;
  setQuestionsAccessLevel: (questionIds: string[], level: AccessLevel) => void;
  setQuestionsAdaptiveEligibility: (questionIds: string[], smart: boolean, general: boolean) => void;

  // Actions — topics
  addTopic: (t: Omit<Topic, 'id'>) => Topic;
  updateTopic: (id: string, updates: Partial<Topic>) => void;
  deleteTopic: (id: string) => void;

  // Actions — targets
  updateTarget: (id: string, updates: Partial<Target>) => void;

  // Actions — templates
  addTemplate: (t: Omit<SmartExamTemplate, 'id' | 'createdAt'>) => SmartExamTemplate;
  updateTemplate: (id: string, updates: Partial<SmartExamTemplate>) => void;
  deleteTemplate: (id: string) => void;
  addTopicRuleToTemplate: (templateId: string, rule: SimulationRule) => void;
  removeTopicRuleFromTemplate: (templateId: string, ruleId: string) => void;
  pinQuestionToTemplate: (templateId: string, questionId: string) => void;
  unpinQuestionFromTemplate: (templateId: string, questionId: string) => void;

  // Actions — promo codes
  addPromoCode: (code: Omit<PromoCode, 'id' | 'createdAt' | 'usedCount'>) => PromoCode;
  updatePromoCode: (id: string, updates: Partial<PromoCode>) => void;
  deletePromoCode: (id: string) => void;
  togglePromoCode: (id: string) => void;

  // Actions — push notifications
  addPushNotification: (notif: Omit<PushNotification, 'id' | 'createdAt' | 'sentAt' | 'openRate'>) => PushNotification;
  updatePushNotification: (id: string, updates: Partial<PushNotification>) => void;
  deletePushNotification: (id: string) => void;
  sendPushNotification: (id: string) => void;

  // Actions — activity log
  logActivity: (action: string, category: AdminActivityLog['category']) => void;
  clearActivityLog: () => void;

  // AI Generation sessions + presets
  generationSessions: GenerationSession[];
  generationPresets: GenerationPreset[];
  addGenerationSession: (s: Omit<GenerationSession, 'id' | 'createdAt'>) => void;
  addGenerationPreset: (p: Omit<GenerationPreset, 'id'>) => GenerationPreset;
  deleteGenerationPreset: (id: string) => void;

  // Background bulk generator state
  bgGenRunning: boolean;
  bgGenProgress: { done: number; total: number; currentTopic: string; currentType: string; log: string[] } | null;
  setBgGenRunning: (val: boolean) => void;
  setBgGenProgress: (p: { done: number; total: number; currentTopic: string; currentType: string; log: string[] } | null) => void;

  // Supabase sync
  loadQuestionsFromSupabase: () => Promise<void>;
  seedToSupabase: () => Promise<{ ok: boolean; message: string }>;
  loadAdminData: (force?: boolean) => Promise<void>;
  syncAll: () => Promise<{ ok: boolean; message: string }>;
  startRealtimeSync: () => void;
  stopRealtimeSync: () => void;

  // Computed
  getStats: () => AdminStats;
  getPendingQuestions: () => Question[];
  getQuestionsByStatus: (status: ValidationStatus) => Question[];
}

const SEED_TEMPLATES: SmartExamTemplate[] = [
  {
    id: 'tmpl_001',
    name: 'סימולציה פסיכוטכנית מלאה',
    description: '40 שאלות בחלוקה מדויקת לפי מבנה המבחן הפסיכוטכני',
    targetId: 'target_psychometric',
    totalQuestions: 40,
    timeLimitMinutes: 60,
    rules: [
      { id: 'r1', topicId: 'topic_quantitative', count: 12, minDifficulty: 3, maxDifficulty: 8, useAdaptive: true },
      { id: 'r2', topicId: 'topic_verbal', count: 12, minDifficulty: 3, maxDifficulty: 8, useAdaptive: true },
      { id: 'r3', topicId: 'topic_logic', count: 10, minDifficulty: 3, maxDifficulty: 8, useAdaptive: true },
      { id: 'r4', topicId: 'topic_spatial', count: 6, minDifficulty: 2, maxDifficulty: 7, useAdaptive: true },
    ],
    passingScore: 65,
    createdAt: new Date('2025-01-10'),
    isActive: true,
  },
  {
    id: 'tmpl_002',
    name: 'מבחן קצינות — שלב א׳',
    description: 'פסיכוטכני לוגי-כמותי, 30 דקות',
    targetId: 'target_ktzina',
    totalQuestions: 25,
    timeLimitMinutes: 30,
    rules: [
      { id: 'r1', topicId: 'topic_logic', count: 15, minDifficulty: 4, maxDifficulty: 9, useAdaptive: true },
      { id: 'r2', topicId: 'topic_quantitative', count: 10, minDifficulty: 4, maxDifficulty: 8, useAdaptive: false },
    ],
    passingScore: 75,
    createdAt: new Date('2025-01-15'),
    isActive: true,
  },
  {
    id: 'tmpl_psycho_quick_001',
    name: 'מבחן פסיכוטכני קצר',
    description: '20 שאלות ממוקדות לכל ארבעת התחומים - מתאים לאבחון מהיר לפני תרגול.',
    targetId: 'target_psychometric',
    totalQuestions: 20,
    timeLimitMinutes: 25,
    rules: [
      { id: 'r1', topicId: 'topic_quantitative', count: 5, minDifficulty: 2, maxDifficulty: 7, useAdaptive: true },
      { id: 'r2', topicId: 'topic_verbal', count: 5, minDifficulty: 2, maxDifficulty: 7, useAdaptive: true },
      { id: 'r3', topicId: 'topic_logic', count: 5, minDifficulty: 2, maxDifficulty: 8, useAdaptive: true },
      { id: 'r4', topicId: 'topic_spatial', count: 5, minDifficulty: 2, maxDifficulty: 7, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr1', name: 'כמותי', topicId: 'topic_quantitative', count: 5, minDifficulty: 2, maxDifficulty: 7, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr2', name: 'מילולי', topicId: 'topic_verbal', count: 5, minDifficulty: 2, maxDifficulty: 7, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr3', name: 'לוגיקה', topicId: 'topic_logic', count: 5, minDifficulty: 2, maxDifficulty: 8, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr4', name: 'צורות ומרחב', topicId: 'topic_spatial', count: 5, minDifficulty: 2, maxDifficulty: 7, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
    ],
    topicTimeSettings: {
      topic_quantitative: 75,
      topic_verbal: 70,
      topic_logic: 75,
      topic_spatial: 65,
    },
    restTimeBetweenRules: 15,
    restScreenMessage: 'נשימה קצרה וממשיכים לחלק הבא.',
    passingScore: 65,
    createdAt: new Date('2026-06-04'),
    isActive: true,
  },
  {
    id: 'tmpl_psycho_logic_quant_001',
    name: 'מבחן לוגי-כמותי',
    description: '30 שאלות בקצב מבחן: יחסים, סדרות, הסקה וטבלאות.',
    targetId: 'target_psychometric',
    totalQuestions: 30,
    timeLimitMinutes: 35,
    rules: [
      { id: 'r1', topicId: 'topic_quantitative', count: 15, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
      { id: 'r2', topicId: 'topic_logic', count: 15, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr1', name: 'חשיבה כמותית', topicId: 'topic_quantitative', count: 15, minDifficulty: 3, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr2', name: 'חשיבה לוגית', topicId: 'topic_logic', count: 15, minDifficulty: 3, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
    ],
    topicTimeSettings: {
      topic_quantitative: 70,
      topic_logic: 70,
    },
    restTimeBetweenRules: 20,
    passingScore: 70,
    createdAt: new Date('2026-06-04'),
    isActive: true,
  },
  {
    id: 'tmpl_psycho_spatial_verbal_001',
    name: 'מבחן מילולי ומרחבי',
    description: '24 שאלות לתרגול אנלוגיות, השלמות משפטים, צורות וסיבובים.',
    targetId: 'target_psychometric',
    totalQuestions: 24,
    timeLimitMinutes: 30,
    rules: [
      { id: 'r1', topicId: 'topic_verbal', count: 12, minDifficulty: 2, maxDifficulty: 8, useAdaptive: true },
      { id: 'r2', topicId: 'topic_spatial', count: 12, minDifficulty: 2, maxDifficulty: 8, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr1', name: 'חשיבה מילולית', topicId: 'topic_verbal', count: 12, minDifficulty: 2, maxDifficulty: 8, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr2', name: 'צורות ומרחב', topicId: 'topic_spatial', count: 12, minDifficulty: 2, maxDifficulty: 8, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
    ],
    topicTimeSettings: {
      topic_verbal: 70,
      topic_spatial: 75,
    },
    restTimeBetweenRules: 20,
    passingScore: 68,
    createdAt: new Date('2026-06-04'),
    isActive: true,
  },
  {
    id: 'tmpl_adaptive_full_psychotech_001',
    name: 'מבחן פסיכוטכני אדפטיבי מלא',
    description: 'סימולציה מלאה בארבעה חלקים: כמותי, מילולי, לוגי וצורני. האלגוריתם בוחר שאלות לפי קושי ו-ELO לכל תחום.',
    targetId: 'target_psychometric',
    totalQuestions: 48,
    timeLimitMinutes: 62,
    rules: [
      { id: 'r_quant', topicId: 'topic_quantitative', count: 14, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_verbal', topicId: 'topic_verbal', count: 12, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_logic', topicId: 'topic_logic', count: 12, minDifficulty: 3, maxDifficulty: 10, useAdaptive: true },
      { id: 'r_spatial', topicId: 'topic_spatial', count: 10, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr_quant_warmup', name: 'כמותי - חימום והאצה', topicId: 'topic_quantitative', count: 14, minDifficulty: 2, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_verbal_precision', name: 'מילולי - דיוק והבנה', topicId: 'topic_verbal', count: 12, minDifficulty: 2, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_logic_pressure', name: 'לוגיקה - הסקה בלחץ זמן', topicId: 'topic_logic', count: 12, minDifficulty: 3, maxDifficulty: 10, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_spatial_rotation', name: 'צורני - תפיסה מרחבית', topicId: 'topic_spatial', count: 10, minDifficulty: 2, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
    ],
    topicTimeSettings: {
      topic_quantitative: 75,
      topic_verbal: 65,
      topic_logic: 70,
      topic_spatial: 60,
    },
    restTimeBetweenRules: 25,
    restScreenMessage: 'סיימת חלק. קח נשימה, שחרר את הידיים, ועבור לחלק הבא בקצב יציב.',
    passingScore: 68,
    createdAt: new Date('2026-06-04'),
    isActive: true,
  },
  {
    id: 'tmpl_adaptive_screening_001',
    name: 'אבחון פסיכוטכני אדפטיבי קצר',
    description: '24 שאלות לאבחון מהיר של נקודות חוזק וחולשה. מתאים לפתיחת תכנית תרגול אישית.',
    targetId: 'target_psychometric',
    totalQuestions: 24,
    timeLimitMinutes: 28,
    rules: [
      { id: 'r_quant', topicId: 'topic_quantitative', count: 6, minDifficulty: 1, maxDifficulty: 7, useAdaptive: true },
      { id: 'r_verbal', topicId: 'topic_verbal', count: 6, minDifficulty: 1, maxDifficulty: 7, useAdaptive: true },
      { id: 'r_logic', topicId: 'topic_logic', count: 6, minDifficulty: 2, maxDifficulty: 8, useAdaptive: true },
      { id: 'r_spatial', topicId: 'topic_spatial', count: 6, minDifficulty: 1, maxDifficulty: 7, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr_quant_diag', name: 'כמותי - אבחון', topicId: 'topic_quantitative', count: 6, minDifficulty: 1, maxDifficulty: 7, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_verbal_diag', name: 'מילולי - אבחון', topicId: 'topic_verbal', count: 6, minDifficulty: 1, maxDifficulty: 7, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_logic_diag', name: 'לוגיקה - אבחון', topicId: 'topic_logic', count: 6, minDifficulty: 2, maxDifficulty: 8, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_spatial_diag', name: 'צורני - אבחון', topicId: 'topic_spatial', count: 6, minDifficulty: 1, maxDifficulty: 7, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
    ],
    topicTimeSettings: {
      topic_quantitative: 70,
      topic_verbal: 60,
      topic_logic: 70,
      topic_spatial: 55,
    },
    restTimeBetweenRules: 15,
    passingScore: 60,
    createdAt: new Date('2026-06-04'),
    isActive: true,
  },
  {
    id: 'tmpl_adaptive_logic_quant_advanced_001',
    name: 'מבחן אדפטיבי כמותי-לוגי מתקדם',
    description: 'מבחן עומק למועמדים חזקים: יחסים, סדרות, טבלאות והסקה. הקושי עולה לפי ביצוע.',
    targetId: 'target_psychometric',
    totalQuestions: 36,
    timeLimitMinutes: 45,
    rules: [
      { id: 'r_quant', topicId: 'topic_quantitative', count: 18, minDifficulty: 4, maxDifficulty: 10, useAdaptive: true },
      { id: 'r_logic', topicId: 'topic_logic', count: 18, minDifficulty: 4, maxDifficulty: 10, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr_quant_advanced', name: 'כמותי מתקדם', topicId: 'topic_quantitative', count: 18, minDifficulty: 4, maxDifficulty: 10, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_logic_advanced', name: 'לוגיקה מתקדמת', topicId: 'topic_logic', count: 18, minDifficulty: 4, maxDifficulty: 10, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
    ],
    topicTimeSettings: {
      topic_quantitative: 80,
      topic_logic: 75,
    },
    restTimeBetweenRules: 30,
    restScreenMessage: 'החלק הבא דורש ריכוז גבוה. בדוק שאתה עובד מסודר ולא מנחש מהר מדי.',
    passingScore: 72,
    createdAt: new Date('2026-06-04'),
    isActive: true,
  },
  {
    id: 'tmpl_adaptive_verbal_spatial_001',
    name: 'מבחן אדפטיבי מילולי-צורני',
    description: 'שילוב של הבנת יחסים מילוליים, השלמות ותפיסה מרחבית. מתאים לשיפור דיוק תחת זמן.',
    targetId: 'target_psychometric',
    totalQuestions: 32,
    timeLimitMinutes: 38,
    rules: [
      { id: 'r_verbal', topicId: 'topic_verbal', count: 16, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_spatial', topicId: 'topic_spatial', count: 16, minDifficulty: 2, maxDifficulty: 9, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr_verbal_adaptive', name: 'מילולי אדפטיבי', topicId: 'topic_verbal', count: 16, minDifficulty: 2, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_spatial_adaptive', name: 'צורני אדפטיבי', topicId: 'topic_spatial', count: 16, minDifficulty: 2, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
    ],
    topicTimeSettings: {
      topic_verbal: 62,
      topic_spatial: 58,
    },
    restTimeBetweenRules: 20,
    passingScore: 66,
    createdAt: new Date('2026-06-04'),
    isActive: true,
  },
  {
    id: 'tmpl_adaptive_final_sprint_001',
    name: 'ספרינט פסיכוטכני אדפטיבי',
    description: 'מבחן קצר ומהיר לפני מיון: 20 שאלות, זמן צפוף, בחירה אדפטיבית מכל התחומים.',
    targetId: 'target_psychometric',
    totalQuestions: 20,
    timeLimitMinutes: 20,
    rules: [
      { id: 'r_quant', topicId: 'topic_quantitative', count: 5, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_verbal', topicId: 'topic_verbal', count: 5, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_logic', topicId: 'topic_logic', count: 5, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
      { id: 'r_spatial', topicId: 'topic_spatial', count: 5, minDifficulty: 3, maxDifficulty: 9, useAdaptive: true },
    ],
    smartRules: [
      { id: 'sr_quant_sprint', name: 'כמותי מהיר', topicId: 'topic_quantitative', count: 5, minDifficulty: 3, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_verbal_sprint', name: 'מילולי מהיר', topicId: 'topic_verbal', count: 5, minDifficulty: 3, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_logic_sprint', name: 'לוגי מהיר', topicId: 'topic_logic', count: 5, minDifficulty: 3, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
      { id: 'sr_spatial_sprint', name: 'צורני מהיר', topicId: 'topic_spatial', count: 5, minDifficulty: 3, maxDifficulty: 9, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
    ],
    topicTimeSettings: {
      topic_quantitative: 60,
      topic_verbal: 50,
      topic_logic: 58,
      topic_spatial: 48,
    },
    restTimeBetweenRules: 8,
    passingScore: 64,
    createdAt: new Date('2026-06-04'),
    isActive: true,
  },
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
    createdAt: new Date('2026-06-09'),
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
      { id: 'sr_spatial_rotation', name: 'סיבובי צורות', topicId: 'topic_spatial', count: 10, minDifficulty: 2, maxDifficulty: 5, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr_spatial_cubes', name: 'קוביות ומבנים', topicId: 'topic_spatial', count: 14, minDifficulty: 4, maxDifficulty: 7, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'nextRule' } },
      { id: 'sr_spatial_nets', name: 'פריסות גופים', topicId: 'topic_spatial', count: 12, minDifficulty: 6, maxDifficulty: 10, useAdaptiveAlgorithm: true, subRules: [], conditions: [], fallback: { type: 'anyTopic' } },
    ],
    topicTimeSettings: { topic_spatial: 55 },
    restTimeBetweenRules: 15,
    passingScore: 70,
    createdAt: new Date('2026-06-09'),
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
    createdAt: new Date('2026-06-09'),
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
    createdAt: new Date('2026-06-09'),
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
    createdAt: new Date('2026-06-09'),
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
    createdAt: new Date('2026-06-09'),
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
    createdAt: new Date('2026-06-09'),
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
    createdAt: new Date('2026-06-09'),
    isActive: true,
  },
];

export const useAdminStore = create<AdminState>((set, get) => ({
  isAdmin: false,
  freePracticeLimit: 30,
  questions: [],
  topics: [],
  targets: [],
  templates: SEED_TEMPLATES.map(normalizeTemplateRules),
  selectedQuestionIds: [],
  practiceSettings: DEFAULT_PRACTICE_SETTINGS,
  examSettings: DEFAULT_EXAM_SETTINGS,
  premiumConfig: DEFAULT_PREMIUM_CONFIG,
  sessionHistory: [],
  appConfig: DEFAULT_APP_CONFIG,
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,
  dailyChallenges: [],
  userNotes: [],
  promoCodes: [],
  pushNotifications: [],
  revenueSnapshots: [],
  activityLog: [],
  generationSessions: [],
  generationPresets: [],
  bgGenRunning: false,
  bgGenProgress: null,

  setBgGenRunning: (val) => set({ bgGenRunning: val }),
  setBgGenProgress: (p) => set({ bgGenProgress: p }),

  setAppConfig: (updates) => {
    set(s => {
      const next = { ...s.appConfig, ...updates };
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, premiumConfig: s.premiumConfig, freePracticeLimit: s.freePracticeLimit, appConfig: next });
      return { appConfig: next };
    });
  },

  setFeatureFlag: (flag, value) => {
    set(s => {
      const next = { ...s.appConfig, featureFlags: { ...s.appConfig.featureFlags, [flag]: value } };
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, premiumConfig: s.premiumConfig, freePracticeLimit: s.freePracticeLimit, appConfig: next });
      return { appConfig: next };
    });
  },

  applyAppControlPreset: (preset) => {
    set(s => {
      const next = APP_CONTROL_PRESETS[preset].config;
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, premiumConfig: s.premiumConfig, freePracticeLimit: s.freePracticeLimit, appConfig: next });
      return { appConfig: next };
    });
    get().logActivity(`הופעל פריסט שליטה: ${APP_CONTROL_PRESETS[preset].label}`, 'system');
  },

  resetAppConfig: () => {
    set(s => {
      const next = DEFAULT_APP_CONFIG;
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, premiumConfig: s.premiumConfig, freePracticeLimit: s.freePracticeLimit, appConfig: next });
      return { appConfig: next };
    });
    get().logActivity('אופסו הגדרות מרכז השליטה לברירת מחדל', 'system');
  },

  addDailyChallenge: (challenge) => {
    const newC: DailyChallenge = { ...challenge, id: `dc_${Date.now()}` };
    set(s => ({ dailyChallenges: [...s.dailyChallenges, newC] }));
    saveAdminCollections(get());
    return newC;
  },

  updateDailyChallenge: (id, updates) => {
    set(s => ({
      dailyChallenges: s.dailyChallenges.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
    saveAdminCollections(get());
  },

  removeDailyChallenge: (id) => {
    set(s => ({ dailyChallenges: s.dailyChallenges.filter(c => c.id !== id) }));
    saveAdminCollections(get());
  },

  setUserNote: (userId, note) => {
    set(s => ({
      userNotes: [
        ...s.userNotes.filter(n => n.userId !== userId),
        { userId, note, updatedAt: new Date().toISOString() },
      ],
    }));
    saveAdminCollections(get());
  },

  getUserNote: (userId) => get().userNotes.find(n => n.userId === userId)?.note ?? '',

  setIsAdmin: (val) => set({ isAdmin: val }),

  setFreePracticeLimit: (n) => {
    const val = Math.max(5, Math.min(200, n));
    set({ freePracticeLimit: val });
    const s = get();
    saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, premiumConfig: s.premiumConfig, freePracticeLimit: val, appConfig: s.appConfig });
  },

  setPracticeSettings: (updates) => {
    set(s => {
      const next = { ...s.practiceSettings, ...updates };
      saveAdminSettings({ practiceSettings: next, examSettings: s.examSettings, premiumConfig: s.premiumConfig, freePracticeLimit: s.freePracticeLimit, appConfig: s.appConfig });
      return { practiceSettings: next };
    });
  },

  setExamSettings: (updates) => {
    set(s => {
      const next = { ...s.examSettings, ...updates };
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: next, premiumConfig: s.premiumConfig, freePracticeLimit: s.freePracticeLimit, appConfig: s.appConfig });
      return { examSettings: next };
    });
  },
  setPremiumConfig: (updates) => {
    set(s => {
      const next = withDefaultPremiumConfig({
        ...s.premiumConfig,
        ...updates,
        premiumFeatures: {
          ...s.premiumConfig.premiumFeatures,
          ...(updates.premiumFeatures ?? {}),
        },
      });
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, premiumConfig: next, freePracticeLimit: s.freePracticeLimit, appConfig: s.appConfig });
      return { premiumConfig: next };
    });
  },
  addSessionRecord: (record) => {
    set(s => ({ sessionHistory: [record, ...s.sessionHistory.slice(0, 499)] }));
    saveSessionRecord(record); // fire-and-forget to Supabase
  },
  loadSessionHistory: async (userId) => {
    const records = userId
      ? await loadUserSessionHistory(userId)
      : await loadAllSessionHistory();
    set(s => {
      const existingIds = new Set(s.sessionHistory.map(r => r.id));
      const fresh = records.filter(r => !existingIds.has(r.id));
      return { sessionHistory: [...s.sessionHistory, ...fresh] };
    });
  },
  getSessionsByUser: (userId) => get().sessionHistory.filter(r => r.userId === userId),

  login: async (email, password) => {
    // Try sign in first
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      // Verify it's the admin email
      if (data.user.email !== ADMIN_EMAIL) {
        await supabase.auth.signOut();
        return { ok: false, error: 'אין הרשאות מנהל' };
      }
      set({ isAdmin: true });
      get().loadAdminData(); // fire-and-forget — restore all persisted data
      return { ok: true };
    }
    // If user doesn't exist, create them (first-time setup)
    if (error?.message?.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (!signUpError && signUpData.user) {
        set({ isAdmin: true });
        get().loadAdminData();
        return { ok: true };
      }
      return { ok: false, error: signUpError?.message ?? 'שגיאת הרשמה' };
    }
    return { ok: false, error: error?.message ?? 'שגיאת התחברות' };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ isAdmin: false, selectedQuestionIds: [] });
  },

  addQuestion: (q) => {
    const newQ: Question = ensureSpatialVisualAssets({ ...q, id: `q_admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });
    set(s => ({ questions: [...s.questions, newQ] }));
    syncQuestionsToSupabase(set, [newQ], 'adminStore:addQuestion');
    get().logActivity(`הוסיף שאלה: "${newQ.questionText.slice(0, 40)}..."`, 'question');
    return newQ;
  },

  updateQuestion: (id, updates) => {
    set(s => {
      const updated = s.questions.map(q => (q.id === id ? ensureSpatialVisualAssets({ ...q, ...updates }) : q));
      const q = updated.find(x => x.id === id);
      if (q) syncQuestionsToSupabase(set, [q], 'adminStore:updateQuestion');
      return { questions: updated };
    });
    get().logActivity(`עדכן שאלה ${id}`, 'question');
  },

  deleteQuestion: async (id) => {
    await markQuestionDeletedLocally(id);
    adminRealtimeMutedUntil = Date.now() + ADMIN_REALTIME_SELF_WRITE_MUTE_MS;
    set(s => ({
      questions: s.questions.filter(q => q.id !== id),
      selectedQuestionIds: s.selectedQuestionIds.filter(i => i !== id),
      templates: s.templates.map(t => ({
        ...t,
        pinnedQuestionIds: (t.pinnedQuestionIds ?? []).filter(qId => qId !== id),
      })),
    }));
    const result = await dbDelete(id);
    if (result.error) {
      const message = `השאלה הוסרה מהניהול ונשמרה ברשימת מחיקות, אבל המחיקה הפיזית ב-Supabase דורשת בדיקה: ${result.error}`;
      set({ syncError: message, isSyncing: false });
      logger.error('adminStore:deleteQuestion', `מחיקה לוגית נשמרה, מחיקה פיזית נכשלה עבור ${id}`, result.error);
      get().logActivity(`מחק שאלה ${id} (מחיקה לוגית; נדרש אימות Supabase)`, 'question');
      await get().loadAdminData(true).catch(() => null);
      return { ok: true, error: message };
    }
    await saveTemplates(get().templates).catch(e => {
      logger.warn('adminStore:deleteQuestion', 'השאלה נמחקה אך ניקוי תבניות המבחן לא נשמר מיד.', e?.message);
    });
    logger.info('adminStore:deleteQuestion', `שאלה נמחקה: ${id}`);
    get().logActivity(`מחק שאלה ${id}`, 'question');
    await get().loadAdminData(true).catch(() => null);
    return { ok: true };
  },

  deleteQuestions: async (ids) => {
    const idSet = new Set(ids);
    await loadDeletedQuestionIds();
    ids.forEach(id => deletedQuestionIds.add(id));
    await persistDeletedQuestionIds();
    adminRealtimeMutedUntil = Date.now() + ADMIN_REALTIME_SELF_WRITE_MUTE_MS;
    set(s => ({
      questions: s.questions.filter(q => !idSet.has(q.id)),
      selectedQuestionIds: [],
      templates: s.templates.map(t => ({
        ...t,
        pinnedQuestionIds: (t.pinnedQuestionIds ?? []).filter(qId => !idSet.has(qId)),
      })),
    }));
    const results = await Promise.all(ids.map(id => dbDelete(id)));
    const failed = results
      .map((result, index) => ({ result, id: ids[index] }))
      .filter(row => row.result.error);
    if (failed.length > 0) {
      const message = failed.map(row => `${row.id}: ${row.result.error}`).join('\n');
      set({ syncError: `חלק מהשאלות הוסרו לוגית, אך המחיקה הפיזית דורשת בדיקה:\n${message}`, isSyncing: false });
      logger.error('adminStore:deleteQuestions', `מחיקה לוגית נשמרה; ${failed.length} מחיקות פיזיות נכשלו`, message);
      get().logActivity(`מחק ${ids.length} שאלות (מחיקה לוגית; ${failed.length} דורשות אימות Supabase)`, 'question');
      await get().loadAdminData(true).catch(() => null);
      return { ok: true, error: message };
    }
    await saveTemplates(get().templates).catch(e => {
      logger.warn('adminStore:deleteQuestions', 'השאלות נמחקו אך ניקוי תבניות המבחן לא נשמר מיד.', e?.message);
    });
    logger.info('adminStore:deleteQuestions', `${ids.length} שאלות נמחקו`);
    get().logActivity(`מחק ${ids.length} שאלות`, 'question');
    await get().loadAdminData(true).catch(() => null);
    return { ok: true };
  },

  validateQuestion: (id, status) => {
    set(s => {
      const updated = s.questions.map(q =>
        q.id === id
          ? ensureSpatialVisualAssets({ ...q, validationStatus: status, smartPracticeEligible: status === 'validated', generalPracticeEligible: status === 'validated' })
          : q
      );
      const q = updated.find(x => x.id === id);
      if (q) syncQuestionsToSupabase(set, [q], 'adminStore:validateQuestion');
      return { questions: updated };
    });
    get().logActivity(`אימת שאלה ${id} → ${status}`, 'question');
  },

  bulkValidate: (ids, status) => {
    const idSet = new Set(ids);
    let toSync: Question[] = [];
    set(s => {
      const updated = s.questions.map(q =>
        idSet.has(q.id)
          ? ensureSpatialVisualAssets({ ...q, validationStatus: status, generalPracticeEligible: status === 'validated', smartPracticeEligible: status === 'validated' })
          : q
      );
      toSync = updated.filter(q => idSet.has(q.id));
      return { questions: updated, selectedQuestionIds: [] };
    });
    syncQuestionsToSupabase(set, toSync, 'adminStore:bulkValidate');
    logger.info('adminStore:bulkValidate', `${ids.length} שאלות → ${status}`);
    get().logActivity(`אימות מרובה: ${ids.length} שאלות → ${status}`, 'question');
  },

  toggleSelectQuestion: (id) => {
    set(s => ({
      selectedQuestionIds: s.selectedQuestionIds.includes(id)
        ? s.selectedQuestionIds.filter(i => i !== id)
        : [...s.selectedQuestionIds, id],
    }));
  },

  clearSelection: () => set({ selectedQuestionIds: [] }),

  selectAll: () => {
    set(s => ({ selectedQuestionIds: s.questions.map(q => q.id) }));
  },

  assignQuestionsToTopic: (questionIds, topicId) => {
    const idSet = new Set(questionIds);
    let toSync: Question[] = [];
    set(s => {
      const updated = s.questions.map(q =>
        idSet.has(q.id) ? { ...q, topicId } : q
      );
      toSync = updated.filter(q => idSet.has(q.id));
      return { questions: updated };
    });
    syncQuestionsToSupabase(set, toSync, 'adminStore:assignQuestionsToTopic');
    logger.info('adminStore:assignQuestionsToTopic', `${questionIds.length} שאלות → נושא ${topicId}`);
  },

  setQuestionsAccessLevel: (questionIds, level) => {
    const idSet = new Set(questionIds);
    let toSync: Question[] = [];
    set(s => {
      const updated = s.questions.map(q =>
        idSet.has(q.id) ? { ...q, accessLevel: level } : q
      );
      toSync = updated.filter(q => idSet.has(q.id));
      return { questions: updated };
    });
    syncQuestionsToSupabase(set, toSync, 'adminStore:setQuestionsAccessLevel');
    logger.info('adminStore:setQuestionsAccessLevel', `${questionIds.length} שאלות → ${level}`);
  },

  assignQuestionsToTargets: (questionIds, targetIds) => {
    const idSet = new Set(questionIds);
    let toSync: Question[] = [];
    set(s => {
      const updated = s.questions.map(q =>
        idSet.has(q.id) ? { ...q, targetIds } : q
      );
      toSync = updated.filter(q => idSet.has(q.id));
      return { questions: updated };
    });
    syncQuestionsToSupabase(set, toSync, 'adminStore:assignQuestionsToTargets');
    logger.info('adminStore:assignQuestionsToTargets', `${questionIds.length} שאלות → מסלולים: ${targetIds.join(',')}`);
    get().logActivity(`שויכו ${questionIds.length} שאלות למסלולים: ${targetIds.join(', ')}`, 'question');
  },

  setQuestionsAdaptiveEligibility: (questionIds, smart, general) => {
    const idSet = new Set(questionIds);
    let toSync: Question[] = [];
    set(s => {
      const updated = s.questions.map(q =>
        idSet.has(q.id) ? { ...q, smartPracticeEligible: smart, generalPracticeEligible: general } : q
      );
      toSync = updated.filter(q => idSet.has(q.id));
      return { questions: updated };
    });
    syncQuestionsToSupabase(set, toSync, 'adminStore:setQuestionsAdaptiveEligibility');
    logger.info('adminStore:setQuestionsAdaptiveEligibility', `${questionIds.length} שאלות — חכם:${smart} כללי:${general}`);
    get().logActivity(`עודכנה כשירות אדפטיבית ל-${questionIds.length} שאלות`, 'question');
  },

  addTopic: (t) => {
    const newT: Topic = { ...t, id: `topic_admin_${Date.now()}` };
    set(s => ({ topics: [...s.topics, newT] }));
    trackAdminPersistence(set, dbUpsertTopic(newT), 'adminStore:addTopic', `נושא נשמר ב-Supabase: ${newT.name}`);
    get().logActivity(`הוסיף נושא: ${newT.name}`, 'system');
    return newT;
  },

  updateTopic: (id, updates) => {
    set(s => {
      const updated = s.topics.map(t => (t.id === id ? { ...t, ...updates } : t));
      const t = updated.find(x => x.id === id);
      if (t) trackAdminPersistence(set, dbUpsertTopic(t), 'adminStore:updateTopic', `נושא עודכן ב-Supabase: ${t.name}`);
      return { topics: updated };
    });
  },

  deleteTopic: (id) => {
    set(s => ({ topics: s.topics.filter(t => t.id !== id) }));
    trackAdminPersistence(set, deleteTopicFromDB(id), 'adminStore:deleteTopic', `נושא נמחק מ-Supabase: ${id}`);
    get().logActivity(`מחק נושא ${id}`, 'system');
  },

  updateTarget: (id, updates) => {
    set(s => {
      const targets = s.targets.map(t => (t.id === id ? { ...t, ...updates } : t));
      const target = targets.find(t => t.id === id);
      if (target) trackAdminPersistence(set, dbUpsertTarget(target), 'adminStore:updateTarget', `מסלול עודכן ב-Supabase: ${target.name}`);
      return { targets };
    });
  },

  addTemplate: (t) => {
    const newT = normalizeTemplateRules({
      ...t,
      id: `tmpl_${Date.now()}`,
      createdAt: new Date(),
    });
    set(s => {
      const next = [...s.templates, newT];
      trackAdminPersistence(set, saveTemplates(next), 'adminStore:addTemplate', `תבנית נשמרה: ${newT.name}`);
      return { templates: next };
    });
    get().logActivity(`יצר תבנית סימולציה: ${newT.name}`, 'system');
    return newT;
  },

  updateTemplate: (id, updates) => {
    set(s => {
      const next = s.templates.map(t => (t.id === id ? normalizeTemplateRules({ ...t, ...updates }) : t));
      trackAdminPersistence(set, saveTemplates(next), 'adminStore:updateTemplate', `תבנית עודכנה: ${id}`);
      return { templates: next };
    });
  },

  deleteTemplate: (id) => {
    set(s => {
      const next = s.templates.filter(t => t.id !== id);
      trackAdminPersistence(set, saveTemplates(next), 'adminStore:deleteTemplate', `תבנית נמחקה: ${id}`);
      return { templates: next };
    });
    get().logActivity(`מחק תבנית סימולציה ${id}`, 'system');
  },

  addTopicRuleToTemplate: (templateId, rule) => {
    set(s => {
      const templates = s.templates.map(t =>
        t.id === templateId
          ? normalizeTemplateRules({ ...t, rules: [...t.rules.filter(r => r.id !== rule.id), rule] })
          : t
      );
      trackAdminPersistence(set, saveTemplates(templates), 'adminStore:addTopicRuleToTemplate', `כלל תבנית נשמר: ${templateId}`);
      return { templates };
    });
  },

  removeTopicRuleFromTemplate: (templateId, ruleId) => {
    set(s => {
      const templates = s.templates.map(t =>
        t.id === templateId
          ? normalizeTemplateRules({ ...t, rules: t.rules.filter(r => r.id !== ruleId) })
          : t
      );
      trackAdminPersistence(set, saveTemplates(templates), 'adminStore:removeTopicRuleFromTemplate', `כלל תבנית הוסר: ${templateId}`);
      return { templates };
    });
  },

  pinQuestionToTemplate: (templateId, questionId) => {
    set(s => {
      const templates = s.templates.map(t =>
        t.id === templateId
          ? { ...t, pinnedQuestionIds: [...new Set([...(t.pinnedQuestionIds ?? []), questionId])] }
          : t
      );
      trackAdminPersistence(set, saveTemplates(templates), 'adminStore:pinQuestionToTemplate', `שאלה הוצמדה לתבנית: ${questionId}`);
      return { templates };
    });
  },

  unpinQuestionFromTemplate: (templateId, questionId) => {
    set(s => {
      const templates = s.templates.map(t =>
        t.id === templateId
          ? { ...t, pinnedQuestionIds: (t.pinnedQuestionIds ?? []).filter(id => id !== questionId) }
          : t
      );
      trackAdminPersistence(set, saveTemplates(templates), 'adminStore:unpinQuestionFromTemplate', `שאלה הוסרה מתבנית: ${questionId}`);
      return { templates };
    });
  },

  // ── Activity Log ──────────────────────────────────────────────────────────
  logActivity: (action, category) => {
    const entry: AdminActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      category,
      timestamp: new Date().toISOString(),
    };
    set(s => ({ activityLog: [entry, ...s.activityLog].slice(0, 500) }));
    const updated = get().activityLog;
    AsyncStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(updated)).catch(() => null);
    saveAdminCollections(get());
  },

  clearActivityLog: () => {
    set({ activityLog: [] });
    AsyncStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify([])).catch(() => null);
    saveAdminCollections(get());
  },

  // ── Promo Codes ────────────────────────────────────────────────────────────
  addPromoCode: (code) => {
    const newCode: PromoCode = {
      ...code,
      id: `promo_${Date.now()}`,
      createdAt: new Date().toISOString(),
      usedCount: 0,
    };
    set(s => ({ promoCodes: [...s.promoCodes, newCode] }));
    saveAdminCollections(get());
    get().logActivity(`הוסיף קוד קופון ${newCode.code}`, 'promo');
    return newCode;
  },

  updatePromoCode: (id, updates) => {
    set(s => ({ promoCodes: s.promoCodes.map(c => c.id === id ? { ...c, ...updates } : c) }));
    saveAdminCollections(get());
  },

  deletePromoCode: (id) => {
    const code = get().promoCodes.find(c => c.id === id);
    set(s => ({ promoCodes: s.promoCodes.filter(c => c.id !== id) }));
    saveAdminCollections(get());
    if (code) get().logActivity(`מחק קוד קופון ${code.code}`, 'promo');
  },

  togglePromoCode: (id) => {
    const code = get().promoCodes.find(c => c.id === id);
    if (!code) return;
    const newIsActive = !code.isActive;
    set(s => ({
      promoCodes: s.promoCodes.map(c => c.id === id ? { ...c, isActive: newIsActive } : c),
    }));
    saveAdminCollections(get());
    get().logActivity(`${newIsActive ? 'הפעיל' : 'הסתיר'} קוד קופון ${code.code}`, 'promo');
  },

  // ── Push Notifications ─────────────────────────────────────────────────────
  addPushNotification: (notif) => {
    const newNotif: PushNotification = {
      ...notif,
      id: `notif_${Date.now()}`,
      createdAt: new Date().toISOString(),
      sentAt: null,
      openRate: null,
    };
    set(s => ({ pushNotifications: [...s.pushNotifications, newNotif] }));
    saveAdminCollections(get());
    get().logActivity(`יצר הודעת Push: ${newNotif.title}`, 'notification');
    return newNotif;
  },

  updatePushNotification: (id, updates) => {
    set(s => ({ pushNotifications: s.pushNotifications.map(n => n.id === id ? { ...n, ...updates } : n) }));
    saveAdminCollections(get());
  },

  deletePushNotification: (id) => {
    const notif = get().pushNotifications.find(n => n.id === id);
    set(s => ({ pushNotifications: s.pushNotifications.filter(n => n.id !== id) }));
    saveAdminCollections(get());
    if (notif) get().logActivity(`מחק הודעת Push: ${notif.title}`, 'notification');
  },

  sendPushNotification: (id) => {
    const notif = get().pushNotifications.find(n => n.id === id);
    set(s => ({
      pushNotifications: s.pushNotifications.map(n =>
        n.id === id
          ? { ...n, status: 'sent', sentAt: new Date().toISOString(), openRate: null }
          : n
      ),
    }));
    saveAdminCollections(get());
    if (notif) get().logActivity(`שלח הודעת Push לכלל המשתמשים: ${notif.title}`, 'notification');
  },

  addGenerationSession: (s) => {
    const newSession: GenerationSession = {
      ...s,
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    set(state => ({
      generationSessions: [newSession, ...state.generationSessions].slice(0, 20),
    }));
    saveAdminCollections(get());
  },

  addGenerationPreset: (p) => {
    const newPreset: GenerationPreset = {
      ...p,
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    set(state => ({ generationPresets: [...state.generationPresets, newPreset] }));
    saveAdminCollections(get());
    return newPreset;
  },

  deleteGenerationPreset: (id) => {
    set(state => ({ generationPresets: state.generationPresets.filter(p => p.id !== id) }));
    saveAdminCollections(get());
  },

  getStats: () => {
    const { questions, topics, targets } = get();
    const questionsPerTopic: Record<string, number> = {};
    const questionsPerDifficulty: Record<number, number> = {};
    const questionsPerType: Record<string, number> = {};

    questions.forEach(q => {
      questionsPerTopic[q.topicId] = (questionsPerTopic[q.topicId] ?? 0) + 1;
      questionsPerDifficulty[q.difficulty] = (questionsPerDifficulty[q.difficulty] ?? 0) + 1;
      questionsPerType[q.questionType] = (questionsPerType[q.questionType] ?? 0) + 1;
    });

    const avgDifficulty = questions.length > 0
      ? Math.round(questions.reduce((s, q) => s + q.difficulty, 0) / questions.length * 10) / 10
      : 0;

    return {
      totalQuestions: questions.length,
      validatedCount: questions.filter(q => q.validationStatus === 'validated').length,
      pendingCount: questions.filter(q => q.validationStatus === 'pending').length,
      draftCount: questions.filter(q => q.validationStatus === 'draft').length,
      rejectedCount: questions.filter(q => q.validationStatus === 'rejected').length,
      questionsPerTopic,
      questionsPerDifficulty,
      questionsPerType,
      avgDifficulty,
      totalTargets: targets.length,
      totalTopics: topics.length,
    };
  },

  loadQuestionsFromSupabase: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      await loadDeletedQuestionIds();
      const questions = filterDeletedQuestions(await fetchAllQuestions());
      set({ questions });
      set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
    } catch (e: any) {
      const message = e?.message ?? 'Failed to load questions';
      set({ isSyncing: false, syncError: message });
      throw e;
    }
  },

  seedToSupabase: () => seedDatabase(),

  loadAdminData: async (force = false) => {
    if (adminDataLoadPromise) return adminDataLoadPromise;

    const now = Date.now();
    const recentlyLoaded = now - lastAdminDataLoadStartedAt < ADMIN_RELOAD_MIN_INTERVAL_MS;
    if (!force && recentlyLoaded && get().lastSyncedAt) return;

    lastAdminDataLoadStartedAt = now;
    adminDataLoadPromise = (async () => {
      logger.info('adminStore:loadAdminData', 'טוען נתוני אדמין...');
      set({ isSyncing: true, syncError: null });

      // 1. Load all questions from Supabase. In admin, Supabase is the source of truth.
      try {
        await loadDeletedQuestionIds();
        const remote = filterDeletedQuestions(await fetchAllQuestions());
        set({ questions: remote });
        logger.success('adminStore:loadAdminData', `Loaded ${remote.length} questions from Supabase`);
      } catch (e: any) {
        logger.error('adminStore:loadAdminData', 'Failed loading questions', e?.message);
        set({ questions: [] });
      }

      // 2. Load targets and topics from Supabase. Admin views must not mask DB issues with mock data.
      try {
        const remoteTargets = await fetchTargets();
        set({ targets: remoteTargets });
      } catch (e: any) {
        logger.error('adminStore:loadAdminData', 'Failed loading targets', e?.message);
        set({ targets: [] });
      }

      try {
        const remoteTopics = await fetchTopics();
        set({ topics: remoteTopics });
      } catch (e: any) {
        logger.error('adminStore:loadAdminData', 'Failed loading topics', e?.message);
        set({ topics: [] });
      }

      // 3. Load simulation templates from AsyncStorage
      try {
        const templates = await loadTemplates();
        if (templates && templates.length > 0) {
          const normalizedTemplates = templates.map(normalizeTemplateRules);
          set({ templates: normalizedTemplates });
        }
      } catch (e: any) {
        logger.error('adminStore:loadAdminData', 'שגיאה בטעינת תבניות', e?.message);
      }

      // 4. Load admin settings from AsyncStorage
      try {
        const settings = await loadAdminSettings();
        if (settings) {
          if (settings.practiceSettings) set({ practiceSettings: settings.practiceSettings });
          if (settings.examSettings) set({ examSettings: settings.examSettings });
          if (settings.premiumConfig) set({ premiumConfig: withDefaultPremiumConfig(settings.premiumConfig) });
          if (settings.freePracticeLimit) set({ freePracticeLimit: settings.freePracticeLimit });
          if (settings.appConfig) set({ appConfig: withDefaultAppConfig(settings.appConfig) });
        }
      } catch (e: any) {
        logger.error('adminStore:loadAdminData', 'שגיאה בטעינת הגדרות', e?.message);
      }

      // 5. Load synced admin collections from Supabase when available.
      try {
        const collections = normalizeAdminCollections(await loadAdminState<any>(ADMIN_COLLECTIONS_KEY));
        if (collections) {
          set(collections);
        }
      } catch (e: any) {
        logger.error('adminStore:loadAdminData', 'שגיאה בטעינת אוספי אדמין', e?.message);
      }

      // 6. Revenue snapshots are derived from real profiles only. MRR stays 0
      // until a real purchases/subscriptions table is connected.
      try {
        const revenueSnapshots = await buildRevenueSnapshotsFromProfiles();
        set({ revenueSnapshots });
      } catch (e: any) {
        logger.error('adminStore:loadAdminData', 'Failed building revenue snapshots from real profiles', e?.message);
        set({ revenueSnapshots: [] });
      }

      // 7. Load real practice sessions, including guest sessions.
      try {
        const sessionHistory = await loadAllSessionHistory(800);
        set({ sessionHistory });
      } catch (e: any) {
        logger.error('adminStore:loadAdminData', 'שגיאה בטעינת היסטוריית סשנים', e?.message);
      }

      // 8. Load persisted activityLog from AsyncStorage
      try {
        const saved = await AsyncStorage.getItem(ACTIVITY_LOG_KEY);
        if (saved) {
          const parsed: AdminActivityLog[] = JSON.parse(saved).filter((item: AdminActivityLog) =>
            !/^log_00[1-8]$/.test(String(item?.id ?? ''))
          );
          if (parsed.length > 0) {
            set(s => {
              const existingIds = new Set(s.activityLog.map(l => l.id));
              const fresh = parsed.filter(l => !existingIds.has(l.id));
              return { activityLog: [...s.activityLog, ...fresh].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500) };
            });
          }
        }
      } catch {}

      set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
      logger.success('adminStore:loadAdminData', 'טעינת נתוני אדמין הושלמה');
    })().finally(() => {
      adminDataLoadPromise = null;
    });

    return adminDataLoadPromise;
  },

  syncAll: async () => {
    try {
      await get().loadAdminData(true);
      get().logActivity('סנכרון מלא הופעל מפאנל הניהול', 'system');
      return { ok: true, message: 'כל נתוני הניהול סונכרנו בהצלחה.' };
    } catch (e: any) {
      const message = e?.message ?? 'שגיאה בסנכרון מלא';
      set({ isSyncing: false, syncError: message });
      return { ok: false, message };
    }
  },

  startRealtimeSync: () => {
    if (adminRealtimeChannel) return;
    const scheduleReload = () => {
      if (Date.now() < adminRealtimeMutedUntil) return;
      if (adminRealtimeReloadTimer) clearTimeout(adminRealtimeReloadTimer);
      adminRealtimeReloadTimer = setTimeout(() => {
        if (Date.now() < adminRealtimeMutedUntil) return;
        get().loadAdminData().catch((e: any) => {
          const message = e?.message ?? 'Realtime sync failed';
          set({ syncError: message, isSyncing: false });
        });
      }, ADMIN_REALTIME_RELOAD_DEBOUNCE_MS);
    };

    adminRealtimeChannel = supabase
      .channel('psychotechniplus-admin-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_state' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_sessions' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topics' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'targets' }, scheduleReload)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          set({ syncError: null, lastSyncedAt: new Date().toISOString() });
          logger.info('adminStore:realtime', 'Live Supabase sync is active');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          set({ syncError: `Realtime sync status: ${status}` });
          logger.warn('adminStore:realtime', `Live sync status: ${status}`);
        }
      });
  },

  stopRealtimeSync: () => {
    if (adminRealtimeReloadTimer) {
      clearTimeout(adminRealtimeReloadTimer);
      adminRealtimeReloadTimer = null;
    }
    if (adminRealtimeChannel) {
      supabase.removeChannel(adminRealtimeChannel);
      adminRealtimeChannel = null;
    }
  },

  getPendingQuestions: () => get().questions.filter(q => q.validationStatus === 'pending'),
  getQuestionsByStatus: (status) => get().questions.filter(q => q.validationStatus === status),
}));

