import { create } from 'zustand';
import { Question, Topic, Target, ValidationStatus, QuestionType, AccessLevel } from '../data/types';
import { TOPICS, TARGETS } from '../data/mockData';
import { fetchAllQuestions, upsertQuestion as dbUpsert, deleteQuestion as dbDelete, seedDatabase, saveSessionRecord, loadUserSessionHistory, loadAllSessionHistory, SessionRecord, upsertTopic as dbUpsertTopic, deleteTopicFromDB, saveTemplates, loadTemplates, saveAdminSettings, loadAdminSettings, fetchTopics } from '../lib/db';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVITY_LOG_KEY = '@psychotechniplus/admin/activityLog';
const PROMO_CODES_KEY = '@psychotechniplus/admin/promoCodes';
const DAILY_CHALLENGES_KEY = '@psychotechniplus/admin/dailyChallenges';
const PUSH_NOTIFICATIONS_KEY = '@psychotechniplus/admin/pushNotifications';
const INBOX_MESSAGES_KEY = '@psychotechniplus/admin/inboxMessages';

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
    explanation: 'אם כולם בקבוצה שיחקו, ויוסי לא שיחק — יוסי אינו חלק מהקבוצה.',
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
    explanation: '2^10 = 1024, 10^3 = 1000. לכן 2^10 > 10^3.',
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
    speedMode: false,
    streakMode: false,
    simulations: true,
    unlimitedQuestions: true,
    adaptiveAlgorithm: true,
    detailedAnalytics: true,
    dailyChallenge: true,
    allTopics: false,
  },
  freeUserDailyQuestionLimit: 30,
  freeUserMaxDifficulty: 6,
  freeUserSessionLimit: 3,
  freePremiumTopics: [],
  trialDays: 7,
  paywallTitle: 'שדרג לפרמיום',
  paywallSubtitle: 'קבל גישה מלאה לכל הכלים',
};

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

// ── In-App Inbox Messages ──────────────────────────────────────────────────
export interface InboxMessage {
  id: string;
  title: string;
  body: string;
  icon: string;
  targetType: 'all' | 'free' | 'premium' | 'specific';
  targetUserIds: string[];
  sentAt: string;
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
    estimatedReach: 2612,
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
    estimatedReach: 167,
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
    estimatedReach: 340,
    openRate: null,
    createdAt: '2025-05-17T16:00:00Z',
  },
];

const SEED_REVENUE_SNAPSHOTS: RevenueSnapshot[] = [
  { month: '2025-01', mrr: 890, newSubscribers: 12, churnedSubscribers: 2, totalPremiumUsers: 45, conversionRate: 0.031 },
  { month: '2025-02', mrr: 1180, newSubscribers: 18, churnedSubscribers: 3, totalPremiumUsers: 60, conversionRate: 0.038 },
  { month: '2025-03', mrr: 1540, newSubscribers: 24, churnedSubscribers: 4, totalPremiumUsers: 80, conversionRate: 0.042 },
  { month: '2025-04', mrr: 1920, newSubscribers: 30, churnedSubscribers: 5, totalPremiumUsers: 105, conversionRate: 0.051 },
  { month: '2025-05', mrr: 2310, newSubscribers: 35, churnedSubscribers: 6, totalPremiumUsers: 134, conversionRate: 0.058 },
  { month: '2025-06', mrr: 2780, newSubscribers: 40, churnedSubscribers: 7, totalPremiumUsers: 167, conversionRate: 0.064 },
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
  sessionHistory: SessionRecord[];
  appConfig: AppConfig;
  dailyChallenges: DailyChallenge[];
  userNotes: UserNote[];

  // New fields
  promoCodes: PromoCode[];
  pushNotifications: PushNotification[];
  inboxMessages: InboxMessage[];
  revenueSnapshots: RevenueSnapshot[];
  activityLog: AdminActivityLog[];

  // Actions — app config
  setAppConfig: (updates: Partial<AppConfig>) => void;
  setFeatureFlag: (flag: keyof AppConfig['featureFlags'], value: boolean) => void;

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
  addSessionRecord: (record: SessionRecord) => void;
  loadSessionHistory: (userId?: string) => Promise<void>;
  getSessionsByUser: (userId: string) => SessionRecord[];
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Actions — questions
  addQuestion: (q: Omit<Question, 'id'>) => Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  deleteQuestions: (ids: string[]) => void;
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

  // Actions — inbox messages
  addInboxMessage: (msg: Omit<InboxMessage, 'id' | 'createdAt' | 'sentAt'>) => InboxMessage;
  deleteInboxMessage: (id: string) => void;

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
  loadAdminData: () => Promise<void>;

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
];

