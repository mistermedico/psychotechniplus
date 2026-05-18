import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
import { TARGETS, TOPICS } from '../../data/mockData';
import { TargetCard } from '../../components/TargetCard';
import { StatCard } from '../../components/StatCard';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { eloToTitle } from '../../utils/elo';

const { width: W } = Dimensions.get('window');

const QUICK_ACTION_META: Record<string, { icon: string; color: string }> = {
  topic_quantitative: { icon: '⚡', color: Colors.primary },
  topic_verbal:       { icon: '📚', color: Colors.success },
  topic_logic:        { icon: '🧩', color: Colors.accent },
  topic_spatial:      { icon: '🔷', color: '#F59E0B' },
  topic_english:      { icon: '🔤', color: '#0EA5E9' },
};

const BADGE_INFO: Record<string, { icon: string; label: string }> = {
  first_session: { icon: '🌱', label: 'סשן ראשון' },
  streak_7: { icon: '🔥', label: '7 ימים רצוף' },
  streak_30: { icon: '🌟', label: '30 ימים!' },
  perfect_score: { icon: '💯', label: 'ניקוד מושלם' },
  speed_master: { icon: '⚡', label: 'מהירות בלייטנינג' },
  topic_complete: { icon: '🏆', label: 'נושא הושלם' },
  simulation_pass: { icon: '🎖️', label: 'עבר סימולציה' },
  level_up: { icon: '⬆️', label: 'עלייה ברמה' },
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const {
    name, streak, level, xp, badges,
    totalSessions, totalCorrect, totalAnswered,
    selectedTargetId, getTopicElo,
  } = useUserStore();

  const selectedTarget = TARGETS.find(t => t.id === selectedTargetId) ?? TARGETS[0];
  const targetTopics = TOPICS.filter(t => t.targetId === selectedTarget.id);
  const mainTopic = targetTopics[0] ?? null;
  const currentElo = mainTopic ? getTopicElo(mainTopic.id) : 1200;

  const quickActions = targetTopics.slice(0, 3).map(t => ({
    topicId: t.id,
    label: t.name,
    icon: QUICK_ACTION_META[t.id]?.icon ?? '📖',
    color: QUICK_ACTION_META[t.id]?.color ?? Colors.primary,
  }));
  const title = eloToTitle(currentElo);

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const xpPercent = Math.min(100, Math.round((xp / (level * 100)) * 100));
  const recentBadges = badges.slice(-3);

  // Streak badge pulse animation — only when streak > 0
  const streakPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(streakPulse, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(streakPulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [streak]);

  const startQuickPractice = (topicId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/practice-session',
      params: { topicId, targetId: selectedTarget.id, mode: 'practice' },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 'fast'}
      >
        {/* Hero card */}
        <LinearGradient
          colors={Colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <Animated.View
              style={[
                styles.streakBadge,
                { transform: [{ scale: streakPulse }] },
              ]}
            >
              <Text style={styles.streakText}>🔥 {streak}</Text>
            </Animated.View>
            <View style={styles.heroGreeting}>
              <Text style={styles.heroName}>שלום, {name || 'מתאמן'}! 👋</Text>
              <Text style={styles.heroTitle}>{title}</Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{level}</Text>
              <Text style={styles.heroStatLabel}>רמה</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{totalSessions}</Text>
              <Text style={styles.heroStatLabel}>סשנים</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{accuracy}%</Text>
              <Text style={styles.heroStatLabel}>דיוק</Text>
            </View>
          </View>

          {/* XP bar — correct formula: xp / (level * 100) */}
          <View style={styles.xpContainer}>
            <Text style={styles.xpLabel}>XP לרמה {level + 1} — {xpPercent}%</Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPercent}%` }]} />
            </View>
          </View>
        </LinearGradient>

        {/* Main CTA — with subtitle showing number of available questions */}
        <Pressable
          style={({ pressed }) => [
            styles.mainCta,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            startQuickPractice(mainTopic?.id ?? 'topic_quantitative');
          }}
        >
          <LinearGradient
            colors={selectedTarget.gradientColors as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.mainCtaGrad}
          >
            <Text style={styles.mainCtaIcon}>{selectedTarget.icon}</Text>
            <View style={styles.mainCtaText}>
              <Text style={styles.mainCtaTitle}>המשך תרגול</Text>
              <Text style={styles.mainCtaSubtitle}>
                {selectedTarget.name} · {selectedTarget.totalQuestions} שאלות זמינות
              </Text>
            </View>
            <Text style={styles.mainCtaArrow}>←</Text>
          </LinearGradient>
        </Pressable>

        {/* Quick actions — each tappable with haptics */}
        <Text style={styles.sectionTitle}>תרגול מהיר</Text>
        <View style={styles.quickActions}>
          {quickActions.map(action => (
            <Pressable
              key={action.topicId}
              onPress={() => startQuickPractice(action.topicId)}
              style={({ pressed }) => [
                styles.quickAction,
                { borderColor: action.color + '40' },
                pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 },
              ]}
            >
              <LinearGradient
                colors={[action.color + '15', action.color + '08']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
              />
              <Text style={styles.quickActionIcon}>{action.icon}</Text>
              <Text style={[styles.quickActionLabel, { color: action.color }]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Stats row */}
        <Text style={styles.sectionTitle}>הסטטיסטיקות שלי</Text>
        <View style={styles.statsRow}>
          <StatCard icon="✅" label="נכון" value={totalCorrect} color={Colors.success} />
          <StatCard icon="📊" label="דיוק" value={`${accuracy}%`} color={Colors.primary} />
          <StatCard icon="🎯" label="סשנים" value={totalSessions} color={Colors.accent} />
        </View>

        {/* Badges — with empty state */}
        <Text style={styles.sectionTitle}>הישגים אחרונים</Text>
        {recentBadges.length > 0 ? (
          <View style={styles.badgesRow}>
            {recentBadges.map(badge => {
              const info = BADGE_INFO[badge.badgeType] ?? { icon: '🏅', label: badge.badgeType };
              return (
                <View key={badge.id} style={styles.badgeCard}>
                  <Text style={styles.badgeIcon}>{info.icon}</Text>
                  <Text style={styles.badgeLabel}>{info.label}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyBadges}>
            <Text style={styles.emptyBadgesEmoji}>🏅</Text>
            <Text style={styles.emptyBadgesText}>
              השלם את הסשן הראשון שלך כדי להרוויח הישגים!
            </Text>
          </View>
        )}

        {/* Target card — only psychometric */}
        <Text style={styles.sectionTitle}>המסלול שלי</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.targetsScroll}
        >
          {TARGETS.filter(t => t.id === 'target_psychometric').map(t => (
            <View key={t.id} style={styles.targetCardWrap}>
              <TargetCard
                target={t}
                compact
                onPress={() =>
                  router.push({ pathname: '/targets', params: { targetId: t.id } })
                }
              />
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: {},

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    margin: 16,
    borderRadius: Radius.xl,
    padding: 20,
    ...Shadow.primary,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  streakBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  streakText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#fff',
  },
  heroGreeting: { alignItems: 'flex-end' },
  heroName: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
  },
  heroTitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textAlign: 'right',
  },

  heroStats: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 14,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: '#fff',
  },
  heroStatLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },

  xpContainer: {},
  xpLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
    marginBottom: 6,
  },
  xpTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: { height: 6, backgroundColor: '#fff', borderRadius: 3 },

  // ── Main CTA ──────────────────────────────────────────────────────────────
  mainCta: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  mainCtaGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  mainCtaIcon: { fontSize: 32 },
  mainCtaText: { flex: 1, alignItems: 'flex-end' },
  mainCtaTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
    textAlign: 'right',
  },
  mainCtaSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    marginTop: 2,
  },
  mainCtaArrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: '#fff',
  },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },

  // ── Quick actions ─────────────────────────────────────────────────────────
  quickActions: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  quickAction: {
    flex: 1,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    minHeight: 80,
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  quickActionIcon: { fontSize: 24 },
  quickActionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },

  // ── Badges ────────────────────────────────────────────────────────────────
  badgesRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  badgeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    alignItems: 'center',
    minWidth: 80,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeIcon: { fontSize: 28, marginBottom: 4 },
  badgeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  emptyBadges: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  emptyBadgesEmoji: { fontSize: 36, marginBottom: 8 },
  emptyBadgesText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Targets horizontal scroll ─────────────────────────────────────────────
  targetsScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  targetCardWrap: { width: W * 0.65 },
});
