import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, Pressable, Alert, TextInput, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, AdminActivityLog } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

type FilterKey = 'all' | AdminActivityLog['category'];

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all',          label: 'הכל',       icon: '📋' },
  { key: 'page',         label: 'ביקורים',   icon: '👁️' },
  { key: 'question',     label: 'שאלות',     icon: '❓' },
  { key: 'user',         label: 'משתמשים',   icon: '👤' },
  { key: 'promo',        label: 'קופונים',   icon: '🎟️' },
  { key: 'notification', label: 'הודעות',    icon: '🔔' },
  { key: 'system',       label: 'מערכת',     icon: '⚙️' },
  { key: 'session',      label: 'סשנים',     icon: '🎯' },
  { key: 'import',       label: 'ייבוא',     icon: '📥' },
];

const CATEGORY_COLORS: Record<AdminActivityLog['category'], string> = {
  page:         Colors.primary,
  question:     Colors.primary,
  user:         Colors.accent,
  promo:        Colors.success,
  notification: '#F59E0B',
  system:       Colors.textTertiary,
  session:      '#10B981',
  import:       '#F59E0B',
};

const CATEGORY_BG: Record<AdminActivityLog['category'], string> = {
  page:         Colors.primaryLighter,
  question:     Colors.primaryLighter,
  user:         Colors.accentLight,
  promo:        Colors.successLight,
  notification: '#FEF3C7',
  system:       Colors.surfaceSecondary,
  session:      '#10B98115',
  import:       '#F59E0B15',
};

const CATEGORY_ICONS: Record<AdminActivityLog['category'], string> = {
  page:         '👁️',
  question:     '❓',
  user:         '👤',
  promo:        '🎟️',
  notification: '🔔',
  system:       '⚙️',
  session:      '🎯',
  import:       '📥',
};

// Format a UTC ISO timestamp to Israeli time (Asia/Jerusalem)
function toIsraeliTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

// Relative time label (still useful for recent items)
function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

// Group logs by Israeli-time date string
function groupByIsraeliDate(
  logs: AdminActivityLog[]
): { title: string; data: AdminActivityLog[] }[] {
  const nowIL = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayIL = yesterdayDate.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

  const buckets: Map<string, AdminActivityLog[]> = new Map();

  for (const log of logs) {
    const dateIL = new Date(log.timestamp).toLocaleDateString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const key = new Date(log.timestamp).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

    let label = dateIL;
    if (key === nowIL) label = `היום — ${dateIL}`;
    else if (key === yesterdayIL) label = `אתמול — ${dateIL}`;

    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(log);
  }

  return Array.from(buckets.entries()).map(([title, data]) => ({ title, data }));
}

