import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const MONTH_LABELS: Record<string, string> = {
  '2025-01': 'ינואר',
  '2025-02': 'פברואר',
  '2025-03': 'מרץ',
  '2025-04': 'אפריל',
  '2025-05': 'מאי',
  '2025-06': 'יוני',
};

const CHART_HEIGHT = 160;

export default function RevenueScreen() {
  const { revenueSnapshots } = useAdminStore();

  const sorted = [...revenueSnapshots].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  const mrrChange = prev ? Math.round(((latest.mrr - prev.mrr) / prev.mrr) * 100) : 0;
  const usersChange = prev ? Math.round(((latest.totalPremiumUsers - prev.totalPremiumUsers) / prev.totalPremiumUsers) * 100) : 0;
  const convChange = prev ? ((latest.conversionRate - prev.conversionRate) * 100).toFixed(1) : '0';
  const churnRate = latest.churnedSubscribers / latest.totalPremiumUsers;
  const prevChurnRate = prev ? prev.churnedSubscribers / prev.totalPremiumUsers : churnRate;
  const churnChange = ((churnRate - prevChurnRate) * 100).toFixed(1);

  const maxMrr = Math.max(...sorted.map(s => s.mrr));

  const summaryCards = [
    { label: 'MRR הנוכחי', value: `₪${latest.mrr.toLocaleString()}`, change: `↑${mrrChange}%`, up: true },
    { label: 'משתמשי פרמיום', value: `${latest.totalPremiumUsers}`, change: `↑${usersChange}%`, up: true },
    { label: 'המרה', value: `${(latest.conversionRate * 100).toFixed(1)}%`, change: `↑${convChange}%`, up: true },
    { label: 'Churn', value: `${(churnRate * 100).toFixed(1)}%`, change: `${parseFloat(churnChange) < 0 ? '↓' : '↑'}${Math.abs(parseFloat(churnChange))}%`, up: parseFloat(churnChange) < 0 },
  ];

  // Active users for funnel
  const activeUsers = 2612;
  const trialUsers = 523;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>→</Text>
          </Pressable>
          <Text style={styles.headerTitle}>📈 הכנסות ומנויים</Text>
          <Text style={styles.headerSub}>נתוני הכנסה ומנויים — ינואר–יוני 2025</Text>
        </LinearGradient>

        {/* Summary Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
          {summaryCards.map((card, i) => (
            <View key={i} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={styles.summaryValue}>{card.value}</Text>
              <Text style={[styles.summaryChange, { color: card.up ? Colors.success : Colors.danger }]}>
                {card.change} מהחודש שעבר
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Bar Chart */}
        <Text style={styles.sectionTitle}>MRR — 6 חודשים אחרונים</Text>
        <View style={styles.card}>
          <View style={styles.chartContainer}>
            {sorted.map((snap, i) => {
              const barH = maxMrr > 0 ? (snap.mrr / maxMrr) * CHART_HEIGHT * 0.8 : 0;
              return (
                <View key={snap.month} style={styles.barCol}>
                  <Text style={styles.barValueAbove}>₪{(snap.mrr / 1000).toFixed(1)}k</Text>
                  <View style={styles.barTrack}>
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      style={[styles.barFill, { height: barH }]}
                    />
                  </View>
                  <Text style={styles.barMonthLabel}>{MONTH_LABELS[snap.month] ?? snap.month}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Growth Table */}
        <Text style={styles.sectionTitle}>טבלת צמיחה חודשית</Text>
        <View style={styles.card}>
          {/* Header row */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>המרה</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>עזיבות</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>חדשים</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>MRR</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, styles.tableCellWide]}>חודש</Text>
          </View>
          {[...sorted].reverse().map((snap) => (
            <View key={snap.month} style={styles.tableRow}>
              <Text style={styles.tableCell}>
                {(snap.conversionRate * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.tableCell, { color: Colors.danger }]}>
                {snap.churnedSubscribers}
              </Text>
              <Text style={[styles.tableCell, { color: Colors.success }]}>
                {snap.newSubscribers}
              </Text>
              <Text style={[styles.tableCell, { color: Colors.primary, fontFamily: FontFamily.bold }]}>
                ₪{snap.mrr.toLocaleString()}
              </Text>
              <Text style={[styles.tableCell, styles.tableCellWide, { fontFamily: FontFamily.medium }]}>
                {MONTH_LABELS[snap.month] ?? snap.month}
              </Text>
            </View>
          ))}
        </View>

        {/* Conversion Funnel */}
        <Text style={styles.sectionTitle}>משפך המרה — יוני 2025</Text>
        <View style={styles.card}>
          {[
            { label: 'משתמשים פעילים', value: activeUsers, pct: 1, color: Colors.primary },
            { label: 'ניסיון חינמי', value: trialUsers, pct: trialUsers / activeUsers, color: Colors.accent },
            { label: 'פרמיום', value: latest.totalPremiumUsers, pct: latest.totalPremiumUsers / activeUsers, color: Colors.success },
          ].map((row, i) => (
            <View key={i} style={styles.funnelRow}>
              <View style={styles.funnelLabelWrap}>
                <Text style={styles.funnelPct}>{(row.pct * 100).toFixed(1)}%</Text>
                <Text style={styles.funnelValue}>{row.value.toLocaleString()}</Text>
                <Text style={styles.funnelLabel}>{row.label}</Text>
              </View>
              <View style={styles.funnelBarTrack}>
                <View
                  style={[
                    styles.funnelBarFill,
                    { width: `${row.pct * 100}%`, backgroundColor: row.color },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  content: { paddingBottom: 40 },

  header: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 28,
    alignItems: 'flex-end',
  },
  backBtn: { marginBottom: 8 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.lg, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', marginTop: 4 },

  summaryRow: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 16,
    minWidth: 160,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#334155',
    ...Shadow.md,
  },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', marginBottom: 6 },
  summaryValue: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  summaryChange: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, marginTop: 4 },

  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: '#fff',
    textAlign: 'right',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    ...Shadow.md,
  },

  // Bar Chart
  chartContainer: {
    flexDirection: 'row-reverse',
    height: CHART_HEIGHT + 40,
    alignItems: 'flex-end',
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValueAbove: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: '#94A3B8',
    marginBottom: 3,
    textAlign: 'center',
  },
  barTrack: {
    width: '100%',
    height: CHART_HEIGHT * 0.8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#0F172A',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barMonthLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },

  // Table
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingVertical: 10,
    alignItems: 'center',
  },
  tableHeader: {
    borderBottomColor: '#334155',
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 4,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: '#94A3B8',
    fontFamily: FontFamily.medium,
  },
  tableCell: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#E2E8F0',
    textAlign: 'center',
  },
  tableCellWide: { flex: 1.5, textAlign: 'right' },

  // Funnel
  funnelRow: { marginBottom: 16 },
  funnelLabelWrap: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  funnelLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#E2E8F0', flex: 1, textAlign: 'right' },
  funnelValue: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  funnelPct: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8', minWidth: 40, textAlign: 'right' },
  funnelBarTrack: { height: 14, backgroundColor: '#0F172A', borderRadius: 7, overflow: 'hidden' },
  funnelBarFill: { height: 14, borderRadius: 7 },
});
