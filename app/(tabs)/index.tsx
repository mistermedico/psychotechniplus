import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
import { TARGETS, TOPICS } from '../../data/mockData';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius } from '../../constants/theme';
import { LEVEL_LABELS } from '../../utils/adaptive';

const { width: W } = Dimensions.get('window');

const TOPIC_META: Record<string, { icon: string; gradient: [string, string]; glow: string }> = {
  topic_quantitative: { icon: '⚡', gradient: ['#5A52D5', '#7C6FF7'], glow: '#7C6FF7' },
  topic_verbal:       { icon: '📖', gradient: ['#10B981', '#34D399'], glow: '#34D399' },
  topic_logic:        { icon: '🧩', gradient: ['#A855F7', '#C084FC'], glow: '#C084FC' },
  topic_spatial:      { icon: '◈',  gradient: ['#F59E0B', '#FBBF24'], glow: '#FBBF24' },
};

const BADGE_INFO: Record<string, { icon: string; label: string }> = {
  first_session: { icon: '🌱', label: 'סשן ראשון' },
  streak_7: { icon: '🔥', label: '7 ימים' },
  streak_30: { icon: '🌟', label: '30 ימים' },
  perfect_score: { icon: '💯', label: 'מושלם' },
  speed_master: { icon: '⚡', label: 'מהיר' },
  topic_complete: { icon: '🏆', label: 'נושא' },
  simulation_pass: { icon: '🎖️', label: 'סימולציה' },
  level_up: { icon: '⬆️', label: 'רמה' },
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const {
    name, streak, level, xp, badges,
    totalSessions, totalCorrect, totalAnswered,
    selectedTargetId, getTopicLevel,
  } = useUserStore();

  const selectedTarget = TARGETS.find(t => t.id === selectedTargetId) ?? TARGETS[0];
  const targetTopics = TOPICS.filter(t => t.targetId === selectedTarget.id);
  const mainTopic = targetTopics[0] ?? null;
  const title = mainTopic ? LEVEL_LABELS[getTopicLevel(mainTopic.id)] : LEVEL_LABELS['beginner'];
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const xpPercent = Math.min(100, Math.round((xp / (level * 100)) * 100));
  const recentBadges = badges.slice(-3);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'שלום' : 'ערב טוב';

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;
  const streakScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
    ]).start();

    if (streak > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(streakScale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(streakScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [streak]); // eslint-disable-line

  const go = (topicId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/practice-session', params: { topicId, targetId: selectedTarget.id, mode: 'practice' } });
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#080A12', '#0D1020', '#14102A']}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient glow orbs */}
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <Animated.View style={[styles.header, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <Animated.View style={[styles.streakPill, { transform: [{ scale: streakScale }] }]}>
              <Text style={styles.streakPillText}>🔥 {streak}</Text>
            </Animated.View>
            <View style={styles.headerText}>
              <Text style={styles.greetingText}>{greeting}</Text>
              <Text style={styles.nameText}>{name || 'מתאמן'}</Text>
            </View>
          </Animated.View>

          {/* ── Hero Card ── */}
          <Animated.View style={[styles.heroWrap, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <LinearGradient
              colors={['#1E1A4A', '#150F38', '#0E0B2A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              {/* Glow overlay */}
              <View style={styles.heroGlowOverlay} />
              {/* Grid texture */}
              <View style={styles.heroGrid} />

              <View style={styles.heroTop}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{title}</Text>
                </View>
                <Text style={styles.heroElo}>{accuracy > 0 ? `${accuracy}%` : '—'}</Text>
              </View>

              <Text style={styles.heroLabel}>דיוק כולל</Text>

              {/* XP progress */}
              <View style={styles.xpSection}>
                <View style={styles.xpHeader}>
                  <Text style={styles.xpPct}>{xpPercent}%</Text>
                  <Text style={styles.xpHint}>רמה {level + 1}</Text>
                </View>
                <View style={styles.xpTrack}>
                  <LinearGradient
                    colors={['#7C6FF7', '#C084FC']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.xpFill, { width: `${xpPercent}%` }]}
                  />
                </View>
              </View>

              {/* Stats row */}
              <View style={styles.heroStats}>
                {[
                  { val: String(xp), label: 'XP', color: Colors.primaryLight },
                  { val: String(streak), label: 'רצף', color: '#FBBF24' },
                  { val: `${accuracy}%`, label: 'דיוק', color: Colors.success },
                  { val: String(level), label: 'רמה', color: Colors.accent },
                ].map((s, i) => (
                  <View key={i} style={styles.heroStat}>
                    <Text style={[styles.heroStatVal, { color: s.color }]}>{s.val}</Text>
                    <Text style={styles.heroStatLbl}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Practice CTA ── */}
          <Animated.View style={[styles.ctaWrap, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <Pressable
              onPress={() => go(mainTopic?.id ?? 'topic_quantitative')}
              accessibilityRole="button"
              accessibilityLabel={`המשך תרגול · ${selectedTarget.name}`}
              style={({ pressed }) => [styles.ctaBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <LinearGradient
                colors={['#7C6FF7', '#5A52D5']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.ctaGrad}
              >
                <View style={styles.ctaShimmer} />
                <View style={styles.ctaRight}>
                  <Text style={styles.ctaTitle}>המשך תרגול</Text>
                  <Text style={styles.ctaSub}>{selectedTarget.name} · {totalSessions} סשנים עד כה</Text>
                </View>
                <View style={styles.ctaArrow}>
                  <Text style={styles.ctaArrowText}>←</Text>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* ── Bento Grid: Topics ── */}
          <Animated.View style={[styles.section, { opacity: fadeIn }]}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTag}>בחר נושא</Text>
              <Text style={styles.sectionTitle}>תרגול מהיר</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topicsRow}
              decelerationRate="fast"
            >
              {targetTopics.map(t => {
                const meta = TOPIC_META[t.id] ?? TOPIC_META.topic_quantitative;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => go(t.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`תרגול ${t.name}`}
                    style={({ pressed }) => [styles.topicCard, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                  >
                    <LinearGradient
                      colors={meta.gradient}
                      start={{ x: 0.1, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.topicGrad}
                    >
                      <View style={[styles.topicGlow, { shadowColor: meta.glow }]} />
                      <Text style={styles.topicIcon}>{meta.icon}</Text>
                      <Text style={styles.topicName}>{t.name}</Text>
                      <View style={styles.topicChip}>
                        <Text style={styles.topicChipText}>←</Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* ── Stats Bento ── */}
          <Animated.View style={[styles.section, { opacity: fadeIn }]}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTag}>ביצועים</Text>
              <Text style={styles.sectionTitle}>הסטטיסטיקות שלי</Text>
            </View>
            <View style={styles.bentoGrid}>
              <View style={[styles.bentoCard, styles.bentoWide]}>
                <LinearGradient colors={['rgba(52,211,153,0.14)', 'rgba(52,211,153,0.04)']} style={styles.bentoGrad}>
                  <Text style={styles.bentoBig}>{totalCorrect}</Text>
                  <Text style={styles.bentoLabel}>תשובות נכונות</Text>
                  <View style={[styles.bentoAccent, { backgroundColor: Colors.success }]} />
                </LinearGradient>
              </View>
              <View style={styles.bentoCard}>
                <LinearGradient colors={['rgba(124,111,247,0.14)', 'rgba(124,111,247,0.04)']} style={styles.bentoGrad}>
                  <Text style={[styles.bentoBig, { color: Colors.primaryLight }]}>{accuracy}%</Text>
                  <Text style={styles.bentoLabel}>דיוק</Text>
                  <View style={[styles.bentoAccent, { backgroundColor: Colors.primary }]} />
                </LinearGradient>
              </View>
              <View style={styles.bentoCard}>
                <LinearGradient colors={['rgba(192,132,252,0.14)', 'rgba(192,132,252,0.04)']} style={styles.bentoGrad}>
                  <Text style={[styles.bentoBig, { color: Colors.accent }]}>{totalSessions}</Text>
                  <Text style={styles.bentoLabel}>סשנים</Text>
                  <View style={[styles.bentoAccent, { backgroundColor: Colors.accent }]} />
                </LinearGradient>
              </View>
            </View>
          </Animated.View>

          {/* ── Daily Challenge ── */}
          <Animated.View style={[styles.section, { opacity: fadeIn }]}>
            <Pressable
              onPress={() => go(mainTopic?.id ?? 'topic_quantitative')}
              accessibilityRole="button"
              accessibilityLabel="אתגר יומי — 10 שאלות"
              style={({ pressed }) => [styles.challengeBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <LinearGradient
                colors={['#92400E', '#D97706', '#FBBF24']}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0 }}
                style={styles.challengeGrad}
              >
                <View style={styles.challengeShimmer} />
                <View style={styles.challengeRight}>
                  <Text style={styles.challengeTitle}>אתגר יומי</Text>
                  <Text style={styles.challengeSub}>10 שאלות · מיוחד להיום ← </Text>
                </View>
                <Text style={styles.challengeEmoji}>⚡</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* ── Badges ── */}
          {recentBadges.length > 0 && (
            <Animated.View style={[styles.section, { opacity: fadeIn }]}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTag}>הישגים</Text>
                <Text style={styles.sectionTitle}>הישגים אחרונים</Text>
              </View>
              <View style={styles.badgesRow}>
                {recentBadges.map(badge => {
                  const info = BADGE_INFO[badge.badgeType] ?? { icon: '🏅', label: badge.badgeType };
                  return (
                    <View key={badge.id} style={styles.badgeCard}>
                      <LinearGradient
                        colors={['rgba(124,111,247,0.25)', 'rgba(192,132,252,0.12)']}
                        style={styles.badgeIconWrap}
                      >
                        <Text style={styles.badgeIcon}>{info.icon}</Text>
                      </LinearGradient>
                      <Text style={styles.badgeLabel}>{info.label}</Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* ── First time CTA ── */}
          {totalSessions === 0 && (
            <Animated.View style={[styles.section, { opacity: fadeIn }]}>
              <View style={styles.firstCard}>
                <View style={styles.firstGlow} />
                <Text style={styles.firstEmoji}>🚀</Text>
                <Text style={styles.firstTitle}>מוכן להתחיל?</Text>
                <Text style={styles.firstSub}>סיים את הסשן הראשון שלך ורוויח את התג הראשון!</Text>
                <Pressable
                  onPress={() => go(mainTopic?.id ?? 'topic_quantitative')}
                  style={({ pressed }) => [styles.firstBtn, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <LinearGradient colors={['#7C6FF7', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.firstBtnGrad}>
                    <Text style={styles.firstBtnText}>התחל עכשיו ←</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingTop: 4 },

  // Ambient
  orb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.12,
    pointerEvents: 'none',
  },
  orbTop: {
    top: -80, right: -60,
    backgroundColor: '#7C6FF7',
    shadowColor: '#7C6FF7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
  },
  orbBottom: {
    bottom: 120, left: -80,
    backgroundColor: '#C084FC',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
  },

  // Header
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerText: { alignItems: 'flex-end' },
  greetingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  nameText: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: Colors.text,
    textAlign: 'right',
  },
  streakPill: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  streakPillText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FBBF24',
  },

  // Hero Card
  heroWrap: { paddingHorizontal: 16, marginBottom: 14 },
  heroCard: {
    borderRadius: Radius['3xl'],
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.22)',
    overflow: 'hidden',
    shadowColor: '#7C6FF7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  heroGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124,111,247,0.05)',
  },
  heroGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    backgroundColor: 'transparent',
  },
  heroTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroBadge: {
    backgroundColor: 'rgba(124,111,247,0.25)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.45)',
  },
  heroBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#C4B5FD',
    letterSpacing: 0.5,
  },
  heroElo: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['4xl'],
    color: '#F0F4FF',
    letterSpacing: -1,
  },
  heroLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginBottom: 18,
    letterSpacing: 0.3,
  },

  // XP Bar
  xpSection: { marginBottom: 20 },
  xpHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpPct: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: '#C4B5FD' },
  xpHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  xpTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: { height: 5, borderRadius: 3 },

  // Hero Stats
  heroStats: {
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
    gap: 4,
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 3 },
  heroStatVal: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    letterSpacing: -0.5,
  },
  heroStatLbl: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },

  // Practice CTA
  ctaWrap: { paddingHorizontal: 16, marginBottom: 6 },
  ctaBtn: {
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    shadowColor: '#7C6FF7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.50,
    shadowRadius: 20,
    elevation: 14,
  },
  ctaGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  ctaShimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  ctaRight: { flex: 1, alignItems: 'flex-end' },
  ctaTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
    textAlign: 'right',
  },
  ctaSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
    marginTop: 2,
  },
  ctaArrow: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaArrowText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  // Section
  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionHead: { alignItems: 'flex-end', marginBottom: 12 },
  sectionTag: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
  },

  // Topics
  topicsRow: { gap: 10, flexDirection: 'row-reverse', paddingBottom: 4 },
  topicCard: {
    width: 130,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  topicGrad: {
    padding: 16,
    minHeight: 148,
    justifyContent: 'space-between',
  },
  topicGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  topicIcon: { fontSize: 28, textAlign: 'right', marginBottom: 6 },
  topicName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#fff',
    textAlign: 'right',
    lineHeight: 18,
    flex: 1,
  },
  topicChip: {
    alignSelf: 'flex-start',
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  // Bento Grid
  bentoGrid: { flexDirection: 'row-reverse', gap: 10, flexWrap: 'wrap' },
  bentoCard: {
    flex: 1,
    minWidth: (W - 52) / 2 - 20,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  bentoWide: { flexBasis: '100%' },
  bentoGrad: {
    padding: 18,
    minHeight: 90,
    justifyContent: 'center',
    alignItems: 'flex-end',
    position: 'relative',
    overflow: 'hidden',
  },
  bentoAccent: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    borderRadius: 2,
  },
  bentoBig: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: Colors.success,
    textAlign: 'right',
    lineHeight: 36,
  },
  bentoLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 2,
  },

  // Challenge
  challengeBtn: {
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 12,
  },
  challengeGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  challengeShimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  challengeRight: { flex: 1, alignItems: 'flex-end' },
  challengeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
    textAlign: 'right',
  },
  challengeSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.80)',
    marginTop: 2,
    textAlign: 'right',
  },
  challengeEmoji: { fontSize: 36 },

  // Badges
  badgesRow: { flexDirection: 'row-reverse', gap: 10 },
  badgeCard: {
    flex: 1,
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius['2xl'],
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.20)',
    gap: 8,
    shadowColor: '#7C6FF7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeIconWrap: {
    width: 50, height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.30)',
  },
  badgeIcon: { fontSize: 24 },
  badgeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // First-time CTA
  firstCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius['3xl'],
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.22)',
    overflow: 'hidden',
    shadowColor: '#7C6FF7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  firstGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124,111,247,0.04)',
  },
  firstEmoji: { fontSize: 56, marginBottom: 12 },
  firstTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  firstSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  firstBtn: { borderRadius: Radius.full, overflow: 'hidden' },
  firstBtnGrad: { paddingHorizontal: 28, paddingVertical: 14, alignItems: 'center' },
  firstBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
