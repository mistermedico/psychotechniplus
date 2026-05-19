import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
import { TARGETS, TOPICS } from '../../data/mockData';
import { TargetCard } from '../../components/TargetCard';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { eloToTitle } from '../../utils/elo';

const { width: W } = Dimensions.get('window');

const QUICK_ACTION_META: Record<string, { icon: string; color: string; gradient: [string, string] }> = {
  topic_quantitative: { icon: '⚡', color: Colors.primary, gradient: ['#4F46E5', '#7C3AED'] },
  topic_verbal: { icon: '📚', color: Colors.success, gradient: ['#10B981', '#059669'] },
  topic_logic: { icon: '🧩', color: Colors.accent, gradient: ['#9333EA', '#7C3AED'] },
  topic_spatial: { icon: '🔷', color: '#F59E0B', gradient: ['#F59E0B', '#D97706'] },
  topic_english: { icon: '🔤', color: '#0EA5E9', gradient: ['#0EA5E9', '#0284C7'] },
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
    gradient: QUICK_ACTION_META[t.id]?.gradient ?? Colors.gradients.primary,
  }));
  const title = eloToTitle(currentElo);

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const xpPercent = Math.min(100, Math.round((xp / (level * 100)) * 100));
  const recentBadges = badges.slice(-3);

  const streakPulse = useRef(new Animated.Value(1)).current;
  const heroFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();

    if (streak > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(streakPulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(streakPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [streak]); // eslint-disable-line react-hooks/exhaustive-deps

  const startQuickPractice = (topicId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/practice-session',
      params: { topicId, targetId: selectedTarget.id, mode: 'practice' },
    });
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        decelerationRate="normal"
      >
        {/* ── Hero ── */}
        <Animated.View style={{ opacity: heroFade }}>
          <LinearGradient
            colors={['#0F172A', '#1E1B4B', '#312E81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTop}>
              <Animated.View style={[styles.streakBadge, { transform: [{ scale: streakPulse }] }]}>
                <Text style={styles.streakText}>🔥 {streak} ימים</Text>
              </Animated.View>
              <View style={styles.heroGreeting}>
                <Text style={styles.heroSub}>{greeting} 👋</Text>
                <Text style={styles.heroName}>{name || 'מתאמן'}</Text>
                <Text style={styles.heroTitle}>{title}</Text>
              </View>
            </View>

            <View style={styles.glassRow}>
              <View style={styles.glassStat}>
                <Text style={styles.glassStatValue}>{xp}</Text>
                <Text style={styles.glassStatLabel}>XP</Text>
              </View>
              <View style={styles.glassDivider} />
              <View style={styles.glassStat}>
                <Text style={styles.glassStatValue}>{streak}</Text>
                <Text style={styles.glassStatLabel}>רצף</Text>
              </View>
              <View style={styles.glassDivider} />
              <View style={styles.glassStat}>
                <Text style={styles.glassStatValue}>{accuracy}%</Text>
                <Text style={styles.glassStatLabel}>דיוק</Text>
              </View>
              <View style={styles.glassDivider} />
              <View style={styles.glassStat}>
                <Text style={styles.glassStatValue}>{level}</Text>
                <Text style={styles.glassStatLabel}>רמה</Text>
              </View>
            </View>

            <View style={styles.xpContainer}>
              <View style={styles.xpLabelRow}>
                <Text style={styles.xpPercent}>{xpPercent}%</Text>
                <Text style={styles.xpLabel}>התקדמות לרמה {level + 1}</Text>
              </View>
              <View style={styles.xpTrack}>
                <LinearGradient
                  colors={['#818CF8', '#C4B5FD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.xpFill, { width: `${xpPercent}%` }]}
                />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: cardSlide }] }}>
          {/* ── Continue Practice CTA ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>ממשיך מאיפה שעצרת</Text>
            <Text style={styles.sectionTitle}>המשך תרגול</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.mainCta, { opacity: pressed ? 0.75 : 1 }]}
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
              <Text style={styles.mainCtaArrow}>←</Text>
              <View style={styles.mainCtaText}>
                <Text style={styles.mainCtaTitle}>המשך תרגול</Text>
                <Text style={styles.mainCtaSubtitle}>
                  {selectedTarget.name} · {selectedTarget.totalQuestions} שאלות זמינות
                </Text>
                <View style={styles.progressRingRow}>
                  <View style={styles.progressRingTrack}>
                    <View style={[styles.progressRingFill, { width: `${Math.min(100, xpPercent)}%` }]} />
                  </View>
                  <Text style={styles.progressRingLabel}>{xpPercent}% מהמטרה היומית</Text>
                </View>
              </View>
              <Text style={styles.mainCtaIcon}>{selectedTarget.icon}</Text>
            </LinearGradient>
          </Pressable>

          {/* ── Recommended topics ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>בחר ותרגל</Text>
            <Text style={styles.sectionTitle}>נושאים מומלצים</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topicsScroll}
            directionalLockEnabled
          >
            {quickActions.map(action => (
              <Pressable
                key={action.topicId}
                onPress={() => startQuickPractice(action.topicId)}
                style={({ pressed }) => [styles.topicCard, { opacity: pressed ? 0.75 : 1 }]}
              >
                <LinearGradient
                  colors={action.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.topicCardGrad}
                >
                  <Text style={styles.topicCardIcon}>{action.icon}</Text>
                  <Text style={styles.topicCardLabel}>{action.label}</Text>
                  <View style={styles.topicCardArrowWrap}>
                    <Text style={styles.topicCardArrow}>←</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>

          {/* ── Stats Row ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>כל הזמן</Text>
            <Text style={styles.sectionTitle}>הסטטיסטיקות שלי</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: Colors.success }]}>
              <Text style={styles.statEmoji}>✅</Text>
              <Text style={[styles.statValue, { color: Colors.success }]}>{totalCorrect}</Text>
              <Text style={styles.statLabel}>תשובות נכונות</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: Colors.primary }]}>
              <Text style={styles.statEmoji}>📊</Text>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{accuracy}%</Text>
              <Text style={styles.statLabel}>דיוק כולל</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: Colors.accent }]}>
              <Text style={styles.statEmoji}>🎯</Text>
              <Text style={[styles.statValue, { color: Colors.accent }]}>{totalSessions}</Text>
              <Text style={styles.statLabel}>סשנים</Text>
            </View>
          </View>

          {/* ── Badges ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>הישגים</Text>
            <Text style={styles.sectionTitle}>הישגים אחרונים</Text>
          </View>

          {recentBadges.length > 0 ? (
            <View style={styles.badgesRow}>
              {recentBadges.map(badge => {
                const info = BADGE_INFO[badge.badgeType] ?? { icon: '🏅', label: badge.badgeType };
                return (
                  <View key={badge.id} style={styles.badgeCard}>
                    <LinearGradient
                      colors={['#FEF9C3', '#FEF3C7']}
                      style={styles.badgeIconWrap}
                    >
                      <Text style={styles.badgeIcon}>{info.icon}</Text>
                    </LinearGradient>
                    <Text style={styles.badgeLabel}>{info.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyBadges}>
              <Text style={styles.emptyBadgesEmoji}>🏅</Text>
              <Text style={styles.emptyBadgesTitle}>עוד אין הישגים</Text>
              <Text style={styles.emptyBadgesText}>
                השלם את הסשן הראשון שלך כדי להרוויח הישגים!
              </Text>
              <Pressable
                style={({ pressed }) => [styles.emptyBadgesBtn, { opacity: pressed ? 0.75 : 1 }]}
                onPress={() => startQuickPractice(mainTopic?.id ?? 'topic_quantitative')}
              >
                <Text style={styles.emptyBadgesBtnText}>התחל תרגול ←</Text>
              </Pressable>
            </View>
          )}

          {/* ── Daily Challenge ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>כל יום</Text>
            <Text style={styles.sectionTitle}>אתגר יומי</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.challengeCard, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() => startQuickPractice(mainTopic?.id ?? 'topic_quantitative')}
          >
            <LinearGradient
              colors={['#D97706', '#F59E0B', '#FCD34D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.challengeGrad}
            >
              <View style={styles.challengeLeft}>
                <Text style={styles.challengeArrow}>←</Text>
              </View>
              <View style={styles.challengeCenter}>
                <Text style={styles.challengeTitle}>אתגר יומי 🏆</Text>
                <Text style={styles.challengeDesc}>10 שאלות · מיוחד להיום</Text>
              </View>
              <Text style={styles.challengeIcon}>⚡</Text>
            </LinearGradient>
          </Pressable>

          {/* ── Target card ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>המסלול</Text>
            <Text style={styles.sectionTitle}>המסלול שלי</Text>
          </View>
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
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: {},

  hero: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: Radius['2xl'],
    padding: 24,
    minHeight: 240,
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
  streakText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#fff',
  },
  heroGreeting: { alignItems: 'flex-end' },
  heroSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
    marginBottom: 2,
  },
  heroName: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
    textAlign: 'right',
  },
  heroTitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
    textAlign: 'right',
  },

  glassRow: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  glassStat: { flex: 1, alignItems: 'center' },
  glassStatValue: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: '#fff',
  },
  glassStatLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  glassDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 2 },

  xpContainer: {},
  xpLabelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'right',
  },
  xpPercent: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.9)',
  },
  xpTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: { height: 6, borderRadius: 3 },

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

  mainCta: {
    marginHorizontal: 20,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  mainCtaGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  mainCtaIcon: { fontSize: 40 },
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
    marginBottom: 10,
  },
  progressRingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, width: '100%' },
  progressRingTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressRingFill: {
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressRingLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  mainCtaArrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: '#fff',
  },

  topicsScroll: {
    paddingHorizontal: 20,
    gap: 12,
    flexDirection: 'row-reverse',
    paddingBottom: 4,
  },
  topicCard: {
    width: 140,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.md,
  },
  topicCardGrad: {
    padding: 16,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  topicCardIcon: { fontSize: 32, textAlign: 'right' },
  topicCardLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#fff',
    textAlign: 'right',
    lineHeight: 20,
  },
  topicCardArrowWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicCardArrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#fff',
  },

  statsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Shadow.md,
  },
  statEmoji: { fontSize: 22, marginBottom: 8 },
  statValue: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  badgesRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 20,
    gap: 12,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Shadow.sm,
    gap: 8,
  },
  badgeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: { fontSize: 26 },
  badgeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  emptyBadges: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Shadow.sm,
  },
  emptyBadgesEmoji: { fontSize: 64, marginBottom: 12 },
  emptyBadgesTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBadgesText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyBadgesBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyBadgesBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#fff',
  },

  challengeCard: {
    marginHorizontal: 20,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  challengeGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  challengeIcon: { fontSize: 36 },
  challengeCenter: { flex: 1, alignItems: 'flex-end' },
  challengeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#1C1917',
    textAlign: 'right',
  },
  challengeDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#44403C',
    textAlign: 'right',
    marginTop: 2,
  },
  challengeLeft: {},
  challengeArrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: '#1C1917',
  },

  targetsScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  targetCardWrap: { width: W * 0.65 },
});
