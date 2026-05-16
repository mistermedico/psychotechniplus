import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/colors';

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

  useEffect(() => {
    if (animated) {
      Animated.spring(anim, {
        toValue: Math.min(1, Math.max(0, progress)),
        useNativeDriver: false,
        friction: 8,
      }).start();
    } else {
      anim.setValue(progress);
    }
  }, [progress]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, { height, backgroundColor, borderRadius: height / 2 }]}>
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
