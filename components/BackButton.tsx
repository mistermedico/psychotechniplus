import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { FontFamily } from '../constants/theme';

interface BackButtonProps {
  onPress?: () => void;
  toHome?: boolean;
  label?: string;
  style?: object;
  color?: string;
}

export function BackButton({ onPress, toHome = false, label, style, color = '#fff' }: BackButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else if (toHome) {
      router.replace('/(tabs)');
    } else {
      router.back();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.65 }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={[styles.inner, { borderColor: 'rgba(255,255,255,0.2)' }]}>
        <Text style={[styles.arrow, { color }]}>{toHome ? '🏠' : '→'}</Text>
        {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
      </View>
    </Pressable>
  );
}

export function HomeButton({ style }: { style?: object }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.replace('/(tabs)');
      }}
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.65 }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={[styles.inner, { borderColor: 'rgba(255,255,255,0.2)' }]}>
        <Text style={styles.arrow}>🏠</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {},
  inner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  arrow: {
    fontSize: 16,
    color: '#fff',
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#fff',
  },
});
