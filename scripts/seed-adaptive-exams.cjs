const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const src = fs.readFileSync('lib/supabase.ts', 'utf8');
const url = src.match(/SUPABASE_URL = '([^']+)'/)[1];
const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)[1];
const supabase = createClient(url, key);

const adaptiveTemplates = [
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
    topicTimeSettings: { topic_quantitative: 75, topic_verbal: 65, topic_logic: 70, topic_spatial: 60 },
    restTimeBetweenRules: 25,
    restScreenMessage: 'סיימת חלק. קח נשימה, שחרר את הידיים, ועבור לחלק הבא בקצב יציב.',
    passingScore: 68,
    createdAt: '2026-06-04T00:00:00.000Z',
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
    topicTimeSettings: { topic_quantitative: 70, topic_verbal: 60, topic_logic: 70, topic_spatial: 55 },
    restTimeBetweenRules: 15,
    passingScore: 60,
    createdAt: '2026-06-04T00:00:00.000Z',
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
    topicTimeSettings: { topic_quantitative: 80, topic_logic: 75 },
    restTimeBetweenRules: 30,
    restScreenMessage: 'החלק הבא דורש ריכוז גבוה. בדוק שאתה עובד מסודר ולא מנחש מהר מדי.',
    passingScore: 72,
    createdAt: '2026-06-04T00:00:00.000Z',
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
    topicTimeSettings: { topic_verbal: 62, topic_spatial: 58 },
    restTimeBetweenRules: 20,
    passingScore: 66,
    createdAt: '2026-06-04T00:00:00.000Z',
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
    topicTimeSettings: { topic_quantitative: 60, topic_verbal: 50, topic_logic: 58, topic_spatial: 48 },
    restTimeBetweenRules: 8,
    passingScore: 64,
    createdAt: '2026-06-04T00:00:00.000Z',
    isActive: true,
  },
];

(async () => {
  const current = await supabase.from('admin_state').select('value').eq('key', 'templates').maybeSingle();
  if (current.error) throw current.error;

  const existing = Array.isArray(current.data?.value) ? current.data.value : [];
  const byId = new Map(existing.map((template) => [template.id, template]));
  for (const template of adaptiveTemplates) byId.set(template.id, template);

  const templates = Array.from(byId.values());
  const { error } = await supabase.from('admin_state').upsert({
    key: 'templates',
    value: templates,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) throw error;

  console.log(JSON.stringify({
    totalTemplates: templates.length,
    adaptiveTemplates: adaptiveTemplates.length,
    ids: adaptiveTemplates.map((template) => template.id),
  }, null, 2));
})();
