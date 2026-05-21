import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, Platform, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { ValidationStatus } from '../../data/types';

type ExportFilter = 'all' | ValidationStatus;

export default function ExportScreen() {
  const { questions, topics, targets } = useAdminStore();
  const [filter, setFilter] = useState<ExportFilter>('validated');
  const [includeStats, setIncludeStats] = useState(true);
  const [exporting, setExporting] = useState(false);

  const filtered = filter === 'all'
    ? questions
    : questions.filter(q => q.validationStatus === filter);

  const FILTER_OPTIONS: { key: ExportFilter; label: string; color: string }[] = [
    { key: 'all',       label: 'כל השאלות',   color: Colors.primary },
    { key: 'validated', label: 'מאושרות',      color: Colors.success },
    { key: 'pending',   label: 'ממתינות',      color: Colors.warning },
    { key: 'draft',     label: 'טיוטה',        color: '#94A3B8' },
    { key: 'rejected',  label: 'נדחו',         color: Colors.danger },
  ];

  const buildExportPayload = () => {
    const exportQuestions = filtered.map(q => {
      const base = {
        id: q.id,
        targetIds: q.targetIds,
        topicId: q.topicId,
        questionType: q.questionType,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        accessLevel: q.accessLevel,
        validationStatus: q.validationStatus,
        smartPracticeEligible: q.smartPracticeEligible,
        generalPracticeEligible: q.generalPracticeEligible,
      };
      if (includeStats) {
        return { ...base, psychometricStats: q.psychometricStats };
      }
      return base;
    });

    return {
      exportedAt: new Date().toISOString(),
      filter,
      totalQuestions: exportQuestions.length,
      questions: exportQuestions,
    };
  };

  const handleExport = async () => {
    if (filtered.length === 0) {
      Alert.alert('אין שאלות', 'אין שאלות לייצוא עם הפילטר הנוכחי.');
      return;
    }

    setExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const payload = buildExportPayload();
      const json = JSON.stringify(payload, null, 2);

      await Share.share({
        message: json,
        title: `psychotechniplus_questions_${filter}.json`,
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('שגיאה', 'לא ניתן לייצא: ' + (e?.message ?? ''));
      }
    } finally {
      setExporting(false);
    }
  };

  const previewJson = JSON.stringify(buildExportPayload(), null, 2).slice(0, 600) + '\n...\n]}\n';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>📤 ייצוא שאלות</Text>
        <Text style={styles.headerSub}>ייצוא מאגר השאלות כקובץ JSON</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Filter */}
        <Text style={styles.sectionTitle}>סינון לייצוא</Text>
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map(opt => (
            <Pressable
              key={opt.key}
              onPress={() => setFilter(opt.key)}
              style={[styles.filterChip, filter === opt.key && { backgroundColor: opt.color, borderColor: opt.color }]}
            >
              <Text style={[styles.filterChipText, filter === opt.key && { color: '#fff' }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Options */}
        <Text style={styles.sectionTitle}>אפשרויות</Text>
        <Pressable
          onPress={() => setIncludeStats(!includeStats)}
          style={styles.optionRow}
        >
          <View style={[styles.checkbox, includeStats && styles.checkboxOn]}>
            {includeStats && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionLabel}>כלול נתוני ELO/פסיכוטכניקה</Text>
            <Text style={styles.optionDesc}>elo, discrimination, guessProbability</Text>
          </View>
        </Pressable>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>סיכום ייצוא</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>שאלות לייצוא:</Text>
            <Text style={styles.summaryValue}>{filtered.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>פילטר:</Text>
            <Text style={styles.summaryValue}>{FILTER_OPTIONS.find(f => f.key === filter)?.label}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>כולל סטטיסטיקות:</Text>
            <Text style={styles.summaryValue}>{includeStats ? 'כן' : 'לא'}</Text>
          </View>
        </View>

        {/* Preview */}
        <Text style={styles.sectionTitle}>תצוגה מקדימה</Text>
        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{previewJson}</Text>
        </View>

        {/* Export button */}
        <Pressable
          onPress={handleExport}
          disabled={exporting || filtered.length === 0}
          style={({ pressed }) => [styles.exportBtn, (pressed || exporting) && { opacity: 0.8 }]}
        >
          <LinearGradient colors={Colors.gradients.primary} style={styles.exportBtnGrad}>
            <Text style={styles.exportBtnText}>
              {exporting ? 'מייצא...' : `ייצוא ${filtered.length} שאלות ←`}
            </Text>
          </LinearGradient>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: { padding: 20, paddingTop: 16, paddingBottom: 24 },
  back: { marginBottom: 12 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', textAlign: 'right', marginTop: 4 },

  content: { padding: 16, paddingBottom: 40 },

  sectionTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.text,
    textAlign: 'right', marginBottom: 10, marginTop: 8,
  },

  filterRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  optionRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, ...Shadow.sm,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontSize: 14, fontFamily: FontFamily.bold },
  optionText: { flex: 1, alignItems: 'flex-end' },
  optionLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text },
  optionDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, ...Shadow.sm,
  },
  summaryTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text,
    textAlign: 'right', marginBottom: 10,
  },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },
  summaryValue: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },

  previewBox: {
    backgroundColor: '#0F172A', borderRadius: Radius.lg, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: '#334155',
  },
  previewText: {
    fontFamily: 'Courier New', fontSize: 11, color: '#94A3B8', lineHeight: 18,
  },

  exportBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  exportBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  exportBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
});