export const useAdminStore = create<AdminState>((set, get) => ({
  isAdmin: false,
  freePracticeLimit: 30,
  questions: [...PENDING_SEED],
  topics: [...TOPICS],
  targets: [...TARGETS],
  templates: SEED_TEMPLATES,
  selectedQuestionIds: [],
  practiceSettings: DEFAULT_PRACTICE_SETTINGS,
  examSettings: DEFAULT_EXAM_SETTINGS,
  sessionHistory: [],
  appConfig: DEFAULT_APP_CONFIG,
  dailyChallenges: [],
  userNotes: [],
  promoCodes: SEED_PROMO_CODES,
  pushNotifications: SEED_PUSH_NOTIFICATIONS,
  inboxMessages: [],
  revenueSnapshots: SEED_REVENUE_SNAPSHOTS,
  activityLog: SEED_ACTIVITY_LOG,
  generationSessions: SEED_GENERATION_SESSIONS,
  generationPresets: SEED_GENERATION_PRESETS,
  bgGenRunning: false,
  bgGenProgress: null,

  setBgGenRunning: (val) => set({ bgGenRunning: val }),
  setBgGenProgress: (p) => set({ bgGenProgress: p }),

  setAppConfig: (updates) => {
    set(s => {
      const next = { ...s.appConfig, ...updates };
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, freePracticeLimit: s.freePracticeLimit, appConfig: next });
      return { appConfig: next };
    });
  },

  setFeatureFlag: (flag, value) => {
    set(s => {
      const next = { ...s.appConfig, featureFlags: { ...s.appConfig.featureFlags, [flag]: value } };
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, freePracticeLimit: s.freePracticeLimit, appConfig: next });
      return { appConfig: next };
    });
  },

  addDailyChallenge: (challenge) => {
    const newC: DailyChallenge = { ...challenge, id: `dc_${Date.now()}` };
    set(s => {
      const next = [...s.dailyChallenges, newC];
      AsyncStorage.setItem(DAILY_CHALLENGES_KEY, JSON.stringify(next)).catch(() => null);
      return { dailyChallenges: next };
    });
    return newC;
  },

  updateDailyChallenge: (id, updates) => {
    set(s => {
      const next = s.dailyChallenges.map(c => c.id === id ? { ...c, ...updates } : c);
      AsyncStorage.setItem(DAILY_CHALLENGES_KEY, JSON.stringify(next)).catch(() => null);
      return { dailyChallenges: next };
    });
  },

  removeDailyChallenge: (id) => {
    set(s => {
      const next = s.dailyChallenges.filter(c => c.id !== id);
      AsyncStorage.setItem(DAILY_CHALLENGES_KEY, JSON.stringify(next)).catch(() => null);
      return { dailyChallenges: next };
    });
  },

  setUserNote: (userId, note) =>
    set(s => ({
      userNotes: [
        ...s.userNotes.filter(n => n.userId !== userId),
        { userId, note, updatedAt: new Date().toISOString() },
      ],
    })),

  getUserNote: (userId) => get().userNotes.find(n => n.userId === userId)?.note ?? '',

  setIsAdmin: (val) => set({ isAdmin: val }),

  setFreePracticeLimit: (n) => {
    const val = Math.max(5, Math.min(200, n));
    set({ freePracticeLimit: val });
    const s = get();
    saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: s.examSettings, freePracticeLimit: val, appConfig: s.appConfig });
  },

  setPracticeSettings: (updates) => {
    set(s => {
      const next = { ...s.practiceSettings, ...updates };
      saveAdminSettings({ practiceSettings: next, examSettings: s.examSettings, freePracticeLimit: s.freePracticeLimit, appConfig: s.appConfig });
      return { practiceSettings: next };
    });
  },

  setExamSettings: (updates) => {
    set(s => {
      const next = { ...s.examSettings, ...updates };
      saveAdminSettings({ practiceSettings: s.practiceSettings, examSettings: next, freePracticeLimit: s.freePracticeLimit, appConfig: s.appConfig });
      return { examSettings: next };
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
    const newQ: Question = { ...q, id: `q_admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
    set(s => ({ questions: [...s.questions, newQ] }));
    dbUpsert(newQ).then(r => {
      if (r.error) logger.error('adminStore:addQuestion', `שגיאה בשמירת שאלה חדשה`, r.error);
      else logger.success('adminStore:addQuestion', `שאלה נוצרה: ${newQ.id}`);
    });
    get().logActivity(`הוסיף שאלה: "${newQ.questionText.slice(0, 40)}..."`, 'question');
    return newQ;
  },

  updateQuestion: (id, updates) => {
    set(s => {
      const updated = s.questions.map(q => (q.id === id ? { ...q, ...updates } : q));
      const q = updated.find(x => x.id === id);
      if (q) dbUpsert(q).then(r => {
        if (r.error) logger.error('adminStore:updateQuestion', `שגיאה בעדכון שאלה ${id}`, r.error);
        else logger.success('adminStore:updateQuestion', `שאלה עודכנה: ${id}`);
      });
      return { questions: updated };
    });
    get().logActivity(`עדכן שאלה ${id}`, 'question');
  },

  deleteQuestion: (id) => {
    set(s => ({
      questions: s.questions.filter(q => q.id !== id),
      selectedQuestionIds: s.selectedQuestionIds.filter(i => i !== id),
    }));
    dbDelete(id);
    logger.info('adminStore:deleteQuestion', `שאלה נמחקה: ${id}`);
    get().logActivity(`מחק שאלה ${id}`, 'question');
  },

  deleteQuestions: (ids) => {
    const idSet = new Set(ids);
    set(s => ({
      questions: s.questions.filter(q => !idSet.has(q.id)),
      selectedQuestionIds: [],
    }));
    ids.forEach(id => dbDelete(id));
    logger.info('adminStore:deleteQuestions', `${ids.length} שאלות נמחקו`);
    get().logActivity(`מחק ${ids.length} שאלות`, 'question');
  },

  validateQuestion: (id, status) => {
    set(s => {
      const updated = s.questions.map(q =>
        q.id === id
          ? { ...q, validationStatus: status, smartPracticeEligible: status === 'validated', generalPracticeEligible: status === 'validated' }
          : q
      );
      const q = updated.find(x => x.id === id);
      if (q) dbUpsert(q).then(r => {
        if (r.error) logger.error('adminStore:validateQuestion', `שגיאה באימות שאלה ${id} → ${status}`, r.error);
        else logger.success('adminStore:validateQuestion', `שאלה ${id} → ${status}`);
      });
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
          ? { ...q, validationStatus: status, generalPracticeEligible: status === 'validated', smartPracticeEligible: status === 'validated' }
          : q
      );
      toSync = updated.filter(q => idSet.has(q.id));
      return { questions: updated, selectedQuestionIds: [] };
    });
    toSync.forEach(q => dbUpsert(q).then(r => {
      if (r.error) logger.error('adminStore:bulkValidate', `שגיאה בעדכון שאלה ${q.id}`, r.error);
    }));
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
    toSync.forEach(q => dbUpsert(q).then(r => {
      if (r.error) logger.error('adminStore:assignQuestionsToTopic', `שגיאה בהקצאת שאלה ${q.id}`, r.error);
    }));
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
    toSync.forEach(q => dbUpsert(q).then(r => {
      if (r.error) logger.error('adminStore:setQuestionsAccessLevel', `שגיאה בעדכון גישה לשאלה ${q.id}`, r.error);
    }));
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
    toSync.forEach(q => dbUpsert(q).then(r => {
      if (r.error) logger.error('adminStore:assignQuestionsToTargets', `שגיאה בהקצאת מסלול לשאלה ${q.id}`, r.error);
    }));
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
    toSync.forEach(q => dbUpsert(q).then(r => {
      if (r.error) logger.error('adminStore:setQuestionsAdaptiveEligibility', `שגיאה בעדכון אדפטיבי לשאלה ${q.id}`, r.error);
    }));
    logger.info('adminStore:setQuestionsAdaptiveEligibility', `${questionIds.length} שאלות — חכם:${smart} כללי:${general}`);
    get().logActivity(`עודכנה כשירות אדפטיבית ל-${questionIds.length} שאלות`, 'question');
  },

  addTopic: (t) => {
    const newT: Topic = { ...t, id: `topic_admin_${Date.now()}` };
    set(s => ({ topics: [...s.topics, newT] }));
    dbUpsertTopic(newT);
    get().logActivity(`הוסיף נושא: ${newT.name}`, 'system');
    return newT;
  },

  updateTopic: (id, updates) => {
    set(s => {
      const updated = s.topics.map(t => (t.id === id ? { ...t, ...updates } : t));
      const t = updated.find(x => x.id === id);
      if (t) dbUpsertTopic(t);
      return { topics: updated };
    });
  },

  deleteTopic: (id) => {
    set(s => ({ topics: s.topics.filter(t => t.id !== id) }));
    deleteTopicFromDB(id);
    get().logActivity(`מחק נושא ${id}`, 'system');
  },

  updateTarget: (id, updates) => {
    set(s => ({
      targets: s.targets.map(t => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  addTemplate: (t) => {
    const newT: SmartExamTemplate = {
      ...t,
      id: `tmpl_${Date.now()}`,
      createdAt: new Date(),
    };
    set(s => {
      const next = [...s.templates, newT];
      saveTemplates(next);
      return { templates: next };
    });
    get().logActivity(`יצר תבנית סימולציה: ${newT.name}`, 'system');
    return newT;
  },

  updateTemplate: (id, updates) => {
    set(s => {
      const next = s.templates.map(t => (t.id === id ? { ...t, ...updates } : t));
      saveTemplates(next);
      return { templates: next };
    });
  },

  deleteTemplate: (id) => {
    set(s => {
      const next = s.templates.filter(t => t.id !== id);
      saveTemplates(next);
      return { templates: next };
    });
    get().logActivity(`מחק תבנית סימולציה ${id}`, 'system');
  },

  addTopicRuleToTemplate: (templateId, rule) => {
    set(s => ({
      templates: s.templates.map(t =>
        t.id === templateId
          ? { ...t, rules: [...t.rules.filter(r => r.id !== rule.id), rule] }
          : t
      ),
    }));
  },

  removeTopicRuleFromTemplate: (templateId, ruleId) => {
    set(s => ({
      templates: s.templates.map(t =>
        t.id === templateId
          ? { ...t, rules: t.rules.filter(r => r.id !== ruleId) }
          : t
      ),
    }));
  },

  pinQuestionToTemplate: (templateId, questionId) => {
    set(s => ({
      templates: s.templates.map(t =>
        t.id === templateId
          ? { ...t, pinnedQuestionIds: [...new Set([...(t.pinnedQuestionIds ?? []), questionId])] }
          : t
      ),
    }));
  },

  unpinQuestionFromTemplate: (templateId, questionId) => {
    set(s => ({
      templates: s.templates.map(t =>
        t.id === templateId
          ? { ...t, pinnedQuestionIds: (t.pinnedQuestionIds ?? []).filter(id => id !== questionId) }
          : t
      ),
    }));
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
  },

  clearActivityLog: () => set({ activityLog: [] }),

  // ── Promo Codes ────────────────────────────────────────────────────────────
  addPromoCode: (code) => {
    const newCode: PromoCode = {
      ...code,
      id: `promo_${Date.now()}`,
      createdAt: new Date().toISOString(),
      usedCount: 0,
    };
    set(s => {
      const next = [...s.promoCodes, newCode];
      AsyncStorage.setItem(PROMO_CODES_KEY, JSON.stringify(next)).catch(() => null);
      return { promoCodes: next };
    });
    get().logActivity(`הוסיף קוד קופון ${newCode.code}`, 'promo');
    return newCode;
  },

  updatePromoCode: (id, updates) => {
    set(s => {
      const next = s.promoCodes.map(c => c.id === id ? { ...c, ...updates } : c);
      AsyncStorage.setItem(PROMO_CODES_KEY, JSON.stringify(next)).catch(() => null);
      return { promoCodes: next };
    });
  },

  deletePromoCode: (id) => {
    const code = get().promoCodes.find(c => c.id === id);
    set(s => {
      const next = s.promoCodes.filter(c => c.id !== id);
      AsyncStorage.setItem(PROMO_CODES_KEY, JSON.stringify(next)).catch(() => null);
      return { promoCodes: next };
    });
    if (code) get().logActivity(`מחק קוד קופון ${code.code}`, 'promo');
  },

  togglePromoCode: (id) => {
    const code = get().promoCodes.find(c => c.id === id);
    if (!code) return;
    const newIsActive = !code.isActive;
    set(s => {
      const next = s.promoCodes.map(c => c.id === id ? { ...c, isActive: newIsActive } : c);
      AsyncStorage.setItem(PROMO_CODES_KEY, JSON.stringify(next)).catch(() => null);
      return { promoCodes: next };
    });
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
    set(s => {
      const next = [...s.pushNotifications, newNotif];
      AsyncStorage.setItem(PUSH_NOTIFICATIONS_KEY, JSON.stringify(next)).catch(() => null);
      return { pushNotifications: next };
    });
    get().logActivity(`יצר הודעת Push: ${newNotif.title}`, 'notification');
    return newNotif;
  },

  updatePushNotification: (id, updates) => {
    set(s => {
      const next = s.pushNotifications.map(n => n.id === id ? { ...n, ...updates } : n);
      AsyncStorage.setItem(PUSH_NOTIFICATIONS_KEY, JSON.stringify(next)).catch(() => null);
      return { pushNotifications: next };
    });
  },

  deletePushNotification: (id) => {
    const notif = get().pushNotifications.find(n => n.id === id);
    set(s => {
      const next = s.pushNotifications.filter(n => n.id !== id);
      AsyncStorage.setItem(PUSH_NOTIFICATIONS_KEY, JSON.stringify(next)).catch(() => null);
      return { pushNotifications: next };
    });
    if (notif) get().logActivity(`מחק הודעת Push: ${notif.title}`, 'notification');
  },

  sendPushNotification: (id) => {
    const notif = get().pushNotifications.find(n => n.id === id);
    set(s => {
      const next = s.pushNotifications.map(n =>
        n.id === id
          ? { ...n, status: 'sent' as const, sentAt: new Date().toISOString(), openRate: null }
          : n
      );
      AsyncStorage.setItem(PUSH_NOTIFICATIONS_KEY, JSON.stringify(next)).catch(() => null);
      return { pushNotifications: next };
    });
    if (notif) get().logActivity(`שלח הודעת Push: ${notif.title}`, 'notification');
  },

  addInboxMessage: (msg) => {
    const now = new Date().toISOString();
    const newMsg: InboxMessage = {
      ...msg,
      id: `inbox_${Date.now()}`,
      createdAt: now,
      sentAt: now,
    };
    set(s => {
      const next = [newMsg, ...s.inboxMessages];
      AsyncStorage.setItem(INBOX_MESSAGES_KEY, JSON.stringify(next)).catch(() => null);
      return { inboxMessages: next };
    });
    get().logActivity(`הודעה נשלחה: ${msg.title}`, 'notification');
    return newMsg;
  },

  deleteInboxMessage: (id) => {
    set(s => {
      const next = s.inboxMessages.filter(m => m.id !== id);
      AsyncStorage.setItem(INBOX_MESSAGES_KEY, JSON.stringify(next)).catch(() => null);
      return { inboxMessages: next };
    });
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
  },

  addGenerationPreset: (p) => {
    const newPreset: GenerationPreset = {
      ...p,
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    set(state => ({ generationPresets: [...state.generationPresets, newPreset] }));
    return newPreset;
  },

  deleteGenerationPreset: (id) => {
    set(state => ({ generationPresets: state.generationPresets.filter(p => p.id !== id) }));
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
    const questions = await fetchAllQuestions();
    if (questions.length > 0) set({ questions });
  },

  seedToSupabase: () => seedDatabase(),

  loadAdminData: async () => {
    logger.info('adminStore:loadAdminData', 'טוען נתוני אדמין...');

    // 0. Seed PENDING_SEED questions to Supabase if they don't exist yet
    // (ensureDbSeeded in _layout.tsx already handles targets+topics)
    try {
      const { data: check } = await supabase.from('questions')
        .select('id').eq('id', PENDING_SEED[0].id).limit(1);
      if (!check?.length) {
        for (const q of PENDING_SEED) {
          await dbUpsert(q);
        }
        logger.success('adminStore:loadAdminData', `נזרעו ${PENDING_SEED.length} שאלות ממתינות`);
      }
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בהזרעת שאלות ממתינות', e?.message);
    }

    // 1. Load all questions from Supabase (includes any admin-created ones).
    // Merge with local state: local 'validated'/'rejected' questions take precedence
    // over Supabase to avoid overwriting optimistic updates that haven't flushed yet.
    try {
      const remote = await fetchAllQuestions();
      if (remote.length > 0) {
        set(s => {
          const localOverrides = new Map(
            s.questions
              .filter(q => q.validationStatus === 'validated' || q.validationStatus === 'rejected')
              .map(q => [q.id, q])
          );
          const merged = remote.map(q => localOverrides.get(q.id) ?? q);
          // Append any locally-created questions not yet in Supabase
          const remoteIds = new Set(remote.map(q => q.id));
          const localOnly = s.questions.filter(q => !remoteIds.has(q.id));
          logger.success('adminStore:loadAdminData', `נטענו ${remote.length} שאלות (${localOnly.length} מקומיות בלבד)`);
          return { questions: [...merged, ...localOnly] };
        });
      }
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בטעינת שאלות', e?.message);
    }

    // 2. Load topics from Supabase (includes admin-created topics), merge with local
    try {
      const remoteTopics = await fetchTopics();
      if (remoteTopics.length > 0) {
        set(s => {
          const remoteIds = new Set(remoteTopics.map(t => t.id));
          const localOnly = s.topics.filter(t => !remoteIds.has(t.id));
          if (localOnly.length > 0) {
            logger.info('adminStore:loadAdminData', `${localOnly.length} נושאים מקומיים לא ב-Supabase עדיין`);
          }
          return { topics: [...remoteTopics, ...localOnly] };
        });
      }
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בטעינת נושאים', e?.message);
    }

    // 3. Load simulation templates from AsyncStorage
    try {
      const templates = await loadTemplates();
      if (templates && templates.length > 0) set({ templates });
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בטעינת תבניות', e?.message);
    }

    // 4. Load admin settings from AsyncStorage
    try {
      const settings = await loadAdminSettings();
      if (settings) {
        if (settings.practiceSettings) set({ practiceSettings: settings.practiceSettings });
        if (settings.examSettings) set({ examSettings: settings.examSettings });
        if (settings.freePracticeLimit) set({ freePracticeLimit: settings.freePracticeLimit });
        if (settings.appConfig) set({ appConfig: settings.appConfig });
      }
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בטעינת הגדרות', e?.message);
    }

    // 5. Load persisted activityLog from AsyncStorage
    try {
      const saved = await AsyncStorage.getItem(ACTIVITY_LOG_KEY);
      if (saved) {
        const parsed: AdminActivityLog[] = JSON.parse(saved);
        if (parsed.length > 0) {
          set(s => {
            const existingIds = new Set(s.activityLog.map(l => l.id));
            const fresh = parsed.filter(l => !existingIds.has(l.id));
            return { activityLog: [...s.activityLog, ...fresh].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500) };
          });
        }
      }
    } catch {}

    // 6. Load persisted promo codes from AsyncStorage
    try {
      const savedCodes = await AsyncStorage.getItem(PROMO_CODES_KEY);
      if (savedCodes) {
        const parsed: PromoCode[] = JSON.parse(savedCodes);
        if (parsed.length > 0) set({ promoCodes: parsed });
      }
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בטעינת קודי קופון', e?.message);
    }

    // 7. Load persisted daily challenges from AsyncStorage
    try {
      const savedChallenges = await AsyncStorage.getItem(DAILY_CHALLENGES_KEY);
      if (savedChallenges) {
        const parsed: DailyChallenge[] = JSON.parse(savedChallenges);
        if (parsed.length > 0) set({ dailyChallenges: parsed });
      }
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בטעינת אתגרים יומיים', e?.message);
    }

    // 8. Load persisted push notifications from AsyncStorage
    try {
      const savedNotifs = await AsyncStorage.getItem(PUSH_NOTIFICATIONS_KEY);
      if (savedNotifs) {
        const parsed: PushNotification[] = JSON.parse(savedNotifs);
        if (parsed.length > 0) set({ pushNotifications: parsed });
      }
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בטעינת הודעות Push', e?.message);
    }

    // 9. Load persisted inbox messages from AsyncStorage
    try {
      const savedInbox = await AsyncStorage.getItem(INBOX_MESSAGES_KEY);
      if (savedInbox) {
        const parsed: InboxMessage[] = JSON.parse(savedInbox);
        if (parsed.length > 0) set({ inboxMessages: parsed });
      }
    } catch (e: any) {
      logger.error('adminStore:loadAdminData', 'שגיאה בטעינת הודעות תיבת דואר', e?.message);
    }

    logger.success('adminStore:loadAdminData', 'טעינת נתוני אדמין הושלמה');
  },

  getPendingQuestions: () => get().questions.filter(q => q.validationStatus === 'pending'),
  getQuestionsByStatus: (status) => get().questions.filter(q => q.validationStatus === status),
}));
