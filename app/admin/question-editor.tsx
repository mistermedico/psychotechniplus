import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAdminStore } from '../../store/adminStore';
import { TOPICS, TARGETS } from '../../data/mockData';
import { Question, QuestionOption, QuestionType, AccessLevel, ValidationStatus } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const QUESTION_TYPES: QuestionType[] = [
  'multiple_choice', 'true_false', 'logic', 'verbal', 'quantitative', 'shapes', 'reading_comprehension',
];

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'בחירה מרובה',
  true_false: 'נכון/לא נכון',
  logic: 'לוגיקה',
  verbal: 'מילולי',
  quantitative: 'כמותי',
  shapes: 'צורות',
  reading_comprehension: 'הבנת הנקרא',
  fill_in_the_blank: 'השלמת חסר',
};

const DEFAULT_OPTIONS: QuestionOption[] = [
  { id: 'a', text: '', isCorrect: true },
  { id: 'b', text: '', isCorrect: false },
  { id: 'c', text: '', isCorrect: false },
  { id: 'd', text: '', isCorrect: false },
];

export default function QuestionEditor() {
  const { questionId, mode } = useLocalSearchParams<{ questionId?: string; mode: string }>();
  const { questions, addQuestion, updateQuestion } = useAdminStore();

  const existing = questionId ? questions.find(q => q.id === questionId) : undefined;
  const isEdit = mode === 'edit' && !!existing;

  const [questionText, setQuestionText] = useState(existing?.questionText ?? '');
  const [readingPassage, setReadingPassage] = useState(existing?.readingPassage ?? '');
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [topicId, setTopicId] = useState(existing?.topicId ?? TOPICS[0]?.id ?? '');
  const [questionType, setQuestionType] = useState<QuestionType>(existing?.questionType ?? 'multiple_choice');
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 5);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(existing?.accessLevel ?? 'free');
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>(existing?.validationStatus ?? 'draft');
  const [targetIds, setTargetIds] = useState<string[]>(existing?.targetIds ?? [TARGETS[0]?.id ?? '']);
  const [options, setOptions] = useState<QuestionOption[]>(existing?.options ?? DEFAULT_OPTIONS.map(o => ({ ...o })));
  const [eloOverride, setEloOverride] = useState(String(existing?.psychometricStats.elo ?? 1200));

  const setCorrectOption = (id: string) => {
    setOptions(prev => prev.map(o => ({ ...o, isCorrect: o.id === id })));
  };

  const updateOptionText = (id: string, text: string) => {
    setOptions(prev => prev.map(o => (o.id === id ? { ...o, text } : o)));
  };

  const addOption = () => {
    if (options.length >= 6) return;
    const nextId = String.fromCharCode(97 + options.length);
    setOptions(prev => [...prev, { id: nextId, text: '', isCorrect: false }]);
  };

  const removeOption = (id: string) => {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter(o => o.id !== id));
  };

  const toggleTarget = (tId: string) => {
    setTargetIds(prev =>
      prev.includes(tId) ? prev.filter(x => x !== tId) : [...prev, tId]
    );
  };

  const handleSave = () => {
    if (!questionText.trim()) {
      Alert.alert('שגיאה', 'נא להזין את טקסט השאלה');
      return;
    }
    if (options.some(o => !o.text.trim())) {
      Alert.alert('שגיאה', 'נא למלא את כל האפשרויות');
      return;
    }
    const correctOpt = options.find(o => o.isCorrect);
    if (!correctOpt) {
      Alert.alert('שגיאה', 'נא לסמן תשובה נכונה');
      return;
    }

    const elo = parseInt(eloOverride) || 1200;
    const q: Omit<Question, 'id'> = {
      targetIds,
      topicId,
      questionType,
      questionText: questionText.trim(),
      readingPassage: readingPassage.trim() || undefined,
      options,
      correctAnswer: correctOpt.id,
      explanation: explanation.trim(),
      difficulty,
      psychometricStats: { elo, discrimination: 0.75, guessProbability: 0.25 },
      accessLevel,
      validationStatus,
      smartPracticeEligible: validationStatus === 'validated',
      generalPracticeEligible: validationStatus === 'validated',
    };

    if (isEdit && questionId) {
      updateQuestion(questionId, q);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('נשמר!', 'השאלה עודכנה בהצלחה', [{ text: 'חזרה', onPress: () => router.back() }]);
    } else {
      addQuestion(q);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('נוסף!', 'השאלה נוספה למאגר', [{ text: 'חזרה', onPress: () => router.back() }]);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Section: question text */}
          <Section title="📝 טקסט השאלה">
            <TextInput
              style={styles.textArea}
              multiline
              value={questionText}
              onChangeText={setQuestionText}
              placeholder="הזן את נוסח השאלה..."
              placeholderTextColor={Colors.textTertiary}
              textAlign="right"
              textAlignVertical="top"
              numberOfLines={4}
            />
          </Section>

          {/* Reading passage (optional) */}
          <Section title="📖 קטע קריאה (אופציונלי)">
            <TextInput
              style={[styles.textArea, { minHeight: 80 }]}
              multiline
              value={readingPassage}
              onChangeText={setReadingPassage}
              placeholder="להבנת הנקרא — הכנס קטע טקסט..."
              placeholderTextColor={Colors.textTertiary}
              textAlign="right"
              textAlignVertical="top"
            />
          </Section>

          {/* Section: type + difficulty */}
          <Section title="🎯 סוג ורמת קושי">
            <Text style={styles.fieldLabel}>סוג שאלה</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                {QUESTION_TYPES.map(t => (
                  <Pressable
                    key={t}
                    onPress={() => setQuestionType(t)}
                    style={[styles.chip, questionType === t && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, questionType === t && { color: '#fff' }]}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>רמת קושי: {difficulty}/10</Text>
            <View style={styles.diffRow}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <Pressable
                  key={n}
                  onPress={() => setDifficulty(n)}
                  style={[
                    styles.diffBtn,
                    {
                      backgroundColor: n <= difficulty
                        ? (difficulty <= 3 ? Colors.success : difficulty <= 6 ? Colors.warning : Colors.danger)
                        : Colors.surfaceSecondary,
                    },
                  ]}
                >
                  <Text style={[styles.diffBtnText, { color: n <= difficulty ? '#fff' : Colors.textTertiary }]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>ELO שאלה</Text>
            <TextInput
              style={styles.input}
              value={eloOverride}
              onChangeText={setEloOverride}
              keyboardType="number-pad"
              textAlign="right"
              placeholder="1200"
              placeholderTextColor={Colors.textTertiary}
            />
          </Section>

          {/* Section: options */}
          <Section title="🔘 אפשרויות תשובה">
            <Text style={styles.fieldLabel}>לחץ על לחצן ○ לסמן תשובה נכונה</Text>
            {options.map((opt, idx) => (
              <View key={opt.id} style={styles.optionRow}>
                <Pressable onPress={() => setCorrectOption(opt.id)} style={styles.radioWrap}>
                  <View style={[styles.radio, opt.isCorrect && styles.radioActive]}>
                    {opt.isCorrect && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
                <Text style={styles.optionLabel}>{opt.id.toUpperCase()}.</Text>
                <TextInput
                  style={[styles.optionInput, opt.isCorrect && { borderColor: Colors.success }]}
                  value={opt.text}
                  onChangeText={t => updateOptionText(opt.id, t)}
                  placeholder={`אפשרות ${opt.id.toUpperCase()}...`}
                  placeholderTextColor={Colors.textTertiary}
                  textAlign="right"
                />
                {options.length > 2 && (
                  <Pressable onPress={() => removeOption(opt.id)}>
                    <Text style={{ fontSize: 18, color: Colors.danger }}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {options.length < 6 && (
              <Pressable onPress={addOption} style={styles.addOptionBtn}>
                <Text style={styles.addOptionText}>+ הוסף אפשרות</Text>
              </Pressable>
            )}
          </Section>

          {/* Explanation */}
          <Section title="💡 הסבר">
            <TextInput
              style={[styles.textArea, { minHeight: 80 }]}
              multiline
              value={explanation}
              onChangeText={setExplanation}
              placeholder="הסבר מפורט לפתרון..."
              placeholderTextColor={Colors.textTertiary}
              textAlign="right"
              textAlignVertical="top"
            />
          </Section>

          {/* Topic + Targets */}
          <Section title="📚 נושא ומסלולים">
            <Text style={styles.fieldLabel}>נושא</Text>
            <View style={styles.chipRow}>
              {TOPICS.map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => setTopicId(t.id)}
                  style={[styles.chip, topicId === t.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, topicId === t.id && { color: '#fff' }]}>
                    {t.icon} {t.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>מסלולים (ניתן לבחור כמה)</Text>
            <View style={styles.chipRow}>
              {TARGETS.map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => toggleTarget(t.id)}
                  style={[styles.chip, targetIds.includes(t.id) && styles.chipActive]}
                >
                  <Text style={[styles.chipText, targetIds.includes(t.id) && { color: '#fff' }]}>
                    {t.icon} {t.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          {/* Access + Status */}
          <Section title="⚙️ הגדרות גישה">
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>גישה חינמית</Text>
              <Switch
                value={accessLevel === 'free'}
                onValueChange={v => setAccessLevel(v ? 'free' : 'premium')}
                trackColor={{ true: Colors.success, false: Colors.border }}
              />
            </View>
            <Text style={styles.fieldLabel}>סטטוס ולידציה</Text>
            <View style={styles.chipRow}>
              {(['draft', 'pending', 'validated', 'rejected'] as ValidationStatus[]).map(s => (
                <Pressable
                  key={s}
                  onPress={() => setValidationStatus(s)}
                  style={[
                    styles.chip,
                    validationStatus === s && { backgroundColor: STATUS_BG[s], borderColor: STATUS_BG[s] },
                  ]}
                >
                  <Text style={[styles.chipText, validationStatus === s && { color: '#fff' }]}>
                    {s === 'draft' ? 'טיוטה' : s === 'pending' ? 'ממתין' : s === 'validated' ? 'מאושר' : 'נדחה'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          {/* Save */}
          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{isEdit ? '💾 שמור שינויים' : '➕ הוסף שאלה'}</Text>
          </Pressable>

          {isEdit && (
            <Pressable
              onPress={() => router.push({ pathname: '/practice-session', params: { questionId } })}
              style={styles.previewBtn}
            >
              <Text style={styles.previewBtnText}>👁️ תצוגה מקדימה</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const STATUS_BG: Record<ValidationStatus, string> = {
  draft: Colors.textTertiary,
  pending: Colors.warning,
  validated: Colors.success,
  rejected: Colors.danger,
};

const sectionStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 12,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', marginBottom: 12 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },

  fieldLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 8,
  },

  textArea: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
  },

  input: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  diffRow: { flexDirection: 'row-reverse', gap: 4, marginBottom: 12 },
  diffBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },

  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 10 },
  radioWrap: { padding: 4 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.success },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  optionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textSecondary, width: 20 },
  optionInput: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 10,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },

  addOptionBtn: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    padding: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addOptionText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },

  switchRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: 18,
    alignItems: 'center',
    marginBottom: 10,
    ...Shadow.primary,
  },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  previewBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
});
