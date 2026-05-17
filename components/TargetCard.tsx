import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Target } from '../data/types';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { ProgressBar } from './ProgressBar';

interface Props {
  target: Target;
  progress?: number; // 0–1
  sessionsCount?: number;
  onPress: () => void;
  compact?: boolean;
}

export function TargetCard({ target, progress = 0, sessionsCount = 0, onPress, compact }: Props) {
  const locked = target.comingSoon;

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.card,
        Shadow.lg,
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
        compact && styles.compact,
      ]}
    >
      <LinearGradient
        colors={target.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
      />

      {locked && (
        <View style={styles.overlay}>
          <Text style={styles.comingSoon}>בקרוב</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.icon}>{target.icon}</Text>
        {target.accessSettings.accessType === 'freemium' && !locked && (
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>חינם</Text>
          </View>
        )}
        {target.accessSettings.accessType === 'premium_only' && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>💎 פרמיום</Text>
          </View>
        )}
      </View>

      <Text style={styles.name}>{target.name}</Text>

      {!compact && (
        <Text style={styles.description} numberOfLines={2}>
          {target.description}
        </Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.stats}>
          {target.totalQuestions.toLocaleString()} שאלות
        </Text>
        {sessionsCount > 0 && (
          <Text style={styles.sessions}>{sessionsCount} סשנים</Text>
        )}
      </View>

      {progress > 0 && (
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={progress}
            color="rgba(255,255,255,0.9)"
            backgroundColor="rgba(255,255,255,0.25)"
            height={5}
          />
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: 18,
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'space-between',
  },
  compact: { minHeight: 120, padding: 14 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  comingSoon: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: '#fff',
    letterSpacing: 1,
  },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  icon: { fontSize: 36 },
  freeBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  freeBadgeText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#fff' },
  premiumBadge: {
    backgroundColor: 'rgba(245,158,11,0.35)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  premiumBadgeText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#fff' },
  name: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
    marginTop: 8,
    textAlign: 'right',
  },
  description: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
  stats: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)' },
  sessions: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)' },
  progressContainer: { marginTop: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  progressText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    minWidth: 30,
    textAlign: 'right',
  },
});
