import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { getTopicById } from '../data/mockData';
import { getPerformanceLevel, formatTime } from '../utils/scoring';
import { StatCard } from '../components/StatCard';

export default function Results() {
  const params = useLocalSearchParams<{
    topicId: string;
    targetId: string;
    score: string;
    correct: string;
    total: string;
    timeSpent: string;
    percentile: string;
    difficultyScore: string;
    speedScore: string;
    stability: string;
  }>();

  const score = parseInt(params.score ?? '0');
  const correct = parseInt(params.correct ?? '0');
  const total = parseInt(params.total ?? '0');
  const timeSpent = parseInt(params.timeSpent ?? '0');
  const percentile = parseInt(params.percentile ?? '50');
  const difficultyScore = parseInt(params.difficultyScore ?? '0');
  const speedScore = parseInt(params.speedScore ?? '0');
  const stability = parseInt(params.stability ?? '100');

  const topic = getTopicById(params.topicId ?? '');
  const { level, label, color } = getPerformanceLevel(score);

  const scoreAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(
      score >= 80
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    );

    Animated.sequence([
      Animated.spring(scoreAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const avgTime = total > 0 ? Math.round(timeSpent / total) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero score */}
        <LinearGradient
          colors={
            score >= 80
              ? Colors.gradients.success
              : score >= 60
              ? Colors.gradients.primary
              : Colors.gradients.danger
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>
            {topic ? `${topic.icon} ${topic.name}` : '📊 תוצאות'}
          </Text>

          <Animated.View
            style={{
              transform: [{ scale: scoreAnim }],
              opacity: scoreAnim,
            }}
          >
            <Text style={styles.scoreMain}>{score}%</Text>
          </Animated.View>

          <View style={[styles.performanceBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={styles.performanceText}>{label}</Text>
          </View>

          <Text style={styles.heroSummary}>
            {correct} מתוך {total} שאלות נכונות
          </Text>
        </LinearGradient>

        {/* Main stats */}
        <Animated.View
          style={{
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}
        >
          <View style={styles.statsGrid}>
            <StatCard
              icon="✅"
              label="נכון"
              value={`${correct}/${total}`}
              color={Colors.success}
            />
            <StatCard
              icon="⏱️"
              label="זמן ממוצע"
              value={formatTime(avgTime)}
              color={Colors.primary}
            />
            <StatCard
              icon="📊"
              label="אחוזון"
              value={`${percentile}%`}
              color={Colors.accent}
            />
          </View>

          {/* Advanced scores */}
          <Text style={styles.sectionTitle}>ניקוד מפורט</Text>
          <View style={styles.advancedCard}>
            <ScoreRow
              icon="⚖️"
              label="ניקוד משוקלל קושי"
              value={difficultyScore}
              desc="מתחשב ברמת קושי כל שאלה"
              color={Colors.primary}
            />
            <ScoreRow
              icon="⚡"
              label="ניקוד מהירות"
              value={speedScore}
              desc="בונוס על תשובות מהירות לשאלות קשות"
              color={Colors.warning}
            />
            <ScoreRow
              icon="📈"
              label="יציבות"
              value={stability}
              desc="עד כמה הביצועים שלך עקביים"
              color={Colors.success}
            />
          </View>

          {/* Percentile explanation */}
          <View style={styles.percentileCard}>
            <Text style={styles.percentileTitle}>📊 האחוזון שלך</Text>
            <Text style={styles.percentileDesc}>
              ביצועים שלך טובים יותר מ-{percentile}% מהמשתמשים
              שהתמודדו עם שאלות דומות.
            </Text>
            <View style={styles.percentileBarTrack}>
              <View
                style={[
                  styles.percentileBarFill,
                  { width: `${percentile}%`, backgroundColor: color },
                ]}
              />
              <View style={[styles.percentileMarker, { left: `${percentile}%` }]}>
                <Text style={styles.percentileMarkerText}>אתה</Text>
              </View>
            </View>
          </View>

          {/* Recommendations */}
          <Text style={styles.sectionTitle}>מה הלאה?</Text>
          <View style={styles.recsContainer}>
            {score < 70 && (
              <RecommendCard
                icon="🎯"
                title="תרגל את החולשות שלך"
                desc="זיהינו תחומים לשיפור — תרגל שאלות ממוקדות"
                color={Colors.danger}
                onPress={() => router.push({
                  pathname: '/practice-session',
                  params: { topicId: params.topicId, targetId: params.targetId, mode: 'adaptive' },
                })}
              />
            )}
            <RecommendCard
              icon="🔄"
              title="תרגל שוב"
              desc="חזור על אותו נושא לחיזוק"
              color={Colors.primary}
              onPress={() => router.push({
                pathname: '/practice-session',
                params: { topicId: params.topicId, targetId: params.targetId, mode: 'practice' },
              })}
            />
            <RecommendCard
              icon="⚡"
              title="אתגר מהירות"
              desc="נסה את אותו נושא במצב מהירות"
              color={Colors.warning}
              onPress={() => router.push({
                pathname: '/practice-session',
                params: { topicId: params.topicId, targetId: params.targetId, mode: 'speed' },
              })}
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomCtas}>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.homeBtnText}>חזרה לבית</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: '/practice-session',
              params: { topicId: params.topicId, targetId: params.targetId, mode: 'practice' },
            });
          }}
          style={({ pressed }) => [styles.againBtn, pressed && { opacity: 0.9 }]}
        >
          <LinearGradient
            colors={Colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.againBtnGrad}
          >
            <Text style={styles.againBtnText}>תרגל שוב ←</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ScoreRow({
  icon, label, value, desc, color,
}: { icon: string; label: string; value: number; desc: string; color: string }) {
  return (
    <View style={scoreRowStyles.row}>
      <View style={scoreRowStyles.left}>
        <Text style={[scoreRowStyles.value, { color }]}>{value}%</Text>
        <View style={scoreRowStyles.barTrack}>
          <View style={[scoreRowStyles.barFill, { width: `${value}%`, backgroundColor: color }]} />
        </View>
      </View>
      <View style={scoreRowStyles.right}>
        <Text style={scoreRowStyles.label}>{icon} {label}</Text>
        <Text style={scoreRowStyles.desc}>{desc}</Text>
      </View>
    </View>
  );
}

const scoreRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 16,
  },
  right: { flex: 1, alignItems: 'flex-end' },
  left: { width: 80, alignItems: 'flex-start' },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, textAlign: 'left' },
  barTrack: { height: 4, width: 70, backgroundColor: Colors.surfaceTertiary, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  label: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  desc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
});

