import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { useColors } from '../hooks/useColors';
import { ThemeColors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { getTopicById } from '../data/mockData';
import { getPerformanceLevel, formatTime } from '../utils/scoring';
import { StatCard } from '../components/StatCard';

export default function Results() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    topicId: string; targetId: string; score: string; correct: string; total: string;
    timeSpent: string; percentile: string; difficultyScore: string; speedScore: string;
    stability: string; bonusXp?: string;
  }>();

  const score = parseInt(params.score ?? '0');
  const correct = parseInt(params.correct ?? '0');
  const total = parseInt(params.total ?? '0');
  const timeSpent = parseInt(params.timeSpent ?? '0');
  const percentile = parseInt(params.percentile ?? '50');
  const difficultyScore = parseInt(params.difficultyScore ?? '0');
  const speedScore = parseInt(params.speedScore ?? '0');
  const stability = parseInt(params.stability ?? '100');
  const bonusXp = parseInt(params.bonusXp ?? '0');

  const topic = getTopicById(params.topicId ?? '');
  const { label, color } = getPerformanceLevel(score);

  const [displayScore, setDisplayScore] = useState(0);
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Haptics.notificationAsync(
      score >= 80 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    );
    const duration = 1200;
    const steps = 60;
    const stepDuration = duration / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += score / steps;
      if (current >= score) { setDisplayScore(score); clearInterval(interval); }
      else { setDisplayScore(Math.floor(current)); }
    }, stepDuration);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(scoreAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.spring(cardAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const avgTime = total > 0 ? Math.round(timeSpent / total) : 0;

  const gradientColors: [string, string] = score >= 80
    ? colors.gradients.success
    : score >= 60
    ? colors.gradients.primary
    : colors.gradients.danger;

  const handleShare = async () => {
    try {
      await Share.share({ message: `השגתי ${score}% במבחן ${topic?.name ?? ''} ב-PsychoTechniPlus! 🎯` });
    } catch (_e) { /* ignore */ }
  };

  return (
    <LinearGradient colors={colors.gradients.bg as any} style={{ flex: 1 }}>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── Score Hero ── */}
        <LinearGradient
          colors={['#1E1B4B', '#312E81', '#4C1D95']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>
            {topic ? `${topic.icon} ${topic.name}` : '📊 תוצאות'}
          </Text>
          <Animated.View style={[styles.scoreBadge, { transform: [{ scale: scaleAnim }], opacity: scoreAnim }]}>
            <LinearGradient colors={gradientColors} style={styles.scoreBadgeGrad}>
              <Text style={styles.scoreNumber}>{displayScore}</Text>
              <Text style={styles.scorePercent}>%</Text>
            </LinearGradient>
          </Animated.View>
          <View style={[styles.performanceBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.performanceText}>{label}</Text>
          </View>
          <Text style={styles.heroSummary}>{correct} מתוך {total} שאלות נכונות</Text>
          <Pressable onPress={handleShare} style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.75 : 1 }]}>
            <Text style={styles.shareBtnText}>שתף תוצאות 🔗</Text>
          </Pressable>
        </LinearGradient>

        {/* ── Main stats ── */}
        <Animated.View style={{ opacity: cardAnim, transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
          <View style={styles.statsGrid}>
            <StatCard icon="✅" label="נכון" value={`${correct}/${total}`} color={colors.success} />
            <StatCard icon="⏱️" label="זמן ממוצע" value={formatTime(avgTime)} color={colors.primary} />
            <StatCard icon="📊" label="אחוזון" value={`${percentile}%`} color={colors.accent} />
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionSub}>BREAKDOWN</Text>
            <Text style={styles.sectionTitle}>ניקוד מפורט</Text>
          </View>

          {bonusXp > 0 && (
            <View style={styles.bonusXpBanner}>
              <Text style={styles.bonusXpText}>🎯 אתגר יומי הושלם! +{bonusXp} XP בונוס</Text>
            </View>
          )}

          <View style={styles.advancedCard}>
            <ScoreRow icon="⚖️" label="ניקוד משוקלל קושי" value={difficultyScore} desc="מתחשב ברמת קושי כל שאלה" color={colors.primary} />
            <ScoreRow icon="⚡" label="ניקוד מהירות" value={speedScore} desc="בונוס על תשובות מהירות לשאלות קשות" color={colors.warning} />
            <ScoreRow icon="📈" label="יציבות" value={stability} desc="עד כמה הביצועים שלך עקביים" color={colors.success} isLast />
          </View>

          <View style={styles.percentileCard}>
            <Text style={styles.percentileTitle}>📊 האחוזון שלך</Text>
            <Text style={styles.percentileDesc}>
              ביצועים שלך טובים יותר מ-{percentile}% מהמשתמשים שהתמודדו עם שאלות דומות.
            </Text>
            <View style={styles.percentileBarTrack}>
              <View style={[styles.percentileBarFill, { width: `${percentile}%` as any, backgroundColor: color }]} />
              <View style={[styles.percentileMarker, { left: `${percentile}%` as any }]}>
                <Text style={styles.percentileMarkerText}>אתה</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionSub}>NEXT STEPS</Text>
            <Text style={styles.sectionTitle}>מה הלאה?</Text>
          </View>

          <View style={styles.recsContainer}>
            {score < 70 && (
              <RecommendCard icon="🎯" title="תרגל את החולשות שלך" desc="זיהינו תחומים לשיפור — תרגל שאלות ממוקדות" color={colors.danger}
                onPress={() => router.replace({ pathname: '/practice-session', params: { topicId: params.topicId, targetId: params.targetId, mode: 'adaptive', questionLimit: params.total } })} />
            )}
            <RecommendCard icon="🔄" title="תרגל שוב" desc="חזור על אותו נושא לחיזוק" color={colors.primary}
              onPress={() => router.replace({ pathname: '/practice-session', params: { topicId: params.topicId, targetId: params.targetId, mode: 'practice', questionLimit: params.total } })} />
            <RecommendCard icon="⚡" title="אתגר מהירות" desc="נסה את אותו נושא במצב מהירות" color={colors.warning}
              onPress={() => router.replace({ pathname: '/practice-session', params: { topicId: params.topicId, targetId: params.targetId, mode: 'speed', questionLimit: params.total } })} />
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottomCtas, { paddingBottom: Math.max(insets.bottom + 4, 20) }]}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.replace('/(tabs)'); }}
          style={({ pressed }) => [styles.homeBtn, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={styles.homeBtnText}>חזרה לבית</Text>
        </Pressable>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.replace({ pathname: '/practice-session', params: { topicId: params.topicId, targetId: params.targetId, mode: 'practice', questionLimit: params.total } }); }}
          style={({ pressed }) => [styles.againBtn, { opacity: pressed ? 0.75 : 1 }]}
        >
          <LinearGradient colors={colors.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.againBtnGrad}>
            <Text style={styles.againBtnText}>שחק שוב ←</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
    </LinearGradient>
  );
}

