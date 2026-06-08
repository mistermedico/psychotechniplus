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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
import { TOPICS } from '../../data/mockData';
import { ProgressBar } from '../../components/ProgressBar';
import { StatCard } from '../../components/StatCard';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { LEVEL_LABELS } from '../../utils/adaptive';

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
const BOTTOM_TAB_CLEARANCE = 112;

// Hebrew day-of-week letters (א = Sunday ... ש = Saturday)
const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export default function ProgressTab() {
  const insets = useSafeAreaInsets();
  const {
    name, level, xp, streak, longestStreak,
    totalSessions, totalCorrect, totalAnswered,
    badges, selectedTargetId, getTopicAccuracy, getTopicLevel,
  } = useUserStore();

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const topics = TOPICS.filter(t => t.targetId === selectedTargetId);
  const earnedBadgeTypes = new Set(badges.map(b => b.badgeType));
  const earnedCount = badges.filter(b => BADGE_INFO[b.badgeType]).length;
  const xpForNext = level * 100;
  const xpPercent = Math.min(100, Math.round((xp / xpForNext) * 100));

  // XP bar animated entrance — 0 → actual value over 800ms
  const xpAnim = useRef(new Animated.Value(0)).current;

  // Stats entrance animation — fade + translate up on mount
  const statsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(xpAnim, {
      toValue: xpPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();

    Animated.spring(statsAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [xpPercent]); // eslint-disable-line react-hooks/exhaustive-deps

  const xpWidth = xpAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const statsOpacity = statsAnim;
  const statsTranslateY = statsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  // Empty state — no sessions yet
  if (totalSessions === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.emptyStateContainer, { paddingBottom: insets.bottom + BOTTOM_TAB_CLEARANCE }]}>
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
              router.push('/(tabs)');
            }}
          >
            <Text style={styles.emptyStateCtaText}>→ לתרגול</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BOTTOM_TAB_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 'fast'}
      >
        {/* ── Gradient Hero Banner ── */}
        <LinearGradient
          colors={['#1E1A4A', '#150F38', '#0E0B2A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Top row: streak badge + name/label */}
          <View style={styles.heroTop}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>🔥 {streak} ימים</Text>
            </View>
            <View style={styles.heroGreeting}>
              <Text style={styles.heroSubLabel}>ההתקדמות שלי</Text>
              <Text style={styles.heroName}>{name || 'מתאמן'}</Text>
            </View>
          </View>

          {/* Accuracy stat — prominent */}
          <View style={styles.accuracyRow}>
            <Text style={styles.accuracyValue}>{accuracy}%</Text>
            <Text style={styles.accuracyLabel}>דיוק כולל</Text>
          </View>

          {/* Level info row */}
          <View style={styles.levelRow}>
            <View style={styles.levelBadgeCircle}>
              <Text style={styles.levelNum}>{level}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>רמה {level}</Text>
              <Text style={styles.levelXp}>{xp} / {xpForNext} XP לרמה הבאה</Text>
            </View>
          </View>

          {/* Animated XP bar */}
          <View style={styles.xpTrack}>
            <Animated.View style={[styles.xpFill, { width: xpWidth }]} />
          </View>
        </LinearGradient>

        {/* ── Stats grid ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>סטטיסטיקות</Text>
          <Text style={styles.sectionTitle}>סטטיסטיקות כלליות</Text>
        </View>

        <Animated.View style={{ opacity: statsOpacity, transform: [{ translateY: statsTranslateY }] }}>
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
        </Animated.View>

        {/* ── 14-day streak calendar ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>רצף יומי</Text>
          <Text style={styles.sectionTitle}>🔥 הרצף שלי</Text>
        </View>
        <View style={styles.streakCard}>
          <View style={styles.streakAccentStripe} />
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

        {/* ── מגמה אחרונה ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ביצועים</Text>
          <Text style={styles.sectionTitle}>מגמה אחרונה</Text>
        </View>
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

        {/* ── Per-topic accuracy ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>רמת שליטה</Text>
          <Text style={styles.sectionTitle}>דיוק לפי נושא</Text>
        </View>
        <View style={styles.eloContainer}>
          {topics.map((topic, idx) => {
            const accuracy = getTopicAccuracy(topic.id);
            const level = getTopicLevel(topic.id);
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
                      {LEVEL_LABELS[level]}
                    </Text>
                  </View>
                </View>
                <View style={styles.eloRight}>
                  <Text style={[styles.eloValue, { color: topic.color }]}>
                    {accuracy > 0 ? `${Math.round(accuracy * 100)}%` : '—'}
                  </Text>
                  <View style={styles.eloBar}>
                    <ProgressBar progress={accuracy} color={topic.color} height={5} />
                  </View>
                </View>
              </View>
            );
          })}
          {topics.length === 0 && (
            <Text style={styles.emptyText}>
              השלם לפחות סשן אחד כדי לראות את הדיוק שלך
            </Text>
          )}
        </View>

        {/* ── Badges grid ── */}
        <View style={[styles.sectionHeader, styles.badgesSectionHeader]}>
          <View style={styles.badgesHeaderLeft}>
            <Text style={styles.sectionLabel}>הישגים</Text>
            <Text style={styles.sectionTitle}>הישגים ועיטורים</Text>
          </View>
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
                style={[
                  styles.badgeCard,
                  !earned && styles.badgeCardLocked,
                  earned && styles.badgeCardEarned,
                ]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },

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

  // ── Hero banner ───────────────────────────────────────────────────────────
  hero: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: Radius['2xl'],
    padding: 24,
    ...Shadow.primary,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  streakBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  streakBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#fff',
  },
  heroGreeting: { alignItems: 'flex-end' },
  heroSubLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroName: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
    textAlign: 'right',
  },

  // Accuracy big stat
  accuracyRow: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  accuracyValue: {
    fontFamily: FontFamily.heading,
    fontSize: 52,
    color: '#fff',
    lineHeight: 56,
    textAlign: 'right',
  },
  accuracyLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'right',
    marginTop: 2,
  },

  // Level row inside hero
  levelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  levelBadgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: '#fff',
  },
  levelInfo: { flex: 1, alignItems: 'flex-end' },
  levelTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.base,
    color: '#fff',
  },
  levelXp: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
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

  // ── Section headers (two-line style) ─────────────────────────────────────
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  sectionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsGrid: { flexDirection: 'row-reverse', gap: 10, paddingHorizontal: 20 },

  // ── 14-day streak calendar ────────────────────────────────────────────────
  streakCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 8,
    marginHorizontal: 20,
    ...Shadow.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  streakAccentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.warning,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  streakRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  streakDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginHorizontal: 20,
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
    marginHorizontal: 20,
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
  eloRight: { alignItems: 'flex-end', width: 100 },
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  badgesHeaderLeft: { alignItems: 'flex-end' },
  badgesCount: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 4,
  },
  badgesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 20,
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
  badgeCardEarned: {
    backgroundColor: Colors.success + '08',
    borderRightWidth: 3,
    borderRightColor: Colors.success,
    borderColor: Colors.border,
  },
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
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnedText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
});
