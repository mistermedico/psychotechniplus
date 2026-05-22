import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { TOPICS } from '../../data/mockData';
import { useAdminStore } from '../../store/adminStore';
import { logger } from '../../utils/logger';

interface SessionRow {
  score: number | null;
  correct_answers: number | null;
  total_questions: number | null;
  user_id: string;
  mode: string | null;
  topic_id: string | null;
  completed_at: string | null;
}

interface GeneralStats {
  totalSessions: number;
  avgScore: number;
  avgAccuracy: number;
  uniqueUsers: number;
}

interface TopicAccuracy {
  topicId: string;
  name: string;
  icon: string;
  color: string;
  accuracy: number;
  sessionCount: number;
}

interface ModeCount {
  mode: string;
  label: string;
  count: number;
  color: string;
}

interface ActiveUsers {
  last7Days: number;
  last30Days: number;
  neverActive: number;
}

const MODE_META: Record<string, { label: string; color: string }> = {
  practice:   { label: 'תרגול',      color: Colors.primary },
  speed:      { label: 'מהירות',     color: Colors.warning },
  simulation: { label: 'סימולציה',   color: Colors.accent },
  adaptive:   { label: 'אדפטיבי',    color: Colors.success },
};

export default function PerformanceScreen() {
  const { questions } = useAdminStore();

  const [loading, setLoading] = useState(true);
  const [generalStats, setGeneralStats] = useState<GeneralStats | null>(null);
  const [topicAccuracies, setTopicAccuracies] = useState<TopicAccuracy[]>([]);
  const [modeCounts, setModeCounts] = useState<ModeCount[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUsers | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // 1. Load practice sessions
        const { data: sessions, error: sessErr } = await supabase
          .from('practice_sessions')
          .select('score, correct_answers, total_questions, user_id, mode, topic_id, completed_at');
        if (sessErr) {
          logger.error('performance:load', 'שגיאה בטעינת סשנים', sessErr.message);
        }

        // 2. Load user_profiles for activity stats
        const { data: profiles, error: profErr } = await supabase
          .from('user_profiles')
          .select('id, last_practiced_date');
        if (profErr) {
          logger.error('performance:load', 'שגיאה בטעינת פרופילים', profErr.message);
        }

        const sessionList: SessionRow[] = sessions ?? [];
        const profileList = profiles ?? [];

        // ── General Stats ──────────────────────────────────────────
        const totalSessions = sessionList.length;
        const scoresWithValue = sessionList.filter(s => s.score != null);
        const avgScore = scoresWithValue.length
          ? Math.round(scoresWithValue.reduce((acc, s) => acc + (s.score ?? 0), 0) / scoresWithValue.length)
          : 0;

        const withQA = sessionList.filter(s => s.total_questions != null && s.total_questions > 0);
        const avgAccuracy = withQA.length
          ? Math.round(
              (withQA.reduce((acc, s) => acc + ((s.correct_answers ?? 0) / (s.total_questions ?? 1)), 0) / withQA.length) * 100
            )
          : 0;

        const uniqueUsers = new Set(sessionList.map(s => s.user_id)).size;

        setGeneralStats({ totalSessions, avgScore, avgAccuracy, uniqueUsers });

        // ── Topic Accuracies ───────────────────────────────────────
        const topicMap: Record<string, { sumCorrect: number; sumTotal: number; count: number }> = {};
        sessionList.forEach(s => {
          if (!s.topic_id || s.total_questions == null || s.total_questions === 0) return;
          if (!topicMap[s.topic_id]) topicMap[s.topic_id] = { sumCorrect: 0, sumTotal: 0, count: 0 };
          topicMap[s.topic_id].sumCorrect += s.correct_answers ?? 0;
          topicMap[s.topic_id].sumTotal += s.total_questions;
          topicMap[s.topic_id].count += 1;
        });

        const computed: TopicAccuracy[] = Object.entries(topicMap).map(([tid, vals]) => {
          const topic = TOPICS.find(t => t.id === tid);
          return {
            topicId: tid,
            name: topic?.name ?? tid,
            icon: topic?.icon ?? '📚',
            color: topic?.color ?? Colors.primary,
            accuracy: Math.round((vals.sumCorrect / vals.sumTotal) * 100),
            sessionCount: vals.count,
          };
        }).sort((a, b) => b.accuracy - a.accuracy);

        setTopicAccuracies(computed);

        // ── Mode Distribution ──────────────────────────────────────
        const modeCountMap: Record<string, number> = {};
        sessionList.forEach(s => {
          const m = s.mode ?? 'practice';
          modeCountMap[m] = (modeCountMap[m] ?? 0) + 1;
        });

        const modes: ModeCount[] = Object.entries(modeCountMap).map(([mode, count]) => ({
          mode,
          count,
          label: MODE_META[mode]?.label ?? mode,
          color: MODE_META[mode]?.color ?? Colors.textSecondary,
        })).sort((a, b) => b.count - a.count);

        setModeCounts(modes);

        // ── Active Users ───────────────────────────────────────────
        const now = new Date();
        const cutoff7 = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
        const cutoff30 = new Date(now); cutoff30.setDate(cutoff30.getDate() - 30);
        const cutoff7Str = cutoff7.toISOString().split('T')[0];
        const cutoff30Str = cutoff30.toISOString().split('T')[0];

        let last7Days = 0, last30Days = 0, neverActive = 0;
        profileList.forEach(p => {
          if (!p.last_practiced_date) { neverActive++; return; }
          if (p.last_practiced_date >= cutoff7Str) { last7Days++; }
          else if (p.last_practiced_date >= cutoff30Str) { last30Days++; }
        });

        setActiveUsers({ last7Days, last30Days, neverActive });
      } catch (e: any) {
        logger.error('performance:load', 'חריגה בטעינת ביצועים', e?.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Hardest questions (in-memory from adminStore)
  const hardestQuestions = useMemo(() => {
    return questions
      .filter(q => q.difficulty >= 7 && q.validationStatus === 'validated')
      .sort((a, b) => b.difficulty - a.difficulty)
      .slice(0, 5);
  }, [questions]);

  const maxTopicAccuracy = Math.max(...topicAccuracies.map(t => t.accuracy), 1);
  const totalModeSessions = modeCounts.reduce((s, m) => s + m.count, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>טוען נתוני ביצועים...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backBtnText}>→</Text>
          </Pressable>
          <Text style={styles.headerTitle}>📊 אנליטיקס ביצועים</Text>
        </View>

        {/* ── Section 1: General Stats ─────────────────────────────── */}
        <SectionTitle title="סטטיסטיקות כלליות" />
        <View style={styles.kpiGrid}>
          <KpiCard
            icon="🎯"
            label="סה״כ סשנים"
            value={String(generalStats?.totalSessions ?? 0)}
            color={Colors.primary}
          />
          <KpiCard
            icon="📈"
            label="ציון ממוצע"
            value={`${generalStats?.avgScore ?? 0}%`}
            color={Colors.accent}
          />
          <KpiCard
            icon="✅"
            label="דיוק ממוצע"
            value={`${generalStats?.avgAccuracy ?? 0}%`}
            color={Colors.success}
          />
          <KpiCard
            icon="👤"
            label="משתמשים עם סשנים"
            value={String(generalStats?.uniqueUsers ?? 0)}
            color={Colors.warning}
          />
        </View>

        {/* ── Section 2: Accuracy by Topic ─────────────────────────── */}
        <SectionTitle title="דיוק לפי נושא" />
        <View style={styles.card}>
          {topicAccuracies.length === 0 ? (
            <Text style={styles.emptyText}>אין נתונים זמינים</Text>
          ) : (
            topicAccuracies.map(t => (
              <View key={t.topicId} style={styles.barRow}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel}>{t.icon} {t.name}</Text>
                  <Text style={[styles.barValue, { color: t.color }]}>{t.accuracy}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, {
                    width: `${(t.accuracy / 100) * 100}%`,
                    backgroundColor: t.color,
                  }]} />
                </View>
                <Text style={styles.barMeta}>{t.sessionCount} סשנים</Text>
              </View>
            ))
          )}
        </View>

        {/* ── Section 3: Mode Distribution ─────────────────────────── */}
        <SectionTitle title="התפלגות מצב" />
        <View style={[styles.card, styles.modeRow]}>
          {modeCounts.length === 0 ? (
            <Text style={styles.emptyText}>אין נתונים זמינים</Text>
          ) : (
            modeCounts.map(m => {
              const pct = totalModeSessions > 0 ? Math.round((m.count / totalModeSessions) * 100) : 0;
              return (
                <View key={m.mode} style={[styles.modePill, { backgroundColor: m.color + '20', borderColor: m.color + '50' }]}>
                  <Text style={[styles.modePillValue, { color: m.color }]}>{m.count}</Text>
                  <Text style={[styles.modePillLabel, { color: m.color }]}>{m.label}</Text>
                  <Text style={styles.modePillPct}>{pct}%</Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── Section 4: Hardest Questions ─────────────────────────── */}
        <SectionTitle title="שאלות קשות ביותר" />
        <View style={styles.card}>
          {hardestQuestions.length === 0 ? (
            <Text style={styles.emptyText}>אין שאלות קשות מאומתות במאגר</Text>
          ) : (
            hardestQuestions.map((q, idx) => {
              const topic = TOPICS.find(t => t.id === q.topicId);
              const diffColor = q.difficulty >= 9 ? Colors.danger : Colors.warning;
              const text = q.questionText.length > 60
                ? q.questionText.slice(0, 60) + '...'
                : q.questionText;
              return (
                <View key={q.id} style={styles.hardQRow}>
                  <View style={styles.hardQRank}>
                    <Text style={styles.hardQRankText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hardQText}>{text}</Text>
                    <View style={styles.hardQMeta}>
                      {topic && (
                        <Text style={styles.hardQTopic}>{topic.icon} {topic.name}</Text>
                      )}
                      <View style={[styles.diffBadge, { backgroundColor: diffColor + '22', borderColor: diffColor + '55' }]}>
                        <Text style={[styles.diffBadgeText, { color: diffColor }]}>קושי {q.difficulty}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Section 5: Active Users ───────────────────────────────── */}
        <SectionTitle title="משתמשים פעילים" />
        <View style={styles.card}>
          {activeUsers ? (
            <View style={styles.activeGrid}>
              <ActiveUserCard
                label="פעילים 7 ימים אחרונים"
                value={activeUsers.last7Days}
                color={Colors.success}
                icon="🟢"
              />
              <ActiveUserCard
                label="פעילים 30 ימים אחרונים"
                value={activeUsers.last30Days}
                color={Colors.warning}
                icon="🟡"
              />
              <ActiveUserCard
                label="לא תרגלו אף פעם"
                value={activeUsers.neverActive}
                color={Colors.danger}
                icon="🔴"
              />
            </View>
          ) : (
            <Text style={styles.emptyText}>אין נתונים זמינים</Text>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function KpiCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.kpiCard, { borderColor: color + '30' }]}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function ActiveUserCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[styles.activeCard, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <Text style={styles.activeCardIcon}>{icon}</Text>
      <Text style={[styles.activeCardValue, { color }]}>{value}</Text>
      <Text style={styles.activeCardLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },

  content: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },

  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 12,
    marginTop: 20,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    gap: 4,
    ...Shadow.sm,
  },
  kpiIcon: { fontSize: 26 },
  kpiValue: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'] },
  kpiLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center' },

  // Topic bars
  barRow: { marginBottom: 14 },
  barLabelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 5 },
  barLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },
  barValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  barTrack: { height: 10, backgroundColor: Colors.surfaceSecondary, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  barMeta: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 3 },

  // Mode pills
  modeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  modePill: {
    borderRadius: Radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    minWidth: 80,
    gap: 2,
  },
  modePillValue: { fontFamily: FontFamily.heading, fontSize: FontSize.xl },
  modePillLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  modePillPct: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },

  // Hardest questions
  hardQRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hardQRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLighter,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    marginTop: 2,
  },
  hardQRankText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary },
  hardQText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20 },
  hardQMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 6 },
  hardQTopic: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
  diffBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  diffBadgeText: { fontFamily: FontFamily.bold, fontSize: 10 },

  // Active users
  activeGrid: { flexDirection: 'row-reverse', gap: 10 },
  activeCard: {
    flex: 1,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    gap: 4,
  },
  activeCardIcon: { fontSize: 20 },
  activeCardValue: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'] },
  activeCardLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'center' },

  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
