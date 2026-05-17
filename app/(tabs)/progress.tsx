import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
import { TOPICS } from '../../data/mockData';
import { ProgressBar } from '../../components/ProgressBar';
import { StatCard } from '../../components/StatCard';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { eloToTitle, eloToProgress } from '../../utils/elo';

const BADGE_INFO: Record<string, { icon: string; label: string; desc: string }> = {
  first_session: { icon: '🌱', label: 'סשן ראשון', desc: 'השלמת את הסשן הראשון שלך' },
  streak_7: { icon: '🔥', label: 'שבוע רצוף', desc: '7 ימי תרגול ברצף' },
  streak_30: { icon: '🌟', label: 'חודש רצוף!', desc: '30 ימי תרגול ברצף' },
  perfect_score: { icon: '💯', label: 'ניקוד מושלם', desc: '100% בסשן אחד' },
  speed_master: { icon: '⚡', label: 'מהיר כברק', desc: 'ענית נכון ב-< 10 שניות על 5 שאלות' },
  topic_complete: { icon: '🏆', label: 'נושא הושלם', desc: 'השלמת נושא שלם' },
  simulation_pass: { icon: '🎖️', label: 'עבר סימולציה', desc: 'עברת סימולציה בהצלחה' },
  level_up: { icon: '⬆️', label: 'רמה חדשה!', desc: 'עלית רמה' },
};

const ALL_BADGES = Object.entries(BADGE_INFO).map(([type, info]) => ({ type, ...info }));