function RecommendCard({
  icon, title, desc, color, onPress,
}: { icon: string; title: string; desc: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        recStyles.card,
        { borderColor: color + '40' },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <LinearGradient
        colors={[color + '12', color + '06']}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />
      <View style={recStyles.left}>
        <Text style={recStyles.icon}>{icon}</Text>
        <View>
          <Text style={[recStyles.title, { color }]}>{title}</Text>
          <Text style={recStyles.desc}>{desc}</Text>
        </View>
      </View>
      <Text style={[recStyles.arrow, { color }]}>←</Text>
    </Pressable>
  );
}

const recStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...Shadow.sm,
    marginBottom: 8,
  },
  left: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 },
  icon: { fontSize: 28 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, textAlign: 'right' },
  desc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  arrow: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
});

// ── Main styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },

  hero: {
    padding: 32,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 12,
  },
  scoreMain: {
    fontFamily: FontFamily.heading,
    fontSize: 80,
    color: '#fff',
    lineHeight: 88,
  },
  performanceBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  performanceText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  heroSummary: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.85)',
  },

  statsGrid: {
    flexDirection: 'row-reverse',
    padding: 16,
    gap: 10,
  },

  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },

  advancedCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    ...Shadow.md,
    marginBottom: 16,
  },

  percentileCard: {
    backgroundColor: Colors.primaryLighter,
    marginHorizontal: 16,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 16,
  },
  percentileTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.primary,
    textAlign: 'right',
    marginBottom: 6,
  },
  percentileDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 12,
  },
  percentileBarTrack: {
    height: 10,
    backgroundColor: Colors.border,
    borderRadius: 5,
    overflow: 'visible',
    position: 'relative',
  },
  percentileBarFill: { height: 10, borderRadius: 5 },
  percentileMarker: {
    position: 'absolute',
    top: -20,
    transform: [{ translateX: -16 }],
  },
  percentileMarkerText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },

  recsContainer: { paddingHorizontal: 16, marginBottom: 8 },

  bottomCtas: {
    flexDirection: 'row-reverse',
    padding: 16,
    paddingBottom: 32,
    gap: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  homeBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  homeBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
  againBtn: { flex: 1, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  againBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  againBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
