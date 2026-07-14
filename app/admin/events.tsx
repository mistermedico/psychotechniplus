import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { loadAdminState } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

type AdminEventType = 'first_open' | 'signup' | 'purchase';
type Filter = 'all' | AdminEventType;

type AdminEvent = {
  id: string;
  eventType: AdminEventType;
  title?: string;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  occurredAt: string;
  details?: Record<string, unknown>;
};

const ADMIN_EVENTS_KEY = 'admin_events';

function eventLabel(type: AdminEventType) {
  if (type === 'first_open') return 'התקנה / פתיחה ראשונה';
  if (type === 'signup') return 'הרשמה';
  return 'רכישה';
}

function formatDate(iso?: string) {
  if (!iso) return 'לא ידוע';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'לא ידוע';
  return date.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDetails(details?: Record<string, unknown>) {
  const entries = Object.entries(details ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return 'אין פרטים נוספים';
  return entries.map(([key, value]) => {
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `${key}: ${text}`;
  }).join('\n');
}

export default function AdminEventsScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const next = await loadAdminState<AdminEvent[]>(ADMIN_EVENTS_KEY);
    setEvents(Array.isArray(next) ? next : []);
    if (showLoader) setLoading(false);
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('admin-events-screen')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_state', filter: `key=eq.${ADMIN_EVENTS_KEY}` },
        () => refresh(false),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredEvents = useMemo(() => {
    const search = query.trim().toLowerCase();
    return events.filter(event => {
      if (filter !== 'all' && event.eventType !== filter) return false;
      if (!search) return true;
      const haystack = [
        event.title,
        event.userId,
        event.email,
        event.name,
        event.platform,
        event.appVersion,
        JSON.stringify(event.details ?? {}),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [events, filter, query]);

  const installs = events.filter(event => event.eventType === 'first_open').length;
  const signups = events.filter(event => event.eventType === 'signup').length;
  const purchases = events.filter(event => event.eventType === 'purchase').length;
  const latest = events[0]?.occurredAt ? formatDate(events[0].occurredAt) : 'אין אירועים';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.hero}>
          <Text style={styles.heroTitle}>התקנות ורכישות</Text>
          <Text style={styles.heroSub}>
            כל פתיחה ראשונה, הרשמה ורכישה נשמרות בענן ומסתנכרנות כאן בזמן אמת.
          </Text>
          <Text style={styles.heroNote}>
            הערה: Apple אינה שולחת לאפליקציה אירוע הורדה ישיר, לכן התקנה נמדדת לפי פתיחה ראשונה במכשיר.
          </Text>
          <View style={styles.statsRow}>
            <Stat label="פתיחות ראשונות" value={installs} color={Colors.primaryLight} />
            <Stat label="הרשמות" value={signups} color={Colors.success} />
            <Stat label="רכישות" value={purchases} color={Colors.warning} />
            <Stat label="אירוע אחרון" value={latest} color="#E0E7FF" small />
          </View>
        </LinearGradient>

        <View style={styles.toolbar}>
          <Pressable onPress={() => refresh()} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>רענן</Text>
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="חיפוש לפי מייל, משתמש, מוצר או פרטים"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['all', 'first_open', 'signup', 'purchase'] as Filter[]).map(item => (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                {item === 'all' ? 'הכל' : eventLabel(item)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={Colors.primaryLight} style={{ marginTop: 34 }} />
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>אין אירועים להצגה</Text>
            <Text style={styles.emptyText}>כשמשתמש יפתח את האפליקציה לראשונה, יירשם או ירכוש פרימיום, הפרטים יופיעו כאן.</Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {filteredEvents.map(event => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventTop}>
                  <View style={[styles.eventBadge, event.eventType === 'purchase' && styles.purchaseBadge, event.eventType === 'signup' && styles.signupBadge]}>
                    <Text style={styles.eventBadgeText}>{eventLabel(event.eventType)}</Text>
                  </View>
                  <Text style={styles.eventDate}>{formatDate(event.occurredAt)}</Text>
                </View>
                <Text style={styles.eventTitle}>{event.title || eventLabel(event.eventType)}</Text>
                <View style={styles.metaGrid}>
                  <Meta label="מייל" value={event.email || 'לא ידוע'} />
                  <Meta label="שם" value={event.name || 'לא ידוע'} />
                  <Meta label="User ID" value={event.userId || 'לא ידוע'} />
                  <Meta label="פלטפורמה" value={event.platform || 'לא ידוע'} />
                  <Meta label="גרסה" value={event.appVersion || 'לא ידוע'} />
                </View>
                <View style={styles.detailsBox}>
                  <Text style={styles.detailsTitle}>פרטים מלאים</Text>
                  <Text style={styles.detailsText}>{formatDetails(event.details)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color, small }: { label: string; value: number | string; color: string; small?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }, small && styles.statSmall]} numberOfLines={2}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080A12', direction: 'rtl' },
  content: { padding: 16, direction: 'rtl' },
  hero: {
    borderRadius: Radius.lg,
    padding: 20,
    marginBottom: 16,
    ...Shadow.lg,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroSub: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: '#CBD5E1',
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  statCard: {
    flexGrow: 1,
    minWidth: Platform.OS === 'web' ? 150 : 140,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    borderRadius: Radius.md,
    padding: 12,
    alignItems: 'flex-start',
  },
  statValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statSmall: { fontSize: FontSize.sm },
  statLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#CBD5E1',
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  toolbar: {
    flexDirection: 'row-reverse',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  refreshBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  refreshText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: '#111827',
    color: '#F8FAFC',
    paddingHorizontal: 14,
    fontFamily: FontFamily.medium,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  filters: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#111827',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryLight },
  filterText: {
    color: '#CBD5E1',
    fontFamily: FontFamily.medium,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  filterTextActive: { color: '#FFFFFF', fontFamily: FontFamily.bold },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: Radius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emptyText: {
    marginTop: 8,
    fontFamily: FontFamily.regular,
    color: '#CBD5E1',
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eventsList: { gap: 12 },
  eventCard: {
    backgroundColor: '#111827',
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    ...Shadow.md,
  },
  eventTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  eventBadge: {
    backgroundColor: 'rgba(124,111,247,0.18)',
    borderColor: 'rgba(124,111,247,0.55)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  signupBadge: {
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderColor: 'rgba(16,185,129,0.5)',
  },
  purchaseBadge: {
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderColor: 'rgba(245,158,11,0.5)',
  },
  eventBadgeText: {
    color: '#F8FAFC',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eventDate: {
    color: '#94A3B8',
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    textAlign: 'left',
  },
  eventTitle: {
    marginTop: 12,
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metaGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaItem: {
    flexGrow: 1,
    minWidth: Platform.OS === 'web' ? 190 : 150,
    backgroundColor: '#0B1220',
    borderRadius: Radius.md,
    padding: 10,
  },
  metaLabel: {
    color: '#94A3B8',
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metaValue: {
    color: '#E2E8F0',
    fontFamily: FontFamily.medium,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailsBox: {
    marginTop: 12,
    backgroundColor: '#0B1220',
    borderRadius: Radius.md,
    padding: 12,
  },
  detailsTitle: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailsText: {
    marginTop: 8,
    color: '#CBD5E1',
    fontFamily: FontFamily.regular,
    lineHeight: 21,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
