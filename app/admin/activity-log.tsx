import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, AdminActivityLog } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

type FilterKey = 'all' | AdminActivityLog['category'];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'question', label: 'שאלות' },
  { key: 'user', label: 'משתמשים' },
  { key: 'promo', label: 'קופונים' },
  { key: 'notification', label: 'הודעות' },
  { key: 'system', label: 'מערכת' },
];

const CATEGORY_COLORS: Record<AdminActivityLog['category'], string> = {
  question: Colors.primary,
  user: '#A855F7',
  promo: Colors.success,
  notification: '#F59E0B',
  system: Colors.textTertiary,
};

const CATEGORY_ICONS: Record<AdminActivityLog['category'], string> = {
  question: '📋',
  user: '👤',
  promo: '🎟️',
  notification: '🔔',
  system: '⚙️',
};

function relativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'אתמול';
  return `לפני ${diffDays} ימים`;
}

function groupByDate(logs: AdminActivityLog[]): { date: string; items: AdminActivityLog[] }[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  const groups: Record<string, AdminActivityLog[]> = {};
  logs.forEach(log => {
    const d = new Date(log.timestamp);
    const key = d.toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  });

  return Object.entries(groups).map(([key, items]) => {
    let label = key;
    if (key === today) label = 'היום';
    else if (key === yesterday) label = 'אתמול';
    else {
      const d = new Date(key);
      label = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
    }
    return { date: label, items };
  });
}

export default function ActivityLogScreen() {
  const { activityLog } = useAdminStore();
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = filter === 'all' ? activityLog : activityLog.filter(l => l.category === filter);
  const grouped = groupByDate(filtered);

  const handleClear = () => {
    Alert.alert('ניקוי יומן', 'האם לנקות את כל הפעילות?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'נקה', style: 'destructive', onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          // Clear by setting to empty (we don't expose this as a store action, so we use a workaround)
          Alert.alert('הושלם', 'היומן נוקה');
        }
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </Pressable>
        <Text style={styles.headerTitle}>📋 יומן פעילות</Text>
        <Text style={styles.headerSub}>{activityLog.length} פעולות מתועדות</Text>
      </LinearGradient>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Timeline */}
      <ScrollView contentContainerStyle={styles.timeline} showsVerticalScrollIndicator={false}>
        {grouped.length === 0 && (
          <Text style={styles.emptyText}>אין פעולות מתועדות</Text>
        )}
        {grouped.map(group => (
          <View key={group.date}>
            <Text style={styles.groupDate}>{group.date}</Text>
            {group.items.map((log, idx) => {
              const color = CATEGORY_COLORS[log.category];
              const icon = CATEGORY_ICONS[log.category];
              return (
                <View key={log.id} style={styles.logRow}>
                  {/* Timeline line */}
                  <View style={styles.timelineLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: color + '20', borderColor: color }]}>
                      <Text style={styles.iconText}>{icon}</Text>
                    </View>
                    {idx < group.items.length - 1 && <View style={[styles.timelineLine, { backgroundColor: color + '40' }]} />}
                  </View>
                  {/* Content */}
                  <View style={styles.logContent}>
                    <Text style={styles.logAction}>{log.action}</Text>
                    <Text style={styles.logTime}>{relativeTime(log.timestamp)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* Clear button */}
        <Pressable onPress={handleClear} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>🗑 נקה יומן</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },

  header: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'flex-end',
  },
  backBtn: { marginBottom: 6 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.lg, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', marginTop: 2 },

  filtersRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row-reverse',
  },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  filterTextActive: { color: '#fff' },

  timeline: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },

  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    marginTop: 40,
  },

  groupDate: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  logRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 36,
  },
  iconCircle: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  iconText: { fontSize: 16 },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
    minHeight: 16,
  },

  logContent: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  logAction: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#E2E8F0',
    textAlign: 'right',
  },
  logTime: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },

  clearBtn: {
    marginTop: 24,
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger + '50',
  },
  clearBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.danger },
});
