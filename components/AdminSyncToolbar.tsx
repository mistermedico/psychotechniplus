import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { useAdminStore } from '../store/adminStore';

interface AdminSyncToolbarProps {
  title: string;
  subtitle?: string;
  counters?: Array<{ label: string; value: string | number; tone?: 'primary' | 'success' | 'warning' | 'danger' }>;
  showBackToAdmin?: boolean;
}

const TONE_COLORS = {
  primary: Colors.primary,
  success: Colors.success,
  warning: Colors.warning,
  danger: Colors.danger,
};

function formatSyncTime(value: string | null): string {
  if (!value) return 'עדיין לא סונכרן';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'זמן סנכרון לא תקין';
  return date.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminSyncToolbar({
  title,
  subtitle,
  counters = [],
  showBackToAdmin = true,
}: AdminSyncToolbarProps) {
  const { isSyncing, lastSyncedAt, syncError, syncAll } = useAdminStore();
  const [manualSyncing, setManualSyncing] = useState(false);
  const busy = isSyncing || manualSyncing;
  const statusText = useMemo(() => {
    if (syncError) return syncError;
    if (busy) return 'מסנכרן מול Supabase...';
    return `עדכון אחרון: ${formatSyncTime(lastSyncedAt)}`;
  }, [busy, lastSyncedAt, syncError]);

  const handleSync = async () => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setManualSyncing(true);
    try {
      await syncAll();
    } finally {
      setManualSyncing(false);
    }
  };

  return (
    <View style={[styles.wrap, syncError ? styles.wrapError : null]}>
      <View style={styles.titleBlock}>
        <View style={[styles.statusDot, { backgroundColor: syncError ? Colors.danger : busy ? Colors.warning : Colors.success }]} />
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          <Text style={[styles.status, syncError ? styles.statusError : null]} numberOfLines={2}>{statusText}</Text>
        </View>
      </View>

      {counters.length > 0 && (
        <View style={styles.counters}>
          {counters.map(item => {
            const color = TONE_COLORS[item.tone ?? 'primary'];
            return (
              <View key={item.label} style={[styles.counter, { borderColor: color + '55', backgroundColor: color + '12' }]}>
                <Text style={[styles.counterValue, { color }]}>{item.value}</Text>
                <Text style={styles.counterLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={handleSync}
          disabled={busy}
          style={({ pressed }) => [styles.actionBtn, styles.syncBtn, (pressed || busy) && { opacity: 0.72 }]}
        >
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionText}>רענן וסנכרן</Text>}
        </Pressable>
        {showBackToAdmin && (
          <Pressable onPress={() => router.push('/admin')} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.78 }]}>
            <Text style={styles.secondaryText}>מרכז ניהול</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 12,
    writingDirection: 'rtl',
    ...Shadow.sm,
  },
  wrapError: {
    borderColor: Colors.dangerGlow,
    backgroundColor: Colors.dangerLight,
  },
  titleBlock: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 7,
  },
  copy: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  status: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 5,
  },
  statusError: {
    color: Colors.danger,
  },
  counters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  counter: {
    minWidth: 92,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  counterValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
  },
  counterLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    minWidth: 126,
  },
  actionText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#fff',
  },
  secondaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
});
