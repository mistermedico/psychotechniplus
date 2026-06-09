import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminStore, SessionRecord } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

type TabKey = 'questions' | 'topics' | 'exams' | 'sessions';
type ModeFilter = 'all' | 'practice' | 'simulation' | 'speed' | 'adaptive';

interface UsageRow {
  id: string;
  title: string;
  subtitle: string;
  attempts: number;
  correct: number;
  skipped: number;
  avgTime: number;
  score: number;
}

export default function PracticeMonitorScreen() {
  const { sessionHistory, questions, topics, templates, loadSessionHistory } = useAdminStore();
  const [tab, setTab] = useState<TabKey>('questions');
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  useEffect(() => {
    setLoading(true);
    loadSessionHistory().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => buildMonitorData(sessionHistory, questions, topics, templates), [sessionHistory, questions, topics, templates]);
  const activeRows =
    tab === 'questions' ? data.questions :
    tab === 'topics' ? data.topics :
    tab === 'exams' ? data.exams : [];

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    return sessionHistory.filter(session => {
      if (modeFilter !== 'all' && session.mode !== modeFilter) return false;
      if (!q) return true;
      return [
        session.id,
        session.userId,
        session.userName,
        session.templateName,
        session.mode,
        session.targetId,
        session.topicId,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(q));
    });
  }, [sessionHistory, sessionSearch, modeFilter]);

  const totalAnswers = sessionHistory.reduce((sum, s) => sum + s.totalQuestions, 0);
  const avgScore = sessionHistory.length
    ? Math.round(sessionHistory.reduce((sum, s) => sum + s.score, 0) / sessionHistory.length)
    : 0;
  const avgTime = totalAnswers
    ? Math.round(sessionHistory.reduce((sum, s) => sum + s.timeSpentSeconds, 0) / totalAnswers)
    : 0;
  const lowScoreSessions = sessionHistory.filter(s => s.score < 55).length;
  const skippedHeavySessions = sessionHistory.filter(s => s.totalQuestions > 0 && s.skippedQuestions / s.totalQuestions >= 0.25).length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#08111F', '#111827', '#1E1B4B']} style={styles.hero}>
          <View style={styles.orbPrimary} />
          <View style={styles.orbCyan} />
          <Text style={styles.heroEyebrow}>AUTO PRACTICE INTELLIGENCE</Text>
          <Text style={styles.heroTitle}>מוניטור תרגולים, מבחנים ושאלות</Text>
          <Text style={styles.heroSub}>
            צפייה אוטומטית בכל סשן, שאלה, פרק ומבחן: שימוש, דיוק, זמן ממוצע ושאלות שמצריכות טיפול.
          </Text>
          {loading && (
            <View style={styles.loadingPill}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.loadingText}>טוען היסטוריית שימוש...</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.kpiGrid}>
          <Kpi label="סשנים" value={String(sessionHistory.length)} tone={Colors.primary} />
          <Kpi label="תשובות" value={String(totalAnswers)} tone={Colors.cyan} />
          <Kpi label="ציון ממוצע" value={`${avgScore}`} tone={Colors.success} />
          <Kpi label="זמן לשאלה" value={`${avgTime}s`} tone={Colors.warning} />
          <Kpi label="סשנים חלשים" value={String(lowScoreSessions)} tone={lowScoreSessions ? Colors.danger : Colors.success} />
          <Kpi label="הרבה דילוגים" value={String(skippedHeavySessions)} tone={skippedHeavySessions ? Colors.warning : Colors.success} />
        </View>

        <Text style={styles.sectionTitle}>התראות אוטומטיות</Text>
        <View style={styles.insightGrid}>
          {data.insights.map(item => (
            <View key={item.title} style={[styles.insightCard, { borderColor: item.color + '55' }]}>
              <Text style={[styles.insightTitle, { color: item.color }]}>{item.title}</Text>
              <Text style={styles.insightText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabs}>
          {[
            ['questions', 'שאלות'],
            ['topics', 'פרקים'],
            ['exams', 'מבחנים'],
            ['sessions', 'סשנים'],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key as TabKey)}
              style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sessionTools}>
          <TextInput
            style={styles.sessionSearch}
            value={sessionSearch}
            onChangeText={setSessionSearch}
            placeholder="חפש משתמש, מבחן, מזהה סשן או פרק..."
            placeholderTextColor="#64748B"
            textAlign="right"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeFilters}>
            {([
              ['all', 'הכל'],
              ['practice', 'תרגול'],
              ['simulation', 'מבחנים'],
              ['adaptive', 'אדפטיבי'],
              ['speed', 'מהירות'],
            ] as Array<[ModeFilter, string]>).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setModeFilter(value)}
                style={[styles.modeChip, modeFilter === value && styles.modeChipActive]}
              >
                <Text style={[styles.modeChipText, modeFilter === value && styles.modeChipTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {tab !== 'sessions' ? (
          <View style={styles.tableCard}>
            {activeRows.length === 0 ? (
              <EmptyState />
            ) : activeRows.map(row => <UsageRowView key={row.id} row={row} />)}
          </View>
        ) : (
          <View style={styles.tableCard}>
            {filteredSessions.length === 0 ? <EmptyState /> : filteredSessions.slice(0, 80).map(s => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                style={styles.sessionCard}
              >
                <View style={styles.sessionTop}>
                  <Text style={styles.sessionScore}>{s.score}</Text>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle}>{s.templateName ?? modeLabel(s.mode)}</Text>
                    <Text style={styles.sessionMeta}>
                      {s.userName ?? s.userId} · {formatDate(s.completedAt)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sessionLine}>
                  {s.correctAnswers}/{s.totalQuestions} נכון · {s.skippedQuestions} דילוגים · {Math.round(s.timeSpentSeconds / 60)} דק׳
                </Text>
                {selectedSession?.id === s.id && (
                  <View style={styles.answerList}>
                    {s.answers.map((a, idx) => {
                      const q = questions.find(item => item.id === a.questionId);
                      const selected = q?.options.find(o => o.id === a.selectedAnswerId)?.text ?? a.selectedAnswerId ?? 'דילוג';
                      const correct = q?.options.find(o => o.id === (a.correctAnswerId ?? q.correctAnswer))?.text ?? a.correctAnswerId ?? '';
                      return (
                        <View key={`${a.questionId}_${idx}`} style={styles.answerRow}>
                          <Text style={[styles.answerState, { color: a.isCorrect ? Colors.success : a.isSkipped ? Colors.warning : Colors.danger }]}>
                            {a.isCorrect ? 'נכון' : a.isSkipped ? 'דולג' : 'שגוי'}
                          </Text>
                          <View style={styles.answerInfo}>
                            <Text style={styles.answerQuestion} numberOfLines={2}>{q?.questionText ?? a.questionId}</Text>
                            <Text style={styles.answerMeta}>נבחר: {selected} · נכון: {correct} · {a.timeSpent}s</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function buildMonitorData(
  sessions: SessionRecord[],
  questions: ReturnType<typeof useAdminStore.getState>['questions'],
  topics: ReturnType<typeof useAdminStore.getState>['topics'],
  templates: ReturnType<typeof useAdminStore.getState>['templates'],
) {
  const questionMap = new Map(questions.map(q => [q.id, q]));
  const topicMap = new Map(topics.map(t => [t.id, t]));
  const templateMap = new Map(templates.map(t => [t.id, t]));

  const byQuestion = new Map<string, UsageRow>();
  const byTopic = new Map<string, UsageRow>();
  const byExam = new Map<string, UsageRow>();

  const ensure = (map: Map<string, UsageRow>, row: UsageRow) => {
    if (!map.has(row.id)) map.set(row.id, row);
    return map.get(row.id)!;
  };

  sessions.forEach(session => {
    const topic = topicMap.get(session.topicId);
    const topicRow = ensure(byTopic, {
      id: session.topicId || 'unknown',
      title: topic ? `${topic.icon} ${topic.name}` : session.topicId || 'ללא פרק',
      subtitle: 'כל התרגולים והמבחנים בפרק',
      attempts: 0, correct: 0, skipped: 0, avgTime: 0, score: 0,
    });
    topicRow.attempts += session.totalQuestions;
    topicRow.correct += session.correctAnswers;
    topicRow.skipped += session.skippedQuestions;
    topicRow.avgTime += session.timeSpentSeconds;

    const examId = session.templateId ?? `mode_${session.mode}`;
    const tmpl = session.templateId ? templateMap.get(session.templateId) : null;
    const examRow = ensure(byExam, {
      id: examId,
      title: tmpl?.name ?? session.templateName ?? modeLabel(session.mode),
      subtitle: session.templateId ? 'תבנית מבחן חכמה' : 'מצב תרגול',
      attempts: 0, correct: 0, skipped: 0, avgTime: 0, score: 0,
    });
    examRow.attempts += session.totalQuestions;
    examRow.correct += session.correctAnswers;
    examRow.skipped += session.skippedQuestions;
    examRow.avgTime += session.timeSpentSeconds;

    session.answers.forEach(answer => {
      const q = questionMap.get(answer.questionId);
      const row = ensure(byQuestion, {
        id: answer.questionId,
        title: q?.questionText ?? answer.questionId,
        subtitle: q ? `${topicMap.get(q.topicId)?.name ?? q.topicId} · רמה ${q.difficulty}` : 'שאלה לא נמצאה במאגר',
        attempts: 0, correct: 0, skipped: 0, avgTime: 0, score: 0,
      });
      row.attempts += 1;
      row.correct += answer.isCorrect ? 1 : 0;
      row.skipped += answer.isSkipped ? 1 : 0;
      row.avgTime += answer.timeSpent;
    });
  });

  const finalize = (rows: UsageRow[]) => rows
    .map(row => ({
      ...row,
      score: row.attempts ? Math.round((row.correct / row.attempts) * 100) : 0,
      avgTime: row.attempts ? Math.round(row.avgTime / row.attempts) : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const questionRows = finalize([...byQuestion.values()]);
  const topicRows = finalize([...byTopic.values()]);
  const examRows = finalize([...byExam.values()]);
  const hardest = [...questionRows].filter(r => r.attempts > 0).sort((a, b) => a.score - b.score)[0];
  const slowest = [...questionRows].filter(r => r.attempts > 0).sort((a, b) => b.avgTime - a.avgTime)[0];
  const hottest = topicRows[0];

  return {
    questions: questionRows,
    topics: topicRows,
    exams: examRows,
    insights: [
      {
        title: 'שאלה בעייתית',
        text: hardest ? `${hardest.score}% הצלחה · ${hardest.title.slice(0, 72)}` : 'אין עדיין מספיק נתוני שאלות.',
        color: Colors.danger,
      },
      {
        title: 'שאלה איטית',
        text: slowest ? `${slowest.avgTime}s בממוצע · ${slowest.title.slice(0, 72)}` : 'אין עדיין נתוני זמן.',
        color: Colors.warning,
      },
      {
        title: 'פרק פעיל',
        text: hottest ? `${hottest.attempts} ניסיונות · ${hottest.title}` : 'עוד לא נרשמו תרגולים.',
        color: Colors.primary,
      },
    ],
  };
}

function UsageRowView({ row }: { row: UsageRow }) {
  const tone = row.score >= 75 ? Colors.success : row.score >= 50 ? Colors.warning : Colors.danger;
  return (
    <View style={styles.usageRow}>
      <View style={styles.scoreDial}>
        <Text style={[styles.scoreText, { color: tone }]}>{row.score}%</Text>
      </View>
      <View style={styles.usageInfo}>
        <Text style={styles.usageTitle} numberOfLines={2}>{row.title}</Text>
        <Text style={styles.usageSub} numberOfLines={1}>{row.subtitle}</Text>
        <View style={styles.metricRow}>
          <Metric label="ניסיונות" value={row.attempts} />
          <Metric label="נכון" value={row.correct} />
          <Metric label="דילוגים" value={row.skipped} />
          <Metric label="זמן" value={`${row.avgTime}s`} />
        </View>
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={[styles.kpi, { borderColor: tone + '55' }]}>
      <Text style={[styles.kpiValue, { color: tone }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>אין עדיין נתוני שימוש</Text>
      <Text style={styles.emptyText}>ברגע שמשתמשים יסיימו תרגול או מבחן, המוניטור יציג כאן שימוש לפי שאלות, פרקים ומבחנים.</Text>
    </View>
  );
}

function modeLabel(mode: string) {
  if (mode === 'simulation') return 'סימולציה';
  if (mode === 'speed') return 'תרגול מהירות';
  if (mode === 'adaptive') return 'תרגול אדפטיבי';
  return 'תרגול רגיל';
}

function formatDate(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070B14' },
  content: { paddingBottom: 40 },
  hero: { margin: 16, borderRadius: Radius['2xl'], padding: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', ...Shadow.lg },
  orbPrimary: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: Colors.primary, opacity: 0.22, top: -60, left: -40 },
  orbCyan: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: Colors.cyan, opacity: 0.16, bottom: -60, right: -40 },
  heroEyebrow: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.cyan, textAlign: 'right', letterSpacing: 1 },
  heroTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right', marginTop: 6 },
  heroSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#CBD5E1', textAlign: 'right', lineHeight: 21, marginTop: 8 },
  loadingPill: { alignSelf: 'flex-end', flexDirection: 'row-reverse', gap: 8, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  loadingText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#fff' },
  kpiGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  kpi: { width: '47.5%', backgroundColor: 'rgba(15,23,42,0.86)', borderRadius: Radius.xl, borderWidth: 1, padding: 14, alignItems: 'flex-end' },
  kpiValue: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'] },
  kpiLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8', marginTop: 2 },
  sectionTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: '#E2E8F0', textAlign: 'right', paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  insightGrid: { paddingHorizontal: 16, gap: 10 },
  insightCard: { backgroundColor: 'rgba(15,23,42,0.82)', borderRadius: Radius.xl, borderWidth: 1, padding: 14, alignItems: 'flex-end' },
  insightTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, textAlign: 'right' },
  insightText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#CBD5E1', textAlign: 'right', marginTop: 4, lineHeight: 18 },
  tabs: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 16, marginTop: 18, marginBottom: 10 },
  tabBtn: { flex: 1, borderRadius: Radius.full, paddingVertical: 10, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1F2937', alignItems: 'center' },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryLight },
  tabText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#94A3B8' },
  tabTextActive: { color: '#fff' },
  sessionTools: { marginHorizontal: 16, marginBottom: 10, gap: 8 },
  sessionSearch: {
    backgroundColor: '#111827',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E2E8F0',
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  modeFilters: { flexDirection: 'row-reverse', gap: 8 },
  modeChip: { backgroundColor: '#111827', borderRadius: Radius.full, borderWidth: 1, borderColor: '#1F2937', paddingHorizontal: 12, paddingVertical: 7 },
  modeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryLight },
  modeChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#94A3B8' },
  modeChipTextActive: { color: '#fff' },
  tableCard: { marginHorizontal: 16, backgroundColor: 'rgba(15,23,42,0.88)', borderRadius: Radius.xl, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', overflow: 'hidden' },
  usageRow: { flexDirection: 'row-reverse', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.12)' },
  scoreDial: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1F2937' },
  scoreText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  usageInfo: { flex: 1, alignItems: 'flex-end' },
  usageTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#F8FAFC', textAlign: 'right', lineHeight: 19 },
  usageSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 3 },
  metricRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  metricPill: { backgroundColor: '#111827', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5, flexDirection: 'row-reverse', gap: 4 },
  metricValue: { fontFamily: FontFamily.bold, fontSize: 11, color: '#E2E8F0' },
  metricLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: '#64748B' },
  sessionCard: { padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.12)' },
  sessionTop: { flexDirection: 'row-reverse', gap: 12, alignItems: 'center' },
  sessionScore: { width: 52, textAlign: 'center', fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.primaryLight },
  sessionInfo: { flex: 1, alignItems: 'flex-end' },
  sessionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#F8FAFC', textAlign: 'right' },
  sessionMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 2 },
  sessionLine: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#CBD5E1', textAlign: 'right', marginTop: 8 },
  answerList: { marginTop: 12, gap: 8 },
  answerRow: { flexDirection: 'row-reverse', gap: 10, backgroundColor: '#0B1220', borderRadius: Radius.lg, padding: 10 },
  answerState: { width: 42, fontFamily: FontFamily.bold, fontSize: FontSize.xs, textAlign: 'center' },
  answerInfo: { flex: 1, alignItems: 'flex-end' },
  answerQuestion: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#E2E8F0', textAlign: 'right' },
  answerMeta: { fontFamily: FontFamily.regular, fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 3 },
  empty: { padding: 26, alignItems: 'center' },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#E2E8F0', textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
