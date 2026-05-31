import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius } from '../../constants/theme';

type ExperimentStatus = 'active' | 'paused' | 'draft' | 'completed';

interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: string[];
  status: ExperimentStatus;
}

const STATUS_META: Record<ExperimentStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'פעיל',    color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  paused:    { label: 'מושהה',  color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  draft:     { label: 'טיוטה',  color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  completed: { label: 'הסתיים', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
};

const INITIAL_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp_cta_button',
    name: 'כפתור CTA',
    description: 'בדיקת צבע כפתור התחל תרגול',
    variants: ['סגול (ברירת מחדל)', 'כחול', 'ירוק'],
    status: 'active',
  },
  {
    id: 'exp_landing_hero',
    name: 'דף הנחיתה',
    description: 'בדיקת כותרת גיבור',
    variants: ['גרסה A', 'גרסה B'],
    status: 'paused',
  },
  {
    id: 'exp_notif_timing',
    name: 'תזמון הודעות',
    description: 'שליחת הודעה בבוקר vs ערב',
    variants: ['09:00', '18:00'],
    status: 'draft',
  },
  {
    id: 'exp_paywall',
    name: 'פרמיום paywall',
    description: 'מיקום כפתור שדרוג',
    variants: ['למעלה', 'למטה', 'ציף'],
    status: 'completed',
  },
];

export default function AbTestsScreen() {
  const [experiments, setExperiments] = useState<Experiment[]>(INITIAL_EXPERIMENTS);

  const toggleStatus = (id: string) => {
    Haptics.selectionAsync();
    setExperiments(prev =>
      prev.map(exp => {
        if (exp.id !== id) return exp;
        const next: ExperimentStatus =
          exp.status === 'active' ? 'paused' :
          exp.status === 'paused' ? 'active' :
          exp.status;
        return { ...exp, status: next };
      }),
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🧪</Text>
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>ניסויי A/B Testing</Text>
            <Text style={styles.infoBody}>
              כל ניסוי מחלק משתמשים לקבוצות ומשווה ביניהן. נתוני חשיפות והמרות יהיו זמינים לאחר חיבור לפלטפורמת אנליטיקס.
            </Text>
          </View>
        </View>

        {/* Experiments list */}
        <Text style={styles.sectionTitle}>ניסויים ({experiments.length})</Text>
        {experiments.map(exp => {
          const meta = STATUS_META[exp.status];
          const canToggle = exp.status === 'active' || exp.status === 'paused';
          return (
            <View key={exp.id} style={styles.card}>
              {/* Header row */}
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle}>{exp.name}</Text>
                  <Text style={styles.cardDesc}>{exp.description}</Text>
                </View>
              </View>

              {/* Variants */}
              <View style={styles.variantRow}>
                <Text style={styles.variantRowLabel}>גרסאות:</Text>
                <View style={styles.variantPills}>
                  {exp.variants.map((v, i) => (
                    <View key={i} style={styles.variantPill}>
                      <Text style={styles.variantPillText}>{v}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Mock stats */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>חשיפות</Text>
                  <Text style={styles.statValue}>—</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>המרות</Text>
                  <Text style={styles.statValue}>—</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>ביטחון</Text>
                  <Text style={styles.statValue}>—</Text>
                </View>
              </View>

              {/* Toggle button */}
              {canToggle && (
                <Pressable
                  onPress={() => toggleStatus(exp.id)}
                  style={({ pressed }) => [
                    styles.toggleBtn,
                    exp.status === 'active' ? styles.toggleBtnPause : styles.toggleBtnActivate,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.toggleBtnText}>
                    {exp.status === 'active' ? '⏸ השהה ניסוי' : '▶ הפעל ניסוי'}
                  </Text>
                </Pressable>
              )}
              {!canToggle && (
                <View style={[styles.toggleBtn, styles.toggleBtnDisabled]}>
                  <Text style={styles.toggleBtnTextDisabled}>
                    {exp.status === 'draft' ? '✏️ טיוטה — לא ניתן להפעיל' : '✅ הסתיים'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },

  infoCard: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(124,111,247,0.12)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.3)',
    padding: 14,
    marginBottom: 20,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 28, marginTop: 2 },
  infoTextWrap: { flex: 1 },
  infoTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: '#9E99FA',
    textAlign: 'right',
    marginBottom: 4,
  },
  infoBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },

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
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },

  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitleWrap: { flex: 1 },
  cardTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  cardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  statusLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
  },

  variantRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  variantRowLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  variantPills: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  variantPill: {
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  variantPillText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  statsRow: {
    flexDirection: 'row-reverse',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  statValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },

  toggleBtn: {
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleBtnPause: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  toggleBtnActivate: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  toggleBtnDisabled: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  toggleBtnTextDisabled: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
});
