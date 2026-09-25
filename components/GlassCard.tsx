import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { Radius, Shadow } from '../constants/theme';
import { Colors } from '../constants/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  strong?: boolean;
  borderColor?: string;
  radius?: number;
}

export function GlassCard({
  children,
  style,
  intensity = 20,
  strong = false,
  borderColor,
  radius = Radius.xl,
}: GlassCardProps) {
  const bg = strong ? Colors.surfaceElevated : Colors.surfaceCard;
  const border = borderColor ?? (strong ? Colors.borderStrong : Colors.border);

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[
          styles.base,
          { borderRadius: radius, borderColor: border },
          style as ViewStyle,
        ]}
      >
        <View pointerEvents="none" style={styles.highlight} />
        {children}
      </BlurView>
    );
  }

  // Android / web: simulate with semi-transparent bg
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg, borderRadius: radius, borderColor: border },
        style as ViewStyle,
      ]}
    >
      <View pointerEvents="none" style={styles.highlight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.md,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.24)',
    opacity: 0.75,
  },
});
