import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, Pressable,
  TextInput, Alert, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, VisitLogEntry } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

type FilterKey = 'all' | 'users' | 'guests';
type TimeRange = 'today' | 'week' | 'all';

function toIsraeliTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch { return iso; }
}

function toIsraeliDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      weekday: 'long', day: '2-digit', month: '2-digit', year: '2-digit',
    });
  } catch { return iso; }
}

function toIsraeliDateKey(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return iso; }
}

const ACTION_COLORS: Record<string, string> = {
  'ביקור': Colors.primary,
  'סשן הושלם': Colors.success,
  'התחברות': '#10B981',
  'התנתקות': Colors.textTertiary,
  'רכישה': Colors.warning,
  'קופון': '#F59E0B',
  'אתגר': Colors.accent,
};

function actionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return color;
  }
  return Colors.primary;
}

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all',    label: 'הכל',      icon: '📋' },
  { key: 'users',  label: 'משתמשים',  icon: '👤' },
  { key: 'guests', label: 'אורחים',   icon: '👁️' },
];

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'today', label: 'היום' },
  { key: 'week',  label: 'השבוע' },
  { key: 'all',   label: 'הכל' },
];

export default function VisitLogScreen() {
  const { visitLog, clearVisitLog } = useAdminStore();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    return visitLog.filter(entry => {
      if (filter === 'users' && entry.isGuest) return false;
      if (filter === 'guests' && !entry.isGuest) return false;

      const ts = new Date(entry.timestamp);
      if (timeRange === 'today' && ts < startOfToday) return false;
      if (timeRange === 'week' && ts < startOfWeek) return false;

      if (search) {
        const q = search.toLowerCase();
        return (
          entry.userName.toLowerCase().includes(q) ||
          entry.userEmail.toLowerCase().includes(q) ||
          entry.screen.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [visitLog, filter, timeRange, search]);

  const sections = useMemo(() => {
    const groups: Record<string, VisitLogEntry[]> = {};
    for (const entry of filtered) {
      const key = toIsraeliDateKey(entry.timestamp);
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  // Stats
  const totalToday = useMemo(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    return visitLog.filter(e => new Date(e.timestamp) >= startOfToday).length;
  }, [visitLog]);

  const uniqueUsersToday = useMemo(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const ids = new Set(visitLog.filter(e => !e.isGuest && new Date(e.timestamp) >= startOfToday).map(e => e.userId));
    return ids.size;
  }, [visitLog]);

  const guestVisitsToday = useMemo(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const sessions = new Set(visitLog.filter(e => e.isGuest && new Date(e.timestamp) >= startOfToday).map(e => e.sessionId));
    return sessions.size;
  }, [visitLog]);

  const handleClear = () => {
    Alert.alert('מחיקת יומן', 'האם למחוק את כל יומן הביקורים?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק הכל', style: 'destructive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); clearVisitLog(); } },
    ]);
  };

  const handleExport = async () => {
    const header = 'תאריך שעה (ישראל),משתמש,אימייל,אורח,מסך,פעולה,מידע נוסף,מזהה סשן';
    const rows = filtered.map(e => [
      `"${toIsraeliTime(e.timestamp)}"`,
      `"${e.userName}"`,
      `"${e.userEmail}"`,
      e.isGuest ? 'כן' : 'לא',
      `"${e.screen}"`,
      `"${e.action}"`,
      `"${e.meta ?? ''}"`,
      e.sessionId,
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const date = new Date().toISOString().split('T')[0];
    await Share.share({ message: csv, title: `visit-log-${date}.csv` });
  };

  const renderItem = ({ item }: { item: VisitLogEntry }) => {
    const color = actionColor(item.action);
    const initials = item.userName.slice(0, 1).toUpperCase();
    return (
      <View style={styles.entry}>
        <View style={[styles.avatar, item.isGuest && styles.avatarGuest]}>
          <Text style={styles.avatarText}>{item.isGuest ? '👁' : initials}</Text>
        </View>
        <View style={styles.entryBody}>
          <View style={styles.entryTop}>
            <Text style={[styles.entryAction, { color }]}>{item.action}</Text>
            <Text style={styles.entryScreen}>{item.screen}</Text>
          </View>
          <Text style={styles.entryUser}>
            {item.isGuest ? 'אורח' : item.userName}
            {item.userEmail ? ` · ${item.userEmail}` : ''}
          </Text>
          {item.meta ? <Text style={styles.entryMeta}>{item.meta}</Text> : null}
          <Text style={styles.entryTime}>{toIsraeliTime(item.timestamp)}</Text>
        </View>
        <View style={[styles.actionDot, { backgroundColor: color }]} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>🗑 מחק</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>→</Text>
          </Pressable>
        </View>
        <Text style={styles.headerTitle}>📍 יומן ביקורים ופעולות</Text>
        <Text style={styles.headerSub}>מעקב אחר כל משתמש, אורח ופעולה</Text>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatChip label="ביקורים היום" value={totalToday} color={Colors.primary} />
        <StatChip label="משתמשים" value={uniqueUsersToday} color={Colors.success} />
        <StatChip label="אורחים" value={guestVisitsToday} color={Colors.textSecondary} />
        <StatChip label="סה״כ" value={visitLog.length} color={Colors.accent} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="חיפוש לפי שם, אימייל, מסך..."
          placeholderTextColor="#475569"
          textAlign="right"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} style={styles.clearSearch}>
            <Text style={{ color: Colors.textTertiary }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filter + Time Range */}
      <View style={styles.filtersRow}>
        <View style={styles.filterGroup}>
          {FILTERS.map(f => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.icon} {f.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.filterGroup}>
          {TIME_RANGES.map(t => (
            <Pressable key={t.key} onPress={() => setTimeRange(t.key)} style={[styles.chip, timeRange === t.key && styles.chipActive]}>
              <Text style={[styles.chipText, timeRange === t.key && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Export button */}
      <View style={styles.exportRow}>
        <Pressable onPress={handleExport} style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>📤 ייצוא CSV ({filtered.length})</Text>
        </Pressable>
      </View>

      {/* List */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>אין רשומות להצגה</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length} רשומות</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
        />
      )}
    </SafeAreaView>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[statStyles.chip, { borderColor: color + '40' }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: { flex: 1, backgroundColor: '#1E293B', borderRadius: Radius.md, padding: 8, alignItems: 'center', borderWidth: 1, ...Shadow.sm },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  label: { fontFamily: FontFamily.regular, fontSize: 9, color: '#64748B', marginTop: 1, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  backBtn: { padding: 4 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.lg, color: '#94A3B8' },
  clearBtn: { padding: 6, borderRadius: Radius.md, backgroundColor: Colors.danger + '20', borderWidth: 1, borderColor: Colors.danger + '40' },
  clearBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.danger },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 2 },

  statsRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },

  searchWrap: { flexDirection: 'row-reverse', alignItems: 'center', marginHorizontal: 12, marginBottom: 8 },
  searchInput: {
    flex: 1, height: 40, backgroundColor: '#1E293B', borderRadius: Radius.lg,
    paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155',
    color: '#fff', fontFamily: FontFamily.regular, fontSize: FontSize.sm,
  },
  clearSearch: { position: 'absolute', left: 12, padding: 4 },

  filtersRow: { paddingHorizontal: 12, gap: 6, marginBottom: 6 },
  filterGroup: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8' },
  chipTextActive: { color: '#fff' },

  exportRow: { paddingHorizontal: 12, marginBottom: 8 },
  exportBtn: { backgroundColor: '#1E293B', borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#334155', alignSelf: 'flex-end' },
  exportBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8' },

  listContent: { paddingHorizontal: 12, paddingBottom: 40 },

  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A', paddingVertical: 8, paddingHorizontal: 4 },
  sectionHeaderText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  sectionCount: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },

  entry: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B20',
    position: 'relative',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + '30', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarGuest: { backgroundColor: '#334155' },
  avatarText: { fontFamily: FontFamily.bold, fontSize: 14, color: '#fff' },
  entryBody: { flex: 1 },
  entryTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  entryAction: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  entryScreen: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8' },
  entryUser: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text, marginTop: 2, textAlign: 'right' },
  entryMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1, textAlign: 'right' },
  entryTime: { fontFamily: FontFamily.regular, fontSize: 10, color: '#475569', marginTop: 3 },
  actionDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
});
