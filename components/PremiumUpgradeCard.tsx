import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

type PremiumUpgradeCardProps = {
  title?: string;
  body?: string;
  compact?: boolean;
};

export function PremiumUpgradeCard({
  title = 'פתח את כל יכולות הפרימיום',
  body = 'כל הנושאים, סימולציות מלאות, תרגול אדפטיבי, אנליטיקה מתקדמת וללא פרסומות.',
  compact = false,
}: PremiumUpgradeCardProps) {
  const openPaywall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/paywall');
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. מעבר למסלולי פרימיום`}
      onPress={openPaywall}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['#3B2E86', '#6548C7', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, compact && styles.compactCard]}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <View style={styles.action}>
          <Text style={styles.actionText}>שדרוג</Text>
          <Text style={styles.arrow}>←</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.88 },
  card: {
    minHeight: 132,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  compactCard: { minHeight: 108, paddingVertical: 14 },
  copy: { flex: 1, alignItems: 'flex-end' },
  title: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  body: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.84)',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  action: {
    minWidth: 82,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(8,10,18,0.42)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  arrow: { color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: FontSize.lg },
});
