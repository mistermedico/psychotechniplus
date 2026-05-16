import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

interface Props {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  small?: boolean;
}

export function StatCard({ label, value, icon, color = Colors.primary, small }: Props) {
  return (
    <View style={[styles.card, small && styles.small, Shadow.md]}>
      {icon && (
        <Text style={[styles.icon, small && styles.iconSmall]}>{icon}</Text>
      )}
      <Text style={[styles.value, { color }, small && styles.valueSmall]}>
        {value}
      </Text>
      <Text style={[styles.label, small && styles.labelSmall]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
  },
  small: {
    padding: 12,
    borderRadius: Radius.lg,
  },
  icon: { fontSize: 24, marginBottom: 6 },
  iconSmall: { fontSize: 18, marginBottom: 4 },
  value: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    textAlign: 'center',
  },
  valueSmall: { fontSize: FontSize.xl },
  label: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  labelSmall: { fontSize: 10 },
});
