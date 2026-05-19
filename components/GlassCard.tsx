import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { Radius } from '../constants/theme';

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
  const bg = strong ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.07)';
  const border = borderColor ?? (strong ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.13)');

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
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
