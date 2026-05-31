import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { useAdminStore } from '../../store/adminStore';

// ─── Topic label map ──────────────────────────────────────────────────────────
const TOPIC_LABELS: Record<string, string> = {
  topic_quantitative: 'כמותי',
  topic_verbal:       'מילולי',
  topic_logic:        'לוגי',
  topic_spatial:      'מרחבי',
  topic_english:      'אנגלית',
  topic_general:      'כללי',
};

function topicLabel(id: string): string {
  return TOPIC_LABELS[id] ?? id.replace('topic_', '');
}

// ─── Difficulty color ─────────────────────────────────────────────────────────
const DIFF_COLORS: Record<number, string> = {
  1: '#34D399',
  2: '#22D3EE',
  3: '#FBBF24',
  4: '#F97316',
  5: '#F87171',
};

function diffColor(d: number): string {
  return DIFF_COLORS[Math.min(Math.max(Math.round(d), 1), 5)] ?? Colors.textTertiary;
}

// ─── Small stat card ──────────────────────────────────────────────────────────
function StatCard({ value, label, accent }: { value: string | number; label: string; accent: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Bar chart row ────────────────────────────────────────────────────────────
function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.barCount}>{count}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ContentReportScreen() {
  const { questions } = useAdminStore();

  const stats = useMemo(() => {
    if (!questions.length) {
      return {
        total: 0,
        avgElo: 0,
        avgDiff: 0,
        diffDist: {} as Record<number, number>,
        eloDist: { lt900: 0, r900: 0, r1050: 0, gt1200: 0 },
        topicBreakdown: [] as { id: string; count: number; avgElo: number }[],
        hardest: [] as typeof questions,
      };
    }

    const total = questions.length;
    const avgElo = Math.round(
      questions.reduce((s, q) => s + (q.psychometricStats?.elo ?? 1000), 0) / total
    );
    const avgDiff = parseFloat(
      (questions.reduce((s, q) => s + (q.difficulty ?? 3), 0) / total).toFixed(1)
    );

    // Difficulty distribution (clamp 1-5)
    const diffDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const q of questions) {
      const d = Math.min(Math.max(Math.round(q.difficulty ?? 3), 1), 5);
      diffDist[d] = (diffDist[d] ?? 0) + 1;
    }

    // ELO range distribution
    const eloDist = { lt900: 0, r900: 0, r1050: 0, gt1200: 0 };
    for (const q of questions) {
      const elo = q.psychometricStats?.elo ?? 1000;
      if (elo < 900)        eloDist.lt900++;
      else if (elo < 1050)  eloDist.r900++;
      else if (elo <= 1200) eloDist.r1050++;
      else                  eloDist.gt1200++;
    }

    // Topic breakdown
    const topicMap = new Map<string, { count: number; totalElo: number }>();
    for (const q of questions) {
      const tid = q.topicId ?? 'unknown';
      const cur = topicMap.get(tid) ?? { count: 0, totalElo: 0 };
      cur.count++;
      cur.totalElo += q.psychometricStats?.elo ?? 1000;
      topicMap.set(tid, cur);
    }
    const topicBreakdown = Array.from(topicMap.entries())
      .map(([id, { count, totalElo }]) => ({
        id,
        count,
        avgElo: Math.round(totalElo / count),
      }))
      .sort((a, b) => b.count - a.count);

    // Hardest 10 by highest ELO
    const hardest = [...questions]
      .sort((a, b) => (b.psychometricStats?.elo ?? 0) - (a.psychometricStats?.elo ?? 0))
      .slice(0, 10);

    return { total, avgElo, avgDiff, diffDist, eloDist, topicBreakdown, hardest };
  }, [questions]);

  const maxDiffCount = Math.max(...Object.values(stats.diffDist), 1);
  const maxEloCount  = Math.max(
    stats.eloDist.lt900, stats.eloDist.r900, stats.eloDist.r1050, stats.eloDist.gt1200, 1
  );
  const maxTopicCount = Math.max(...stats.topicBreakdown.map(t => t.count), 1);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient colors={['#1A1740', '#0E0B2A']} style={styles.header}>
          <Text style={styles.headerIcon}>📉</Text>
          <Text style={styles.headerTitle}>דוח ביצועי תוכן</Text>
          <Text style={styles.headerSub}>
            סטטיסטיקות שאלות מחושבות מהמאגר הנוכחי
          </Text>
        </LinearGradient>

        {/* Summary stats */}
        <Text style={styles.sectionTitle}>סיכום כללי</Text>
        <View style={styles.statsRow}>
          <StatCard value={stats.total}    label="סה״כ שאלות"   accent={Colors.primary} />
          <StatCard value={stats.avgElo}   label="ELO ממוצע"    accent={Colors.warning} />
          <StatCard value={stats.avgDiff}  label="קושי ממוצע"   accent={Colors.danger}  />
        </View>

        {/* Difficulty distribution */}
        <Text style={styles.sectionTitle}>פילוח לפי קושי (1-5)</Text>
        <View style={styles.card}>
          {([1, 2, 3, 4, 5] as const).map(level => (
            <BarRow
              key={level}
              label={`רמה ${level}`}
              count={stats.diffDist[level] ?? 0}
              max={maxDiffCount}
              color={diffColor(level)}
            />
          ))}
        </View>

        {/* ELO range distribution */}
        <Text style={styles.sectionTitle}>פילוח לפי טווח ELO</Text>
        <View style={styles.card}>
          <BarRow label="< 900 (קל)"       count={stats.eloDist.lt900}  max={maxEloCount} color={Colors.success}  />
          <BarRow label="900 – 1049"        count={stats.eloDist.r900}   max={maxEloCount} color={Colors.cyan}     />
          <BarRow label="1050 – 1200"       count={stats.eloDist.r1050}  max={maxEloCount} color={Colors.warning}  />
          <BarRow label="> 1200 (קשה מאוד)" count={stats.eloDist.gt1200} max={maxEloCount} color={Colors.danger}   />
        </View>

        {/* Topic breakdown */}
        <Text style={styles.sectionTitle}>פילוח לפי נושא</Text>
        <View style={styles.card}>
          {stats.topicBreakdown.length === 0 && (
            <Text style={styles.emptyText}>אין נתונים</Text>
          )}
          {stats.topicBreakdown.map(topic => (
            <View key={topic.id} style={styles.topicRow}>
              <View style={styles.topicLeft}>
                <Text style={styles.topicName}>{topicLabel(topic.id)}</Text>
                <View style={styles.topicBarTrack}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.accent]}
                    style={[
                      styles.topicBarFill,
                      { width: `${(topic.count / maxTopicCount) * 100}%` as any },
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </View>
              </View>
              <View style={styles.topicRight}>
                <Text style={styles.topicCount}>{topic.count}</Text>
                <Text style={styles.topicElo}>ELO {topic.avgElo}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Hardest questions */}
        <Text style={styles.sectionTitle}>10 השאלות הקשות ביותר (לפי ELO)</Text>
        <View style={styles.card}>
          {stats.hardest.length === 0 && (
            <Text style={styles.emptyText}>אין שאלות במאגר</Text>
          )}
          {stats.hardest.map((q, i) => {
            const elo   = q.psychometricStats?.elo ?? 0;
            const diff  = q.difficulty ?? 0;
            const text  = (q.questionText ?? '').slice(0, 60) + ((q.questionText?.length ?? 0) > 60 ? '…' : '');
            return (
              <View key={q.id} style={[styles.hardRow, i < stats.hardest.length - 1 && styles.hardRowBorder]}>
                <View style={[styles.hardRank, { backgroundColor: i < 3 ? Colors.primaryLighter : Colors.surface }]}>
                  <Text style={styles.hardRankText}>#{i + 1}</Text>
                </View>
                <View style={styles.hardInfo}>
                  <Text style={styles.hardText} numberOfLines={2}>{text}</Text>
                  <View style={styles.hardMeta}>
                    <View style={[styles.hardBadge, { backgroundColor: Colors.warningLight }]}>
                      <Text style={[styles.hardBadgeText, { color: Colors.warning }]}>
                        ELO {elo}
                      </Text>
                    </View>
                    <View style={[styles.hardBadge, { backgroundColor: `${diffColor(diff)}22` }]}>
                      <Text style={[styles.hardBadgeText, { color: diffColor(diff) }]}>
                        קושי {diff}
                      </Text>
                    </View>
                    <Text style={styles.hardTopic}>{topicLabel(q.topicId ?? '')}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Footer note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            הנתונים מחושבים בזמן אמת מהמאגר המקומי. ייתכנו הבדלים קלים לעומת נתוני Supabase.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#0F172A' },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // Header
  header: {
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  headerIcon:  { fontSize: 36, marginBottom: 8 },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text, textAlign: 'center', marginBottom: 4 },
  headerSub:   { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  // Section title
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 10,
    marginTop: 16,
    paddingRight: 2,
  },

  // Summary stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.lg,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  statValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Generic card
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
    ...Shadow.sm,
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // Bar chart row
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  barLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    width: 76,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 10,
    borderRadius: Radius.full,
    minWidth: 4,
  },
  barCount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.text,
    width: 28,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },

  // Topic rows
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  topicLeft: { flex: 1 },
  topicName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 4,
  },
  topicBarTrack: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  topicBarFill: {
    height: 8,
    borderRadius: Radius.full,
    minWidth: 4,
  },
  topicRight: { alignItems: 'flex-end', minWidth: 64 },
  topicCount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  topicElo: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },

  // Hardest list
  hardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  hardRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hardRank: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hardRankText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  hardInfo: { flex: 1 },
  hardText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 6,
  },
  hardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  hardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  hardBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'],
  },
  hardTopic: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    alignSelf: 'center',
  },

  // Footer note
  noteCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
