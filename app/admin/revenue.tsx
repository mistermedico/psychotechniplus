import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAdminStore } from '../../store/adminStore';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const CHART_HEIGHT = 160;
const MONTH_LABELS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

interface ProfileStats {
  totalUsers: number;
  premiumUsers: number;
  active30Days: number;
}

export default function RevenueScreen() {
  const { revenueSnapshots, loadAdminData } = useAdminStore();
  const [profileStats, setProfileStats] = useState<ProfileStats>({ totalUsers: 0, premiumUsers: 0, active30Days: 0 });
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  useEffect(() => {
    loadAdminData();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const loadProfiles = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('is_premium,last_practiced_date');

        const rows = data ?? [];
        setProfileStats({
          totalUsers: rows.length,
          premiumUsers: rows.filter(row => row.is_premium).length,
          active30Days: rows.filter(row => row.last_practiced_date && row.last_practiced_date >= cutoffDate).length,
        });
      setLoadingProfiles(false);
    };

    loadProfiles().catch(() => setLoadingProfiles(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(
    () => [...revenueSnapshots].sort((a, b) => a.month.localeCompare(b.month)),
    [revenueSnapshots]
  );
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  const latestMrr = latest?.mrr ?? 0;
  const prevMrr = prev?.mrr ?? 0;
  const latestPremium = latest?.totalPremiumUsers ?? profileStats.premiumUsers;
  const prevPremium = prev?.totalPremiumUsers ?? 0;
  const latestConversion = latest?.conversionRate ?? (profileStats.totalUsers > 0 ? profileStats.premiumUsers / profileStats.totalUsers : 0);
  const prevConversion = prev?.conversionRate ?? 0;
  const churnRate = latestPremium > 0 ? (latest?.churnedSubscribers ?? 0) / latestPremium : 0;
  const prevChurnRate = prevPremium > 0 ? (prev?.churnedSubscribers ?? 0) / prevPremium : churnRate;

  const summaryCards = [
    {
      label: 'MRR מתועד',
      value: `₪${latestMrr.toLocaleString()}`,
      change: prev && prevMrr > 0 ? `${Math.round(((latestMrr - prevMrr) / prevMrr) * 100)}%` : 'אין נתון קודם',
      up: latestMrr >= prevMrr,
    },
    {
      label: 'משתמשי פרימיום',
      value: String(latestPremium),
      change: prev && prevPremium > 0 ? `${Math.round(((latestPremium - prevPremium) / prevPremium) * 100)}%` : 'מחושב מפרופילים',
      up: latestPremium >= prevPremium,
    },
    {
      label: 'המרה',
      value: `${(latestConversion * 100).toFixed(1)}%`,
      change: `${((latestConversion - prevConversion) * 100).toFixed(1)}%`,
      up: latestConversion >= prevConversion,
    },
    {
      label: 'Churn מתועד',
      value: `${(churnRate * 100).toFixed(1)}%`,
      change: `${Math.abs((churnRate - prevChurnRate) * 100).toFixed(1)}%`,
      up: churnRate <= prevChurnRate,
    },
  ];

  const maxMrr = Math.max(...sorted.map(s => s.mrr), 1);
  const totalUsers = profileStats.totalUsers;
  const activeUsers = profileStats.active30Days;
  const freeUsers = Math.max(totalUsers - latestPremium, 0);
  const funnelRows = [
    { label: 'סה"כ משתמשים', value: totalUsers, pct: totalUsers > 0 ? 1 : 0, color: Colors.primary },
    { label: 'פעילים ב-30 יום', value: activeUsers, pct: totalUsers > 0 ? activeUsers / totalUsers : 0, color: Colors.accent },
    { label: 'חינמיים', value: freeUsers, pct: totalUsers > 0 ? freeUsers / totalUsers : 0, color: Colors.warning },
    { label: 'פרימיום', value: latestPremium, pct: totalUsers > 0 ? latestPremium / totalUsers : 0, color: Colors.success },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>חזרה</Text>
          </Pressable>
          <Text style={styles.headerTitle}>הכנסות ומנויים</Text>
          <Text style={styles.headerSub}>
            נתוני פרימיום נמשכים מ-Supabase. הכנסה כספית תישאר 0 עד חיבור טבלת רכישות/RevenueCat.
          </Text>
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
          {summaryCards.map(card => (
            <View key={card.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={styles.summaryValue}>{card.value}</Text>
              <Text style={[styles.summaryChange, { color: card.up ? Colors.success : Colors.danger }]}>{card.change}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>MRR מתועד - 6 חודשים אחרונים</Text>
        <View style={styles.card}>
          {sorted.length === 0 ? (
            <EmptyState text="אין עדיין נתוני הכנסה אמיתיים." />
          ) : (
            <View style={styles.chartContainer}>
              {sorted.map(snap => {
                const monthIndex = Number(snap.month.slice(5, 7)) - 1;
                return (
                  <View key={snap.month} style={styles.barCol}>
                    <Text style={styles.barValueAbove}>₪{snap.mrr.toLocaleString()}</Text>
                    <View style={styles.barTrack}>
                      <LinearGradient
                        colors={['#4F46E5', '#7C3AED']}
                        style={[styles.barFill, { height: (snap.mrr / maxMrr) * CHART_HEIGHT * 0.8 }]}
                      />
                    </View>
                    <Text style={styles.barMonthLabel}>{MONTH_LABELS[monthIndex] ?? snap.month}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>צמיחת פרימיום לפי פרופילים</Text>
        <View style={styles.card}>
          {sorted.length === 0 ? (
            <EmptyState text="אין עדיין פרופילי משתמשים לחישוב." />
          ) : (
            [...sorted].reverse().map(snap => {
              const monthIndex = Number(snap.month.slice(5, 7)) - 1;
              return (
                <View key={snap.month} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{(snap.conversionRate * 100).toFixed(1)}%</Text>
                  <Text style={[styles.tableCell, { color: Colors.danger }]}>{snap.churnedSubscribers}</Text>
                  <Text style={[styles.tableCell, { color: Colors.success }]}>{snap.newSubscribers}</Text>
                  <Text style={[styles.tableCell, { color: Colors.primary, fontFamily: FontFamily.bold }]}>₪{snap.mrr.toLocaleString()}</Text>
                  <Text style={[styles.tableCell, styles.tableCellWide]}>{MONTH_LABELS[monthIndex] ?? snap.month}</Text>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>משפך המרה אמיתי</Text>
        <View style={styles.card}>
          {loadingProfiles ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            funnelRows.map(row => (
              <View key={row.label} style={styles.funnelRow}>
                <View style={styles.funnelLabelWrap}>
                  <Text style={styles.funnelPct}>{(row.pct * 100).toFixed(1)}%</Text>
                  <Text style={styles.funnelValue}>{row.value.toLocaleString()}</Text>
                  <Text style={styles.funnelLabel}>{row.label}</Text>
                </View>
                <View style={styles.funnelBarTrack}>
                  <View style={[styles.funnelBarFill, { width: `${row.pct * 100}%`, backgroundColor: row.color }]} />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  content: { paddingBottom: 40 },
  header: { padding: 24, paddingTop: 20, paddingBottom: 28, alignItems: 'flex-end' },
  backBtn: { marginBottom: 8, minHeight: 44, justifyContent: 'center' },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', marginTop: 4, textAlign: 'right', lineHeight: 20 },
  summaryRow: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  summaryCard: { backgroundColor: '#1E293B', borderRadius: Radius.xl, padding: 16, minWidth: 168, alignItems: 'flex-end', borderWidth: 1, borderColor: '#334155', ...Shadow.md },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', marginBottom: 6, textAlign: 'right' },
  summaryValue: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  summaryChange: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, marginTop: 4, textAlign: 'right' },
  sectionTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: '#fff', textAlign: 'right', paddingHorizontal: 16, marginTop: 8, marginBottom: 10 },
  card: { backgroundColor: '#1E293B', borderRadius: Radius.xl, padding: 16, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155', ...Shadow.md },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', textAlign: 'center', paddingVertical: 18 },
  chartContainer: { flexDirection: 'row-reverse', height: CHART_HEIGHT + 40, alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValueAbove: { fontFamily: FontFamily.medium, fontSize: 9, color: '#94A3B8', marginBottom: 3, textAlign: 'center' },
  barTrack: { width: '100%', height: CHART_HEIGHT * 0.8, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 6, backgroundColor: '#0F172A' },
  barFill: { width: '100%', borderRadius: 6 },
  barMonthLabel: { fontFamily: FontFamily.medium, fontSize: 9, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  tableRow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#0F172A', paddingVertical: 10, alignItems: 'center' },
  tableCell: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#E2E8F0', textAlign: 'center' },
  tableCellWide: { flex: 1.5, textAlign: 'right', fontFamily: FontFamily.medium },
  funnelRow: { marginBottom: 16 },
  funnelLabelWrap: { flexDirection: 'row-reverse', justifyContent: 'flex-start', alignItems: 'center', gap: 8, marginBottom: 6 },
  funnelLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#E2E8F0', flex: 1, textAlign: 'right' },
  funnelValue: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  funnelPct: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8', minWidth: 44, textAlign: 'right' },
  funnelBarTrack: { height: 14, backgroundColor: '#0F172A', borderRadius: 7, overflow: 'hidden' },
  funnelBarFill: { height: 14, borderRadius: 7 },
});
