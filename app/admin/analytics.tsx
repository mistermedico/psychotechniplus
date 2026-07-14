import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'בחירה מרובה',
  true_false: 'נכון/לא נכון',
  logic: 'לוגיקה',
  verbal: 'מילולי',
  quantitative: 'כמותי',
  shapes: 'צורות',
  reading_comprehension: 'הבנת הנקרא',
  fill_in_the_blank: 'השלמת חסר',
};

export default function Analytics() {
  const { getStats, questions, topics, targets } = useAdminStore();
  const stats = getStats();

  // Per topic
  const topicData = topics.map(t => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    color: t.color,
    count: stats.questionsPerTopic[t.id] ?? 0,
  })).sort((a, b) => b.count - a.count);

  const maxTopicCount = Math.max(...topicData.map(d => d.count), 1);

  // Per difficulty
  const diffData = Array.from({ length: 10 }, (_, i) => ({
    diff: i + 1,
    count: stats.questionsPerDifficulty[i + 1] ?? 0,
  }));
  const maxDiffCount = Math.max(...diffData.map(d => d.count), 1);

  // Per type
  const typeData = Object.entries(stats.questionsPerType)
    .map(([type, count]) => ({ type, count, label: TYPE_LABELS[type] ?? type }))
    .sort((a, b) => b.count - a.count);
  const maxTypeCount = Math.max(...typeData.map(d => d.count), 1);

  // Validation distribution
  const validationData = [
    { label: 'מאושר', count: stats.validatedCount, color: Colors.success },
    { label: 'ממתין', count: stats.pendingCount, color: Colors.warning },
    { label: 'טיוטה', count: stats.draftCount, color: Colors.textTertiary },
    { label: 'נדחה', count: stats.rejectedCount, color: Colors.danger },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <KpiCard label="סה״כ שאלות" value={stats.totalQuestions} icon="❓" color={Colors.primary} />
          <KpiCard label="קושי ממוצע" value={stats.avgDifficulty} icon="⚖️" color={Colors.warning} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard label="נושאים" value={stats.totalTopics} icon="📚" color={Colors.accent} />
          <KpiCard label="מסלולים" value={stats.totalTargets} icon="🎯" color="#0EA5E9" />
        </View>

        {/* Validation donut-like breakdown */}
        <Text style={styles.chartTitle}>📊 סטטוס ולידציה</Text>
        <View style={styles.card}>
          <View style={styles.donutRow}>
            {validationData.map(d => {
              const pct = stats.totalQuestions > 0
                ? Math.round((d.count / stats.totalQuestions) * 100)
                : 0;
              return (
                <View key={d.label} style={styles.donutItem}>
                  <View style={[styles.donutCircle, { borderColor: d.color }]}>
                    <Text style={[styles.donutPct, { color: d.color }]}>{pct}%</Text>
                  </View>
                  <Text style={[styles.donutCount, { color: d.color }]}>{d.count}</Text>
                  <Text style={styles.donutLabel}>{d.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Visual bar breakdown */}
          <View style={styles.stackBar}>
            {validationData.map(d => {
              const w = stats.totalQuestions > 0 ? (d.count / stats.totalQuestions) * 100 : 0;
              if (w === 0) return null;
              return (
                <View key={d.label} style={[styles.stackSegment, { flex: w, backgroundColor: d.color }]} />
              );
            })}
          </View>
        </View>

        {/* Per topic bar chart */}
        <Text style={styles.chartTitle}>📚 שאלות לפי נושא</Text>
        <View style={styles.card}>
          {topicData.map(d => (
            <View key={d.id} style={styles.barRow}>
              <View style={styles.barLabelWrap}>
                <Text style={styles.barLabel}>{d.icon} {d.name}</Text>
                <Text style={[styles.barCount, { color: d.color }]}>{d.count}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(d.count / maxTopicCount) * 100}%`, backgroundColor: d.color },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Difficulty distribution */}
        <Text style={styles.chartTitle}>🎯 התפלגות קושי</Text>
        <View style={styles.card}>
          <View style={styles.diffChart}>
            {diffData.map(d => {
              const h = maxDiffCount > 0 ? (d.count / maxDiffCount) * 100 : 0;
              const barColor = d.diff <= 3 ? Colors.success : d.diff <= 6 ? Colors.warning : Colors.danger;
              return (
                <View key={d.diff} style={styles.diffCol}>
                  <Text style={styles.diffCountAbove}>{d.count > 0 ? d.count : ''}</Text>
                  <View style={styles.diffBarTrack}>
                    <View style={[styles.diffBarFill, { height: `${h}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.diffLabel, { color: barColor }]}>{d.diff}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.diffLegend}>
            {[{ label: 'קל 1-3', color: Colors.success }, { label: 'בינוני 4-6', color: Colors.warning }, { label: 'קשה 7-10', color: Colors.danger }].map(l => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={styles.legendLabel}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Question types */}
        <Text style={styles.chartTitle}>🔘 סוגי שאלות</Text>
        <View style={styles.card}>
          {typeData.map((d, i) => {
            const pct = Math.round((d.count / Math.max(stats.totalQuestions, 1)) * 100);
            const colors = [Colors.primary, Colors.accent, Colors.success, Colors.warning, Colors.danger, '#0EA5E9', '#6D28D9'];
            const color = colors[i % colors.length];
            return (
              <View key={d.type} style={styles.typeRow}>
                <View style={styles.typeLabelWrap}>
                  <Text style={styles.typeLabel}>{d.label}</Text>
                  <Text style={styles.typeCount}>{d.count} ({pct}%)</Text>
                </View>
                <View style={styles.typeTrack}>
                  <View style={[styles.typeFill, { width: `${(d.count / maxTypeCount) * 100}%`, backgroundColor: color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Discrimination quality */}
        <Text style={styles.chartTitle}>🎯 איכות הפרדה (discrimination)</Text>
        <View style={styles.card}>
          {[
            { label: 'גבוהה (≥0.5)', count: questions.filter(q => (q.psychometricStats.discrimination ?? 0) >= 0.5).length, color: Colors.success },
            { label: 'בינונית (0.25–0.5)', count: questions.filter(q => { const d = q.psychometricStats.discrimination ?? 0; return d >= 0.25 && d < 0.5; }).length, color: Colors.warning },
            { label: 'נמוכה (<0.25)', count: questions.filter(q => (q.psychometricStats.discrimination ?? 0) < 0.25).length, color: Colors.danger },
          ].map(d => (
            <View key={d.label} style={styles.barRow}>
              <View style={styles.barLabelWrap}>
                <Text style={styles.barLabel}>{d.label}</Text>
                <Text style={[styles.barCount, { color: d.color }]}>{d.count}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                  width: `${(d.count / Math.max(questions.length, 1)) * 100}%`,
                  backgroundColor: d.color,
                }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Access level breakdown */}
        <Text style={styles.chartTitle}>🔓 התפלגות גישה</Text>
        <View style={styles.card}>
          {[
            { label: 'חינמי 🆓', count: questions.filter(q => q.accessLevel === 'free').length, color: Colors.success },
            { label: 'פרמיום 💎', count: questions.filter(q => q.accessLevel === 'premium').length, color: Colors.warning },
          ].map(d => {
            const pct = questions.length > 0 ? Math.round((d.count / questions.length) * 100) : 0;
            return (
              <View key={d.label} style={styles.barRow}>
                <View style={styles.barLabelWrap}>
                  <Text style={styles.barLabel}>{d.label}</Text>
                  <Text style={[styles.barCount, { color: d.color }]}>{d.count} ({pct}%)</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: d.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Per target breakdown */}
        <Text style={styles.chartTitle}>🎯 שאלות לפי מסלול</Text>
        <View style={styles.card}>
          {targets.map(t => {
            const count = questions.filter(q => q.targetIds.includes(t.id)).length;
            const pct = questions.length > 0 ? Math.round((count / questions.length) * 100) : 0;
            return (
              <View key={t.id} style={styles.barRow}>
                <View style={styles.barLabelWrap}>
                  <Text style={styles.barLabel}>{t.icon} {t.name}</Text>
                  <Text style={[styles.barCount, { color: Colors.primary }]}>{count}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: Colors.primary }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Eligibility breakdown */}
        <Text style={styles.chartTitle}>✅ כשירות לתרגול</Text>
        <View style={[styles.card, { flexDirection: 'row-reverse', gap: 16, justifyContent: 'space-around' }]}>
          {[
            { label: 'כשיר לתרגול חכם', count: questions.filter(q => q.smartPracticeEligible).length, color: Colors.primary },
            { label: 'כשיר לתרגול כללי', count: questions.filter(q => q.generalPracticeEligible).length, color: Colors.success },
          ].map(d => (
            <View key={d.label} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[styles.donutPct, { color: d.color, fontSize: 28, fontFamily: 'SuezOne_400Regular' }]}>{d.count}</Text>
              <Text style={[styles.donutLabel, { textAlign: 'center' }]}>{d.label}</Text>
              <Text style={{ fontFamily: 'Heebo_400Regular', fontSize: 11, color: Colors.textTertiary }}>
                {questions.length > 0 ? Math.round((d.count / questions.length) * 100) : 0}%
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <View style={[kpiStyles.card, { borderColor: color + '30' }]}>
      <Text style={kpiStyles.icon}>{icon}</Text>
      <Text style={[kpiStyles.value, { color }]}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    ...Shadow.sm,
  },
  icon: { fontSize: 24, marginBottom: 6 },
  value: { fontFamily: FontFamily.heading, fontSize: FontSize['3xl'] },
  label: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 0 },
  kpiRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 10 },
  chartTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 10,
    marginTop: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  donutRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginBottom: 14 },
  donutItem: { alignItems: 'center', gap: 4 },
  donutCircle: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
  },
  donutPct: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  donutCount: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  donutLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  stackBar: { flexDirection: 'row-reverse', height: 12, borderRadius: 6, overflow: 'hidden', gap: 1 },
  stackSegment: { borderRadius: 2 },

  barRow: { marginBottom: 12 },
  barLabelWrap: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },
  barCount: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  barTrack: { height: 10, backgroundColor: Colors.surfaceSecondary, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },

  diffChart: { flexDirection: 'row-reverse', height: 120, alignItems: 'flex-end', gap: 4, marginBottom: 12 },
  diffCol: { flex: 1, alignItems: 'center' },
  diffCountAbove: { fontFamily: FontFamily.medium, fontSize: 9, color: Colors.textTertiary, height: 14 },
  diffBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', overflow: 'hidden' },
  diffBarFill: { width: '100%', borderRadius: 3 },
  diffLabel: { fontFamily: FontFamily.bold, fontSize: 10, marginTop: 4 },
  diffLegend: { flexDirection: 'row-reverse', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },

  typeRow: { marginBottom: 10 },
  typeLabelWrap: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  typeLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },
  typeCount: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  typeTrack: { height: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 4, overflow: 'hidden' },
  typeFill: { height: 8, borderRadius: 4 },
});