// ── ScoreRow ─────────────────────────────────────────────────────────────────

function ScoreRow({ icon, label, value, desc, color, isLast }: { icon: string; label: string; value: number; desc: string; color: string; isLast?: boolean }) {
  const colors = useColors();
  const rowStyles = useMemo(() => makeScoreRowStyles(colors), [colors]);
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(barAnim, { toValue: value / 100, friction: 8, useNativeDriver: false }).start();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[rowStyles.row, isLast && rowStyles.rowLast]}>
      <View style={rowStyles.left}>
        <Text style={[rowStyles.value, { color }]}>{value}%</Text>
        <View style={rowStyles.barTrack}>
          <Animated.View style={[rowStyles.barFill, { width: barWidth, backgroundColor: color }]} />
        </View>
      </View>
      <View style={rowStyles.right}>
        <Text style={rowStyles.label}>{icon} {label}</Text>
        <Text style={rowStyles.desc}>{desc}</Text>
      </View>
    </View>
  );
}

function makeScoreRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 16 },
    rowLast: { borderBottomWidth: 0 },
    right: { flex: 1, alignItems: 'flex-end' },
    left: { width: 80, alignItems: 'flex-start' },
    value: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, textAlign: 'right' },
    barTrack: { height: 5, width: 70, backgroundColor: colors.surfaceTertiary, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
    barFill: { height: 5, borderRadius: 3 },
    label: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: colors.text, textAlign: 'right' },
    desc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: colors.textTertiary, textAlign: 'right', marginTop: 2 },
  });
}

