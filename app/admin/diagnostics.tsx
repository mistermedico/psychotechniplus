import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '../../utils/haptics';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius } from '../../constants/theme';

type CheckStatus = 'idle' | 'running' | 'pass' | 'fail';

interface DiagCheck {
  id: string;
  label: string;
  sublabel: string;
  status: CheckStatus;
  value: string;
  latencyMs?: number;
}

const INITIAL_CHECKS: DiagCheck[] = [
  { id: 'supabase',  label: 'Supabase Connection', sublabel: 'חיבור לבסיס הנתונים',  status: 'idle', value: '' },
  { id: 'auth',      label: 'Auth Status',          sublabel: 'סשן אדמין נוכחי',        status: 'idle', value: '' },
  { id: 'storage',   label: 'AsyncStorage',          sublabel: 'כתיבה וקריאה מקומית',   status: 'idle', value: '' },
  { id: 'questions', label: 'Questions Store',       sublabel: 'שאלות טעונות בחנות',    status: 'idle', value: '' },
  { id: 'config',    label: 'App Config',            sublabel: 'מצב תחזוקה ודגלים',     status: 'idle', value: '' },
  { id: 'build',     label: 'Build Info',            sublabel: 'פלטפורמה ו-SDK',         status: 'idle', value: '' },
];

const STATUS_ICON: Record<CheckStatus, string> = {
  idle:    '⬜',
  running: '🔄',
  pass:    '✅',
  fail:    '❌',
};

export default function DiagnosticsScreen() {
  const { questions, appConfig } = useAdminStore();
  const [checks, setChecks] = useState<DiagCheck[]>(INITIAL_CHECKS);
  const [running, setRunning] = useState(false);

  const setCheck = useCallback((id: string, partial: Partial<DiagCheck>) => {
    setChecks(prev => prev.map(c => (c.id === id ? { ...c, ...partial } : c)));
  }, []);

  const runChecks = useCallback(async () => {
    if (running) return;
    setRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Reset all to running
    setChecks(INITIAL_CHECKS.map(c => ({ ...c, status: 'running' as CheckStatus })));

    // 1. Supabase Connection
    try {
      const t0 = Date.now();
      const { error } = await supabase.from('questions').select('count').limit(1);
      const latencyMs = Date.now() - t0;
      if (error) throw error;
      setCheck('supabase', { status: 'pass', value: `${latencyMs}ms`, latencyMs });
    } catch (e: any) {
      setCheck('supabase', { status: 'fail', value: e?.message ?? 'שגיאה' });
    }

    // 2. Auth Status
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      const val = session?.user?.email
        ? `מחובר: ${session.user.email}`
        : 'לא מחובר';
      setCheck('auth', { status: session ? 'pass' : 'fail', value: val });
    } catch (e: any) {
      setCheck('auth', { status: 'fail', value: e?.message ?? 'שגיאה' });
    }

    // 3. AsyncStorage read/write
    const TEST_KEY = '@psychotechniplus/diag/test';
    try {
      const t0 = Date.now();
      await AsyncStorage.setItem(TEST_KEY, 'ok');
      const val = await AsyncStorage.getItem(TEST_KEY);
      await AsyncStorage.removeItem(TEST_KEY);
      const latencyMs = Date.now() - t0;
      if (val !== 'ok') throw new Error('value mismatch');
      setCheck('storage', { status: 'pass', value: `${latencyMs}ms`, latencyMs });
    } catch (e: any) {
      setCheck('storage', { status: 'fail', value: e?.message ?? 'שגיאה' });
    }

    // 4. Questions store — synchronous snapshot
    const qCount = questions.length;
    setCheck('questions', {
      status: qCount > 0 ? 'pass' : 'fail',
      value: `${qCount} שאלות`,
    });

    // 5. App Config
    const flagCount = Object.keys(appConfig.featureFlags ?? {}).length;
    const maintenance = appConfig.maintenanceMode ? 'פעיל ⚠️' : 'כבוי';
    setCheck('config', {
      status: 'pass',
      value: `תחזוקה: ${maintenance} | דגלים: ${flagCount}`,
    });

    // 6. Build info
    const now = new Date().toLocaleDateString('he-IL');
    setCheck('build', {
      status: 'pass',
      value: `${Platform.OS} | Expo SDK 52 | ${now}`,
    });

    setRunning(false);
  }, [running, questions, appConfig, setCheck]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Run button */}
        <Pressable
          onPress={runChecks}
          disabled={running}
          style={({ pressed }) => [{ opacity: pressed || running ? 0.7 : 1 }, styles.runBtnWrap]}
        >
          <LinearGradient
            colors={['#5A52D5', '#7C6FF7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.runBtn}
          >
            <Text style={styles.runBtnText}>
              {running ? '🔄 מריץ בדיקות...' : '🔧 הרץ בדיקות'}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Checks */}
        <Text style={styles.sectionTitle}>תוצאות בדיקה</Text>
        {checks.map(check => (
          <View key={check.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.statusIcon}>{STATUS_ICON[check.status]}</Text>
              <View style={styles.cardLabels}>
                <Text style={styles.cardLabel}>{check.label}</Text>
                <Text style={styles.cardSublabel}>{check.sublabel}</Text>
              </View>
            </View>
            {check.value !== '' && (
              <View style={[
                styles.valueBadge,
                check.status === 'pass' && styles.valueBadgePass,
                check.status === 'fail' && styles.valueBadgeFail,
              ]}>
                <Text style={[
                  styles.valueText,
                  check.status === 'pass' && styles.valueTextPass,
                  check.status === 'fail' && styles.valueTextFail,
                ]}>
                  {check.value}
                </Text>
              </View>
            )}
            {check.status === 'running' && (
              <View style={styles.valueBadge}>
                <Text style={styles.valueText}>בודק...</Text>
              </View>
            )}
          </View>
        ))}

        {/* Legend */}
        <View style={styles.legend}>
          {(['idle', 'running', 'pass', 'fail'] as CheckStatus[]).map(s => (
            <View key={s} style={styles.legendItem}>
              <Text style={styles.legendIcon}>{STATUS_ICON[s]}</Text>
              <Text style={styles.legendLabel}>
                {{ idle: 'לא רץ', running: 'בודק', pass: 'תקין', fail: 'שגיאה' }[s]}
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },

  runBtnWrap: { marginBottom: 24 },
  runBtn: { borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  runBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 12,
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: { fontSize: 22 },
  cardLabels: { flex: 1 },
  cardLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
  },
  cardSublabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 2,
  },

  valueBadge: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  valueBadgePass: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  valueBadgeFail: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  valueText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  valueTextPass: { color: '#10B981' },
  valueTextFail: { color: '#EF4444' },

  legend: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  legendIcon: { fontSize: 14 },
  legendLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
});