// Hebrew day-of-week letters (א = Sunday ... ש = Saturday)
const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export default function ProgressTab() {
  const {
    name, level, xp, streak, longestStreak,
    totalSessions, totalCorrect, totalAnswered,
    badges, selectedTargetId, getTopicElo,
  } = useUserStore();

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const topics = TOPICS.filter(t => t.targetId === selectedTargetId);
  const earnedBadgeTypes = new Set(badges.map(b => b.badgeType));
  const earnedCount = badges.filter(b => BADGE_INFO[b.badgeType]).length;
  const xpForNext = level * 100;
  const xpPercent = Math.min(100, Math.round((xp / xpForNext) * 100));

  // XP bar animated entrance — 0 → actual value over 800ms
  const xpAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(xpAnim, {
      toValue: xpPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [xpPercent]);

  const xpWidth = xpAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Empty state — no sessions yet
  if (totalSessions === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateEmoji}>🎯</Text>
          <Text style={styles.emptyStateTitle}>עוד אין נתונים</Text>
          <Text style={styles.emptyStateBody}>
            השלם את הסשן הראשון שלך כדי לעקוב אחר ההתקדמות שלך
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.emptyStateCta,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)/practice');
            }}
          >
            <Text style={styles.emptyStateCtaText}>→ לתרגול</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 'fast'}
      >
        <Text style={styles.title}>ההתקדמות שלי</Text>

        {/* Level card with animated XP bar */}
        <LinearGradient
          colors={Colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.levelCard}
        >
          <View style={styles.levelTop}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNum}>{level}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>רמה {level}</Text>
              <Text style={styles.levelXp}>{xp} / {xpForNext} XP לרמה הבאה</Text>
            </View>
          </View>
          <View style={styles.xpTrack}>
            <Animated.View style={[styles.xpFill, { width: xpWidth }]} />
          </View>
        </LinearGradient>

        {/* Stats grid */}
        <Text style={styles.sectionTitle}>סטטיסטיקות כלליות</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="🎯" label="סשנים" value={totalSessions} color={Colors.primary} />
          <StatCard icon="✅" label="נכון" value={totalCorrect} color={Colors.success} />
        </View>
        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard icon="📊" label="דיוק" value={`${accuracy}%`} color={Colors.accent} />
          <StatCard icon="🔥" label="רצף" value={`${streak} ימים`} color={Colors.warning} />
        </View>
        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard icon="🏅" label="רצף שיא" value={`${longestStreak} ימים`} color={Colors.gold} />
          <StatCard icon="📝" label="סה״כ שאלות" value={totalAnswered} color={Colors.textSecondary} />
        </View>

        {/* 14-day streak calendar — 2 rows of 7 */}
        <Text style={styles.sectionTitle}>🔥 הרצף שלי</Text>
        <View style={styles.streakCard}>
          {/* Row 1: days 1–7 (oldest) */}
          <View style={styles.streakRow}>
            {Array.from({ length: 7 }).map((_, i) => {
              const dayIndex = i; // days 0–6 (14 days ago to 8 days ago)
              const active = dayIndex >= 7 - Math.min(streak, 7) && streak >= 7;
              return (
                <View
                  key={`r1-${i}`}
                  style={[
                    styles.streakDay,
                    active && { backgroundColor: Colors.warning },
                  ]}
                >
                  <Text style={[styles.streakDayText, active && { color: '#fff' }]}>
                    {DAY_LETTERS[i % 7]}
                  </Text>
                </View>
              );
            })}
          </View>
          {/* Row 2: days 8–14 (most recent, last = today) */}
          <View style={[styles.streakRow, { marginTop: 8 }]}>
            {Array.from({ length: 7 }).map((_, i) => {
              const isToday = i === 6;
              const daysAgo = 6 - i; // 0 = today, 6 = 6 days ago
              const active = daysAgo < streak;
              return (
                <View
                  key={`r2-${i}`}
                  style={[
                    styles.streakDay,
                    active && { backgroundColor: Colors.warning },
                    isToday && styles.streakDayToday,
                  ]}
                >
                  <Text style={[styles.streakDayText, active && { color: '#fff' }]}>
                    {DAY_LETTERS[i % 7]}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.streakSummary}>
            {streak === 0
              ? 'התחל לתרגל היום!'
              : `${streak} ימים ברצף 🔥 — כל הכבוד!`}
          </Text>
        </View>

        {/* מגמה אחרונה — trend section before ELO */}
        <Text style={styles.sectionTitle}>מגמה אחרונה</Text>
        <View style={styles.trendCard}>
          {totalAnswered > 0 ? (
            <Text style={styles.trendText}>
              📈 השבוע ענית על {totalAnswered} שאלות עם {accuracy}% דיוק
            </Text>
          ) : (
            <Text style={styles.trendText}>
              🎯 עוד לא ענית על שאלות — בוא נתחיל!
            </Text>
          )}
        </View>

        {/* ELO per topic — with colored right border for visual hierarchy */}
        <Text style={styles.sectionTitle}>ELO לפי נושא</Text>
        <View style={styles.eloContainer}>
          {topics.map((topic, idx) => {
            const elo = getTopicElo(topic.id);
            const progress = eloToProgress(elo);
            const isLast = idx === topics.length - 1;
            return (
              <View
                key={topic.id}
                style={[
                  styles.eloRow,
                  { borderRightWidth: 4, borderRightColor: topic.color },
                  isLast && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.eloLeft}>
                  <Text style={styles.eloIcon}>{topic.icon}</Text>
                  <View>
                    <Text style={styles.eloTopicName}>{topic.name}</Text>
                    <Text style={[styles.eloTitle, { color: topic.color }]}>
                      {eloToTitle(elo)}
                    </Text>
                  </View>
                </View>
                <View style={styles.eloRight}>
                  <Text style={[styles.eloValue, { color: topic.color }]}>{elo}</Text>
                  <View style={styles.eloBar}>
                    <ProgressBar progress={progress} color={topic.color} height={5} />
                  </View>
                </View>
              </View>
            );
          })}
          {topics.length === 0 && (
            <Text style={styles.emptyText}>
              השלם לפחות סשן אחד כדי לראות את ה-ELO שלך
            </Text>
          )}
        </View>

        {/* Badges grid with header count */}
        <View style={styles.badgesSectionHeader}>
          <Text style={styles.sectionTitle}>הישגים ועיטורים</Text>
          <Text style={styles.badgesCount}>
            {earnedCount} מתוך {ALL_BADGES.length} הושגו
          </Text>
        </View>
        <View style={styles.badgesGrid}>
          {ALL_BADGES.map(badge => {
            const earned = earnedBadgeTypes.has(badge.type as any);
            return (
              <View
                key={badge.type}
                style={[styles.badgeCard, !earned && styles.badgeCardLocked]}
              >
                <Text style={[styles.badgeIcon, !earned && { opacity: 0.3 }]}>
                  {badge.icon}
                </Text>
                <Text style={[styles.badgeLabel, !earned && { color: Colors.textTertiary }]}>
                  {badge.label}
                </Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>
                  {badge.desc}
                </Text>
                {earned && (
                  <View style={styles.earnedBadge}>
                    <Text style={styles.earnedText}>✓</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },

  // ── Empty state (no sessions) ─────────────────────────────────────────────
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateCta: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingHorizontal: 32,
    paddingVertical: 14,
    ...Shadow.primary,
  },
  emptyStateCtaText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
    textAlign: 'center',
  },

  // ── Page header ───────────────────────────────────────────────────────────
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 20,
  },

  // ── Level card ────────────────────────────────────────────────────────────
  levelCard: {
    borderRadius: Radius.xl,
    padding: 20,
    marginBottom: 24,
    ...Shadow.primary,
  },
  levelTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
  },
  levelInfo: { flex: 1, alignItems: 'flex-end' },
  levelTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: '#fff',
  },
  levelXp: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textAlign: 'right',
  },
  xpTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpFill: { height: 8, backgroundColor: '#fff', borderRadius: 4 },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 12,
    marginTop: 8,
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsGrid: { flexDirection: 'row-reverse', gap: 10 },

  // ── 14-day streak calendar ────────────────────────────────────────────────
  streakCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 8,
    ...Shadow.md,
  },
  streakRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  streakDay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayToday: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  streakDayText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  streakSummary: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 14,
  },

  // ── Trend card ────────────────────────────────────────────────────────────
  trendCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 8,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trendText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 24,
  },

  // ── ELO section ───────────────────────────────────────────────────────────
  eloContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 4,
    marginBottom: 8,
    ...Shadow.md,
    overflow: 'hidden',
  },
  eloRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // borderRightWidth and borderRightColor applied inline per topic
  },
  eloLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 },
  eloIcon: { fontSize: 22 },
  eloTopicName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  eloTitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  eloRight: { alignItems: 'flex-start', width: 100 },
  eloValue: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
  eloBar: { width: 90, marginTop: 4 },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    padding: 20,
  },

  // ── Badges ────────────────────────────────────────────────────────────────
  badgesSectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  badgesCount: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'left',
  },
  badgesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'flex-end',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  badgeCardLocked: { backgroundColor: Colors.surfaceSecondary },
  badgeIcon: { fontSize: 32, marginBottom: 6 },
  badgeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 3,
  },
  badgeDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'right',
    lineHeight: 16,
  },
  earnedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnedText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
});
