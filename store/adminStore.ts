import { create } from 'zustand';
import { Question, Topic, Target, ValidationStatus, QuestionType, AccessLevel } from '../data/types';
import { QUESTIONS, TOPICS, TARGETS } from '../data/mockData';
import { fetchAllQuestions, upsertQuestion as dbUpsert, deleteQuestion as dbDelete, seedDatabase, saveSessionRecord, loadUserSessionHistory, loadAllSessionHistory, SessionRecord } from '../lib/db';
import { supabase } from '../lib/supabase';

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
  setQuestionsAccessLevel: (questionIds: string[], level: AccessLevel) => void;

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

  // Supabase sync
  loadQuestionsFromSupabase: () => Promise<void>;
  seedToSupabase: () => Promise<{ ok: boolean; message: string }>;

  // Computed
  getStats: () => AdminStats;
  getPendingQuestions: () => Question[];
  getQuestionsByStatus: (status: ValidationStatus) => Question[];
}

const SEED_TEMPLATES: SmartExamTemplate[] = [
  {
    id: 'tmpl_001',
    name: 'סימולציה פסיכומטרית מלאה',
    description: '50 שאלות בחלוקה מדויקת לפי מבנה המבחן האמיתי',
    targetId: 'target_psychometric',
    totalQuestions: 50,
    timeLimitMinutes: 90,
    rules: [
      { id: 'r1', topicId: 'topic_quantitative', count: 20, minDifficulty: 3, maxDifficulty: 8, useAdaptive: true },
      { id: 'r2', topicId: 'topic_verbal', count: 20, minDifficulty: 3, maxDifficulty: 8, useAdaptive: true },
      { id: 'r3', topicId: 'topic_english', count: 10, minDifficulty: 2, maxDifficulty: 7, useAdaptive: false },
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
  questions: [...QUESTIONS, ...PENDING_SEED],
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

  setAppConfig: (updates) =>
    set(s => ({ appConfig: { ...s.appConfig, ...updates } })),

  setFeatureFlag: (flag, value) =>
    set(s => ({
      appConfig: {
        ...s.appConfig,
        featureFlags: { ...s.appConfig.featureFlags, [flag]: value },
      },
    })),

  addDailyChallenge: (challenge) => {
    const newC: DailyChallenge = { ...challenge, id: `dc_${Date.now()}` };
    set(s => ({ dailyChallenges: [...s.dailyChallenges, newC] }));
    return newC;
  },

  updateDailyChallenge: (id, updates) =>
    set(s => ({
      dailyChallenges: s.dailyChallenges.map(c => c.id === id ? { ...c, ...updates } : c),
    })),

  removeDailyChallenge: (id) =>
    set(s => ({ dailyChallenges: s.dailyChallenges.filter(c => c.id !== id) })),

  setUserNote: (userId, note) =>
    set(s => ({
      userNotes: [
        ...s.userNotes.filter(n => n.userId !== userId),
        { userId, note, updatedAt: new Date().toISOString() },
      ],
    })),

  getUserNote: (userId) => get().userNotes.find(n => n.userId === userId)?.note ?? '',

  setIsAdmin: (val) => set({ isAdmin: val }),
  setFreePracticeLimit: (n) => set({ freePracticeLimit: Math.max(5, Math.min(200, n)) }),
  setPracticeSettings: (updates) =>
    set(s => ({ practiceSettings: { ...s.practiceSettings, ...updates } })),
  setExamSettings: (updates) =>
    set(s => ({ examSettings: { ...s.examSettings, ...updates } })),
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
      return { ok: true };
    }
    // If user doesn't exist, create them (first-time setup)
    if (error?.message?.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (!signUpError && signUpData.user) {
        set({ isAdmin: true });
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
    dbUpsert(newQ);
    return newQ;
  },

  updateQuestion: (id, updates) => {
    set(s => {
      const updated = s.questions.map(q => (q.id === id ? { ...q, ...updates } : q));
      const q = updated.find(x => x.id === id);
      if (q) dbUpsert(q);
      return { questions: updated };
    });
  },

  deleteQuestion: (id) => {
    set(s => ({
      questions: s.questions.filter(q => q.id !== id),
      selectedQuestionIds: s.selectedQuestionIds.filter(i => i !== id),
    }));
    dbDelete(id);
  },

  deleteQuestions: (ids) => {
    const idSet = new Set(ids);
    set(s => ({
      questions: s.questions.filter(q => !idSet.has(q.id)),
      selectedQuestionIds: [],
    }));
    ids.forEach(id => dbDelete(id));
  },

  validateQuestion: (id, status) => {
    set(s => {
      const updated = s.questions.map(q =>
        q.id === id
          ? { ...q, validationStatus: status, smartPracticeEligible: status === 'validated', generalPracticeEligible: status === 'validated' }
          : q
      );
      const q = updated.find(x => x.id === id);
      if (q) dbUpsert(q);
      return { questions: updated };
    });
  },

  bulkValidate: (ids, status) => {
    const idSet = new Set(ids);
    set(s => {
      const updated = s.questions.map(q =>
        idSet.has(q.id)
          ? { ...q, validationStatus: status, generalPracticeEligible: status === 'validated', smartPracticeEligible: status === 'validated' }
          : q
      );
      updated.filter(q => idSet.has(q.id)).forEach(q => dbUpsert(q));
      return { questions: updated, selectedQuestionIds: [] };
    });
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
    set(s => {
      const updated = s.questions.map(q =>
        idSet.has(q.id) ? { ...q, topicId } : q
      );
      updated.filter(q => idSet.has(q.id)).forEach(q => dbUpsert(q));
      return { questions: updated };
    });
  },

  setQuestionsAccessLevel: (questionIds, level) => {
    const idSet = new Set(questionIds);
    set(s => {
      const updated = s.questions.map(q =>
        idSet.has(q.id) ? { ...q, accessLevel: level } : q
      );
      updated.filter(q => idSet.has(q.id)).forEach(q => dbUpsert(q));
      return { questions: updated };
    });
  },

  addTopic: (t) => {
    const newT: Topic = { ...t, id: `topic_admin_${Date.now()}` };
    set(s => ({ topics: [...s.topics, newT] }));
    return newT;
  },

  updateTopic: (id, updates) => {
    set(s => ({
      topics: s.topics.map(t => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  deleteTopic: (id) => {
    set(s => ({ topics: s.topics.filter(t => t.id !== id) }));
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
    set(s => ({ templates: [...s.templates, newT] }));
    return newT;
  },

  updateTemplate: (id, updates) => {
    set(s => ({
      templates: s.templates.map(t => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  deleteTemplate: (id) => {
    set(s => ({ templates: s.templates.filter(t => t.id !== id) }));
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
    set({ questions });
  },

  seedToSupabase: () => seedDatabase(),

  getPendingQuestions: () => get().questions.filter(q => q.validationStatus === 'pending'),
  getQuestionsByStatus: (status) => get().questions.filter(q => q.validationStatus === status),
}));
