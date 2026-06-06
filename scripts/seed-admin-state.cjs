const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const src = fs.readFileSync('lib/supabase.ts', 'utf8');
const url = src.match(/SUPABASE_URL = '([^']+)'/)[1];
const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)[1];
const supabase = createClient(url, key);
const now = new Date().toISOString();

const settings = {
  practiceSettings: {
    speedModeSecondsPerQuestion: 60,
    showExplanationsAuto: false,
    autoAdvanceDelaySeconds: 0,
    shuffleAnswerOptions: false,
    showTimerAlways: false,
    premiumOnlyModes: [],
    freeUserMaxDifficulty: 10,
    premiumUserQuestionLimit: 999,
  },
  examSettings: {
    defaultPassingScore: 65,
    allowSkipInExam: true,
    defaultRestTimeBetweenRules: 30,
    showPercentileRankInResults: true,
    showDetailedScoreBreakdown: true,
    showCorrectAnswersAfterExam: true,
  },
  freePracticeLimit: 30,
  premiumConfig: {
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
    paywallTitle: 'שדרג לפרימיום',
    paywallSubtitle: 'קבל גישה מלאה לכל הכלים',
  },
  appConfig: {
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
  },
};

const templates = [
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
    smartRules: [],
    topicTimeSettings: { topic_quantitative: 75, topic_verbal: 70, topic_logic: 75, topic_spatial: 65 },
    restTimeBetweenRules: 15,
    restScreenMessage: 'נשימה קצרה וממשיכים לחלק הבא.',
    passingScore: 65,
    createdAt: '2026-06-04T00:00:00.000Z',
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
    smartRules: [],
    topicTimeSettings: { topic_quantitative: 70, topic_logic: 70 },
    restTimeBetweenRules: 20,
    passingScore: 70,
    createdAt: '2026-06-04T00:00:00.000Z',
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
    smartRules: [],
    topicTimeSettings: { topic_verbal: 70, topic_spatial: 75 },
    restTimeBetweenRules: 20,
    passingScore: 68,
    createdAt: '2026-06-04T00:00:00.000Z',
    isActive: true,
  },
];

const collections = {
  dailyChallenges: [],
  userNotes: [],
  promoCodes: [],
  pushNotifications: [],
  revenueSnapshots: [],
  activityLog: [{
    id: `log_${Date.now()}`,
    action: 'Admin sync initialized in Supabase',
    category: 'system',
    timestamp: now,
  }],
  generationSessions: [],
  generationPresets: [],
};

(async () => {
  const rows = [
    { key: 'settings', value: settings, updated_at: now },
    { key: 'templates', value: templates, updated_at: now },
    { key: 'collections', value: collections, updated_at: now },
  ];

  const upsert = await supabase.from('admin_state').upsert(rows, { onConflict: 'key' });
  if (upsert.error) throw upsert.error;

  const check = await supabase.from('admin_state').select('key,value').order('key');
  if (check.error) throw check.error;

  console.log(JSON.stringify(check.data.map((row) => ({
    key: row.key,
    size: Array.isArray(row.value) ? row.value.length : Object.keys(row.value || {}).length,
  })), null, 2));
})();
