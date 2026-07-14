import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { loadAdminState } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { logger } from '../../utils/logger';

const APPLE_APP_ID = '6776568241';
const APP_STORE_CONNECT_APP = `https://appstoreconnect.apple.com/apps/${APPLE_APP_ID}/appstore`;
const APP_STORE_CONNECT_ANALYTICS = `https://appstoreconnect.apple.com/analytics/app/${APPLE_APP_ID}/overview`;
const PUBLIC_APP_STORE_PAGE = `https://apps.apple.com/app/id${APPLE_APP_ID}`;
const ADMIN_EVENTS_KEY = 'admin_events';

type AdminEvent = {
  id: string;
  eventType: 'first_open' | 'signup' | 'purchase';
  occurredAt: string;
  platform?: string | null;
};

type ProfileRow = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  is_premium?: boolean | null;
  total_sessions?: number | null;
};

type DailyMetric = {
  date: string;
  firstOpens: number;
  signups: number;
  purchases: number;
  newProfiles: number;
};

function dateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatShortDate(key: string) {
  const date = new Date(`${key}T12:00:00.000Z`);
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

function buildLastDays(days = 14) {
  const result: string[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

export default function AppStoreAdminScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const [eventRows, profilesResult] = await Promise.all([
        loadAdminState<AdminEvent[]>(ADMIN_EVENTS_KEY),
        supabase.from('user_profiles').select('id,created_at,updated_at,is_premium,total_sessions'),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      setEvents(Array.isArray(eventRows) ? eventRows : []);
      setProfiles((profilesResult.data ?? []) as ProfileRow[]);
    } catch (e: any) {
      const message = e?.message ?? 'לא ניתן לטעון מדדי App Store כרגע';
      setError(message);
      logger.error('admin:app-store', 'Failed loading app store admin metrics', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('admin-app-store-metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_state', filter: `key=eq.${ADMIN_EVENTS_KEY}` }, () => loadData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => loadData(false))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const daily = useMemo<DailyMetric[]>(() => {
    const dates = buildLastDays(14);
    return dates.map(date => ({
      date,
      firstOpens: events.filter(event => event.eventType === 'first_open' && dateKey(event.occurredAt) === date).length,
      signups: events.filter(event => event.eventType === 'signup' && dateKey(event.occurredAt) === date).length,
      purchases: events.filter(event => event.eventType === 'purchase' && dateKey(event.occurredAt) === date).length,
      newProfiles: profiles.filter(profile => dateKey(profile.created_at) === date).length,
    }));
  }, [events, profiles]);

  const totals = useMemo(() => {
    const firstOpens = events.filter(event => event.eventType === 'first_open').length;
    const signups = events.filter(event => event.eventType === 'signup').length;
    const purchases = events.filter(event => event.eventType === 'purchase').length;
    const premium = profiles.filter(profile => profile.is_premium).length;
    const active = profiles.filter(profile => (profile.total_sessions ?? 0) > 0).length;
    return {
      firstOpens,
      signups,
      purchases,
      profiles: profiles.length,
      premium,
      active,
      signupRate: firstOpens > 0 ? Math.round((signups / firstOpens) * 100) : 0,
      purchaseRate: signups > 0 ? Math.round((purchases / signups) * 100) : 0,
    };
  }, [events, profiles]);

  const maxDaily = Math.max(1, ...daily.flatMap(day => [day.firstOpens, day.signups, day.purchases, day.newProfiles]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primaryLight} size="large" />
          <Text style={styles.loadingText}>טוען מדדי אפליקציה...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 34, 72) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={['#08111F', '#152238', '#1E293B']} style={styles.hero}>
          <Text style={styles.heroTitle}>מדדי App Store</Text>
          <Text style={styles.heroSub}>
            מרכז אחד למעקב אחרי עמוד האפליקציה באפל, פתיחות ראשונות, הרשמות ורכישות מתוך האפליקציה.
          </Text>
          <View style={styles.linkRow}>
            <LinkButton label="App Store Connect" url={APP_STORE_CONNECT_APP} />
            <LinkButton label="Analytics באפל" url={APP_STORE_CONNECT_ANALYTICS} />
            <LinkButton label="עמוד ציבורי" url={PUBLIC_APP_STORE_PAGE} secondary />
          </View>
        </LinearGradient>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>שגיאת טעינה</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>חשוב לגבי הורדות וצפיות רשמיות</Text>
          <Text style={styles.noticeText}>
            Apple לא חושפת לאפליקציה עצמה את מספר הצפיות בעמוד ואת ההורדות הרשמית בזמן אמת. הנתונים כאן הם מדדי שימוש פנימיים מסונכרנים מ-Supabase. לצפיות עמוד, הורדות רשמיות, Product Page Views ו-App Units יש לפתוח את הקישור “Analytics באפל”.
          </Text>
        </View>

        <View style={styles.grid}>
          <MetricCard title="פתיחות ראשונות" value={totals.firstOpens} hint="הקירוב הכי טוב להתקנות בפועל במכשיר" />
          <MetricCard title="פרופילים" value={totals.profiles} hint="משתמשים שקיימים ב-Supabase" />
          <MetricCard title="הרשמות" value={totals.signups} hint={`${totals.signupRate}% מתוך פתיחות ראשונות`} />
          <MetricCard title="רכישות" value={totals.purchases} hint={`${totals.purchaseRate}% מתוך הרשמות`} />
          <MetricCard title="משתמשים פעילים" value={totals.active} hint="לפחות סשן אחד" />
          <MetricCard title="פרימיום" value={totals.premium} hint="סטטוס פרימיום בפרופיל" />
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>14 ימים אחרונים</Text>
          <View style={styles.legendRow}>
            <Legend color={Colors.primaryLight} label="פתיחה ראשונה" />
            <Legend color={Colors.success} label="הרשמה" />
            <Legend color={Colors.warning} label="רכישה" />
            <Legend color="#38BDF8" label="פרופיל חדש" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
            {daily.map(day => (
              <View key={day.date} style={styles.dayColumn}>
                <View style={styles.bars}>
                  <Bar value={day.firstOpens} max={maxDaily} color={Colors.primaryLight} />
                  <Bar value={day.signups} max={maxDaily} color={Colors.success} />
                  <Bar value={day.purchases} max={maxDaily} color={Colors.warning} />
                  <Bar value={day.newProfiles} max={maxDaily} color="#38BDF8" />
                </View>
                <Text style={styles.dayLabel}>{formatShortDate(day.date)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sourceCard}>
          <Text style={styles.sectionTitle}>חיבור API עתידי</Text>
          <Text style={styles.sourceText}>
            כדי למשוך לכאן צפיות והורדות רשמיות מאפל בתוך הדשבורד, צריך לחבר Supabase Edge Function מאובטחת ל-App Store Connect API. אסור לשים את קובץ ה-p8 או issuer/key id בתוך קוד צד לקוח.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkButton({ label, url, secondary }: { label: string; url: string; secondary?: boolean }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={[styles.linkButton, secondary && styles.linkButtonSecondary]}>
      <Text style={[styles.linkButtonText, secondary && styles.linkButtonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({ title, value, hint }: { title: string; value: number; hint: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value.toLocaleString('he-IL')}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const height = Math.max(3, Math.round((value / max) * 92));
  return <View style={[styles.bar, { height, backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080A12', direction: 'rtl' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#CBD5E1', fontFamily: FontFamily.medium, textAlign: 'center', writingDirection: 'rtl' },
  content: { padding: 16, gap: 14 },
  hero: {
    borderRadius: Radius.lg,
    padding: 20,
    ...Shadow.lg,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroSub: {
    color: '#CBD5E1',
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 23,
  },
  linkRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  linkButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  linkButtonSecondary: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  linkButtonText: { color: '#FFFFFF', fontFamily: FontFamily.bold, textAlign: 'right', writingDirection: 'rtl' },
  linkButtonTextSecondary: { color: '#CBD5E1' },
  errorBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dangerGlow,
    backgroundColor: Colors.dangerLight,
    padding: 14,
  },
  errorTitle: { color: Colors.danger, fontFamily: FontFamily.bold, textAlign: 'right', writingDirection: 'rtl' },
  errorText: { color: Colors.text, fontFamily: FontFamily.regular, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  noticeBox: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.38)',
    backgroundColor: 'rgba(245,158,11,0.1)',
    padding: 14,
  },
  noticeTitle: { color: '#FDE68A', fontFamily: FontFamily.bold, textAlign: 'right', writingDirection: 'rtl' },
  noticeText: { color: '#E2E8F0', fontFamily: FontFamily.regular, marginTop: 6, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    flexGrow: 1,
    width: Platform.OS === 'web' ? '31%' : '47%',
    minWidth: 145,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: '#111827',
    padding: 14,
    alignItems: 'flex-end',
  },
  metricValue: { color: Colors.primaryLight, fontFamily: FontFamily.bold, fontSize: FontSize['2xl'], textAlign: 'right' },
  metricTitle: { color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: FontSize.base, textAlign: 'right', writingDirection: 'rtl' },
  metricHint: { color: '#94A3B8', fontFamily: FontFamily.regular, fontSize: FontSize.xs, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  chartCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: '#111827',
    padding: 14,
  },
  sectionTitle: { color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: FontSize.lg, textAlign: 'right', writingDirection: 'rtl' },
  legendRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: '#CBD5E1', fontFamily: FontFamily.medium, fontSize: FontSize.xs, textAlign: 'right', writingDirection: 'rtl' },
  chartScroll: { flexDirection: 'row', gap: 12, paddingTop: 18, paddingBottom: 6 },
  dayColumn: { alignItems: 'center', width: 50 },
  bars: { height: 102, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 8, borderRadius: 4 },
  dayLabel: { color: '#94A3B8', fontFamily: FontFamily.medium, fontSize: FontSize.xs, marginTop: 6 },
  sourceCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: '#111827',
    padding: 14,
  },
  sourceText: { color: '#CBD5E1', fontFamily: FontFamily.regular, lineHeight: 22, marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
});
