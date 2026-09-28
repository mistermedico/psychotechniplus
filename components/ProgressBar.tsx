import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/colors';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  progress: number; // 0–1
  color?: string;
  height?: number;
  backgroundColor?: string;
  animated?: boolean;
}

export function ProgressBar({
  progress,
  color = Colors.primary,
  height = 6,
  backgroundColor = Colors.surfaceTertiary,
  animated = true,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const normalizedProgress = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  const shouldAnimate = animated && !reducedMotion;

  useEffect(() => {
    anim.stopAnimation();

    if (shouldAnimate) {
      Animated.spring(anim, {
        toValue: normalizedProgress,
        useNativeDriver: false,
        friction: 8,
        overshootClamping: true,
      }).start();
    } else {
      anim.setValue(normalizedProgress);
    }

    return () => anim.stopAnimation();
  }, [anim, normalizedProgress, shouldAnimate]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(normalizedProgress * 100) }}
      style={[styles.track, { height, backgroundColor, borderRadius: height / 2 }]}
    >
      <Animated.View
        style={[styles.fill, { width, backgroundColor: color, borderRadius: height / 2 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