// ── RecommendCard ─────────────────────────────────────────────────────────────

function RecommendCard({ icon, title, desc, color, onPress }: { icon: string; title: string; desc: string; color: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [recCardBase.card, { borderColor: color + '40', opacity: pressed ? 0.75 : 1 }]}>
      <LinearGradient colors={[color + '12', color + '06']} style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]} />
      <Text style={[recCardBase.arrow, { color }]}>←</Text>
      <View style={recCardBase.left}>
        <View>
          <Text style={[recCardBase.title, { color }]}>{title}</Text>
          <Text style={[recCardBase.desc, { color: colors.textSecondary }]}>{desc}</Text>
        </View>
        <Text style={recCardBase.icon}>{icon}</Text>
      </View>
    </Pressable>
  );
}

const recCardBase = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1.5, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', ...Shadow.sm, marginBottom: 10 },
  left: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14, flex: 1 },
  icon: { fontSize: 30 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, textAlign: 'right' },
  desc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, textAlign: 'right', marginTop: 2 },
  arrow: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
});

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' },
    scroll: { flex: 1 },
    content: {},

    hero: { padding: 32, paddingTop: 44, paddingBottom: 36, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    heroLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: 'rgba(255,255,255,0.75)', marginBottom: 24 },

    scoreBadge: { marginBottom: 16, ...Shadow.primary },
    scoreBadgeGrad: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: 4, borderColor: 'rgba(255,255,255,0.25)' },
    scoreNumber: { fontFamily: FontFamily.heading, fontSize: 52, color: '#fff', lineHeight: 60 },
    scorePercent: { fontFamily: FontFamily.heading, fontSize: 24, color: 'rgba(255,255,255,0.75)', lineHeight: 40, marginTop: 12 },

    performanceBadge: { borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 7, marginTop: 4, marginBottom: 12 },
    performanceText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
    heroSummary: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },

    shareBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
    shareBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#fff' },

    statsGrid: { flexDirection: 'row-reverse', padding: 20, gap: 10, backgroundColor: colors.background },

    sectionHeaderRow: { paddingHorizontal: 20, marginBottom: 12, marginTop: 4, alignItems: 'flex-end', backgroundColor: colors.background },
    sectionSub: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: colors.primary, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
    sectionTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: colors.text, textAlign: 'right' },

    advancedCard: { backgroundColor: colors.surfaceCard, marginHorizontal: 20, borderRadius: Radius.xl, paddingHorizontal: 16, ...Shadow.md, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    bonusXpBanner: { marginHorizontal: 20, marginBottom: 12, borderRadius: Radius.xl, padding: 14, backgroundColor: 'rgba(217,119,6,0.2)', borderWidth: 1.5, borderColor: '#D97706' },
    bonusXpText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#FBBF24', textAlign: 'center' },

    percentileCard: { backgroundColor: colors.primaryLighter, marginHorizontal: 20, borderRadius: Radius.xl, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.primary + '30' },
    percentileTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: colors.primary, textAlign: 'right', marginBottom: 6 },
    percentileDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'right', lineHeight: 20, marginBottom: 14 },
    percentileBarTrack: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'visible', position: 'relative' },
    percentileBarFill: { height: 10, borderRadius: 5 },
    percentileMarker: { position: 'absolute', top: -20, transform: [{ translateX: -16 }] },
    percentileMarkerText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: colors.primary },

    recsContainer: { paddingHorizontal: 20, marginBottom: 8, backgroundColor: colors.background },

    bottomCtas: { flexDirection: 'row-reverse', paddingHorizontal: 20, paddingTop: 14, gap: 12, backgroundColor: colors.surfaceElevated, borderTopWidth: 1, borderTopColor: colors.border },
    homeBtn: { paddingVertical: 17, paddingHorizontal: 20, borderRadius: Radius.xl, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
    homeBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: colors.textSecondary },
    againBtn: { flex: 1, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
    againBtnGrad: { paddingVertical: 17, alignItems: 'center' },
    againBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  });
}