export default function ActivityLogScreen() {
  const insets = useSafeAreaInsets();
  const { activityLog, clearActivityLog, sessionHistory, loadSessionHistory } = useAdminStore();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    loadSessionHistory().catch(() => null);
  }, [loadSessionHistory]);

  const sessionLogs = useMemo<AdminActivityLog[]>(() => sessionHistory.slice(0, 300).map(session => {
    const userLabel = session.userName || (session.userId?.startsWith('guest_') ? 'אורח' : `משתמש ${session.userId.slice(0, 8)}`);
    return {
      id: `session_${session.id}`,
      category: 'session',
      timestamp: session.completedAt || session.startedAt || new Date().toISOString(),
      action: `${userLabel} סיים ${session.mode === 'simulation' ? 'סימולציה' : 'תרגול'} — ${session.correctAnswers}/${session.totalQuestions} נכון, ציון ${session.score}${session.userId?.startsWith('guest_') ? ' (אורח ללא הרשמה)' : ''}`,
    };
  }), [sessionHistory]);

  const combinedLog = useMemo(() => {
    const byId = new Map<string, AdminActivityLog>();
    [...activityLog, ...sessionLogs].forEach(log => byId.set(log.id, log));
    return Array.from(byId.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [activityLog, sessionLogs]);

  const filtered = useMemo(() => {
    let list = combinedLog;
    if (filter !== 'all') list = list.filter(l => l.category === filter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(l => l.action.toLowerCase().includes(s));
    }
    return list;
  }, [combinedLog, filter, search]);

  const grouped = useMemo(() => groupByIsraeliDate(filtered), [filtered]);

  // Count by category
  const counts = useMemo(() => {
    const c: Partial<Record<FilterKey, number>> = { all: combinedLog.length };
    for (const log of combinedLog) {
      c[log.category] = (c[log.category] ?? 0) + 1;
    }
    return c;
  }, [combinedLog]);

  const guestSessionsCount = useMemo(
    () => sessionHistory.filter(session => session.userId?.startsWith('guest_')).length,
    [sessionHistory],
  );

  const handleClear = () => {
    Alert.alert(
      'ניקוי יומן',
      `האם לנקות את ${activityLog.length} פעולות המנהל המקומיות? סשנים מסופאבייס לא יימחקו.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'נקה הכל',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            clearActivityLog();
          },
        },
      ]
    );
  };

  const renderItem = ({ item, index, section }: { item: AdminActivityLog; index: number; section: { data: AdminActivityLog[] } }) => {
    const color = CATEGORY_COLORS[item.category];
    const bg = CATEGORY_BG[item.category];
    const icon = CATEGORY_ICONS[item.category];
    const isLast = index === section.data.length - 1;

    return (
      <View style={styles.logRow}>
        {/* Timeline column */}
        <View style={styles.timelineCol}>
          <View style={[styles.iconCircle, { backgroundColor: bg, borderColor: color }]}>
            <Text style={styles.iconText}>{icon}</Text>
          </View>
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: color + '30' }]} />}
        </View>

        {/* Content */}
        <View style={[styles.logContent, isLast && { borderBottomWidth: 0 }]}>
          <View style={styles.logHeader}>
            <Text style={[styles.categoryLabel, { color }]}>
              {FILTERS.find(f => f.key === item.category)?.label ?? item.category}
            </Text>
            <Text style={styles.logRelative}>{relativeTime(item.timestamp)}</Text>
          </View>
          <Text style={styles.logAction}>{item.action}</Text>
          <Text style={styles.logTimestamp}>{toIsraeliTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Hero header */}
      <LinearGradient colors={['#0F172A', '#1E1B4B']} style={styles.hero}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroTitle}>📋 יומן פעילות</Text>
            <Text style={styles.heroSub}>תיעוד בזמן ישראל (UTC+3)</Text>
          </View>
          <View style={styles.heroStats}>
            <Text style={styles.heroCount}>{combinedLog.length}</Text>
            <Text style={styles.heroCountLabel}>אירועים · {guestSessionsCount} אורחים</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 חיפוש ביומן..."
            placeholderTextColor="#475569"
            value={search}
            onChangeText={setSearch}
            textAlign="right"
            clearButtonMode="while-editing"
          />
        </View>
      </LinearGradient>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map(f => {
          const count = counts[f.key] ?? 0;
          const isActive = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
            >
              <Text style={styles.filterIcon}>{f.icon}</Text>
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, isActive && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={[styles.filterBadgeText, isActive && { color: '#fff' }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Results count */}
      {search.trim() || filter !== 'all' ? (
        <Text style={styles.resultCount}>{filtered.length} תוצאות</Text>
      ) : null}

      {/* Timeline list */}
      {grouped.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>אין פעולות מתועדות</Text>
          <Text style={styles.emptyHint}>פעולות ניהול וסשנים של משתמשים ואורחים יתועדו כאן אוטומטית</Text>
        </View>
      ) : (
        <SectionList
          sections={grouped}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Clear FAB */}
      {activityLog.length > 0 && (
        <Pressable
          onPress={handleClear}
          style={[styles.clearFab, { bottom: Math.max(24, insets.bottom + 16) }]}
        >
          <Text style={styles.clearFabText}>🗑️</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F1E' },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  heroRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  heroTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  heroSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#64748B', textAlign: 'right', marginTop: 2 },
  heroStats: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 8 },
  heroCount: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: Colors.primary },
  heroCountLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: '#64748B' },

  searchWrap: {},
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.lg,
    padding: 11,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#1E293B',
  },

  filtersScroll: { maxHeight: 48, backgroundColor: '#0F172A' },
  filtersRow: { paddingHorizontal: 14, paddingVertical: 8, gap: 8, flexDirection: 'row-reverse' },
  filterChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterIcon: { fontSize: 12 },
  filterText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8' },
  filterTextActive: { color: '#fff' },
  filterBadge: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  filterBadgeText: { fontFamily: FontFamily.bold, fontSize: 10, color: '#94A3B8' },

  resultCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#475569',
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#0F172A',
  },

  list: { paddingHorizontal: 16, paddingTop: 4, backgroundColor: '#0A0F1E' },

  sectionHeader: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#475569',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  logRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    minHeight: 56,
  },
  timelineCol: {
    alignItems: 'center',
    width: 36,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  iconText: { fontSize: 14 },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: 0,
    minHeight: 12,
  },

  logContent: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  logHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  categoryLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logRelative: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#475569',
  },
  logAction: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#E2E8F0',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 3,
  },
  logTimestamp: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#334155',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#475569', marginBottom: 6 },
  emptyHint: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#334155', textAlign: 'center' },

  clearFab: {
    position: 'absolute',
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.danger + '50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  clearFabText: { fontSize: 20 },
});
