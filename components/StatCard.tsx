import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../constants/colors';
import { useColors } from '../hooks/useColors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

interface Props {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  small?: boolean;
}

export function StatCard({ label, value, icon, color, small }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const valueColor = color ?? colors.primary;

  return (
    <View style={[styles.card, small && styles.small, Shadow.md]}>
      {icon && (
        <Text style={[styles.icon, small && styles.iconSmall]}>{icon}</Text>
      )}
      <Text style={[styles.value, { color: valueColor }, small && styles.valueSmall]}>
        {value}
      </Text>
      <Text style={[styles.label, small && styles.labelSmall]}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
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
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 2,
    },
    labelSmall: { fontSize: 10 },
  });
}
