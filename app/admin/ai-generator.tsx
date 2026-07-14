import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Question, QuestionOption, QuestionType } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

type DraftQuestion = Omit<Question, 'id'> & { localId: string };

const QUESTION_TYPES: { type: QuestionType; label: string; icon: string }[] = [
  { type: 'multiple_choice', label: 'בחירה מרובה', icon: '☑️' },
  { type: 'quantitative', label: 'כמותי', icon: '🔢' },
  { type: 'verbal', label: 'מילולי', icon: '💬' },
  { type: 'logic', label: 'לוגיקה', icon: '🧩' },
  { type: 'shapes', label: 'צורות ומרחב', icon: '🔷' },
  { type: 'reading_comprehension', label: 'הבנת הנקרא', icon: '📖' },
  { type: 'true_false', label: 'נכון/לא נכון', icon: '✓' },
  { type: 'fill_in_the_blank', label: 'השלמת משפט', icon: '✎' },
];

const OPTION_IDS = ['a', 'b', 'c', 'd'];

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function topicPrompt(topicName: string, type: QuestionType, index: number): string {
  if (type === 'quantitative') return `שאלה כמותית ${index}: חשב את הערך המבוקש בנושא ${topicName}.`;
  if (type === 'verbal') return `שאלה מילולית ${index}: בחר את האפשרות שמשלימה נכון את הקשר בנושא ${topicName}.`;
  if (type === 'logic') return `שאלה לוגית ${index}: מצא את החוקיות או המסקנה הנכונה בנושא ${topicName}.`;
  if (type === 'shapes') return `שאלת צורות ומרחב ${index}: בחר את האפשרות שממשיכה את החוקיות החזותית.`;
  if (type === 'reading_comprehension') return `על פי קטע הקריאה, מהי המסקנה הנכונה ביותר בשאלה ${index}?`;
  if (type === 'true_false') return `קבע האם הטענה ${index} בנושא ${topicName} נכונה או לא נכונה.`;
  if (type === 'fill_in_the_blank') return `השלם את המשפט בנושא ${topicName}: התשובה הנכונה היא ____.`;
  return `שאלה ${index} בנושא ${topicName}: בחר את התשובה הנכונה ביותר.`;
}

function buildOptions(type: QuestionType, index: number): QuestionOption[] {
  if (type === 'true_false') {
    return [
      { id: 'a', text: 'נכון', isCorrect: index % 2 === 0 },
      { id: 'b', text: 'לא נכון', isCorrect: index % 2 !== 0 },
    ];
  }

  const correctIndex = index % OPTION_IDS.length;
  return OPTION_IDS.map((id, optionIndex) => ({
    id,
    text: optionIndex === correctIndex
      ? `אפשרות ${id.toUpperCase()} - תשובה נכונה לעריכה`
      : `אפשרות ${id.toUpperCase()} - מסיח לעריכה`,
    isCorrect: optionIndex === correctIndex,
  }));
}

function buildDraftQuestion(params: {
  localId: string;
  topicId: string;
  topicName: string;
  targetId: string;
  type: QuestionType;
  difficulty: number;
  index: number;
  prompt: string;
}): DraftQuestion {
  const options = buildOptions(params.type, params.index);
  const correct = options.find(option => option.isCorrect) ?? options[0];
  return {
    localId: params.localId,
    targetIds: [params.targetId].filter(Boolean),
    topicId: params.topicId,
    questionType: params.type,
    questionText: params.prompt.trim()
      ? `${topicPrompt(params.topicName, params.type, params.index)}\n\nדגש מנהל: ${params.prompt.trim()}`
      : topicPrompt(params.topicName, params.type, params.index),
    readingPassage: params.type === 'reading_comprehension'
      ? 'הכנס כאן קטע קריאה לפני אימות השאלה. הטיוטה לא מיועדת לפרסום לפני עריכה.'
      : undefined,
    options,
    correctAnswer: correct.id,
    explanation: `טיוטה לעריכת מנהל: התשובה הנכונה היא ${correct.text}. יש לעדכן הסבר מקצועי ומדויק לפני אימות השאלה.`,
    difficulty: params.difficulty,
    psychometricStats: {
      elo: 900 + params.difficulty * 70,
      discrimination: 0.7,
      guessProbability: params.type === 'true_false' ? 0.5 : 0.25,
    },
    accessLevel: 'free',
    validationStatus: 'pending',
    smartPracticeEligible: false,
    generalPracticeEligible: false,
  };
}

export default function AiGenerator() {
  const {
    addQuestion,
    addGenerationSession,
    addGenerationPreset,
    deleteGenerationPreset,
    generationPresets,
    generationSessions,
    topics,
    targets,
  } = useAdminStore();

  const activeTopics = useMemo(() => topics.filter(topic => topic.name), [topics]);
  const activeTargets = useMemo(() => targets.filter(target => target.isActive !== false && !target.comingSoon), [targets]);
  const [topicId, setTopicId] = useState(activeTopics[0]?.id ?? '');
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
  const [difficulty, setDifficulty] = useState(5);
  const [countText, setCountText] = useState('5');
  const [prompt, setPrompt] = useState('');
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const selectedTopic = activeTopics.find(topic => topic.id === topicId) ?? activeTopics[0];
  const selectedTarget = activeTargets.find(target => target.id === selectedTopic?.targetId) ?? activeTargets[0];
  const count = clampNumber(Number(countText) || 1, 1, 30);

  const generateDrafts = async () => {
    if (!selectedTopic) {
      Alert.alert('חסר נושא', 'לא נמצאו נושאים פעילים ליצירת טיוטות.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 250));
    const next = Array.from({ length: count }, (_, index) => buildDraftQuestion({
      localId: `draft_${Date.now()}_${index}`,
      topicId: selectedTopic.id,
      topicName: selectedTopic.name,
      targetId: selectedTarget?.id ?? selectedTopic.targetId,
      type: questionType,
      difficulty,
      index: index + 1,
      prompt,
    }));
    setDrafts(next);
    setIsGenerating(false);
  };

  const saveDraft = (draft: DraftQuestion) => {
    const { localId: _localId, ...question } = draft;
    addQuestion(question);
    setDrafts(prev => prev.filter(item => item.localId !== draft.localId));
  };

  const saveAll = async () => {
    if (drafts.length === 0) return;
    setSavingAll(true);
    drafts.forEach(draft => {
      const { localId: _localId, ...question } = draft;
      addQuestion(question);
    });
    addGenerationSession({
      topicId: selectedTopic?.id ?? '',
      topicName: selectedTopic?.name ?? '',
      questionType,
      difficulty,
      count: drafts.length,
      customPrompt: prompt,
      savedCount: drafts.length,
      discardedCount: 0,
    });
    setDrafts([]);
    setSavingAll(false);
    Alert.alert('נשמר', `${drafts.length} טיוטות נוספו לתור השאלות הממתינות לאימות.`);
  };

  const savePreset = () => {
    if (!selectedTopic) return;
    addGenerationPreset({
      name: `${selectedTopic.name} - ${QUESTION_TYPES.find(item => item.type === questionType)?.label ?? questionType}`,
      topicId: selectedTopic.id,
      questionType,
      difficulty,
      count,
      customPrompt: prompt,
    });
    Alert.alert('נשמר', 'הגדרות הטיוטה נשמרו כפריסה.');
  };

  const applyPreset = (presetId: string) => {
    const preset = generationPresets.find(item => item.id === presetId);
    if (!preset) return;
    setTopicId(preset.topicId);
    setQuestionType(preset.questionType as QuestionType);
    setDifficulty(preset.difficulty);
    setCountText(String(preset.count));
    setPrompt(preset.customPrompt);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>מחולל טיוטות שאלות</Text>
          <Text style={styles.subtitle}>הכלי יוצר טיוטות לעריכת מנהל. כל שאלה נשמרת כממתינה לאימות ואינה נכנסת לתרגול לפני בדיקה.</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>נושא</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {activeTopics.map(topic => (
              <Pressable key={topic.id} onPress={() => setTopicId(topic.id)} style={[styles.chip, topicId === topic.id && styles.chipActive]}>
                <Text style={[styles.chipText, topicId === topic.id && styles.chipTextActive]}>{topic.icon} {topic.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>סוג שאלה</Text>
          <View style={styles.typeGrid}>
            {QUESTION_TYPES.map(item => (
              <Pressable key={item.type} onPress={() => setQuestionType(item.type)} style={[styles.typeBtn, questionType === item.type && styles.typeBtnActive]}>
                <Text style={styles.typeIcon}>{item.icon}</Text>
                <Text style={[styles.typeText, questionType === item.type && styles.typeTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>כמות</Text>
              <TextInput value={countText} onChangeText={setCountText} keyboardType="number-pad" style={styles.input} textAlign="center" />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>קושי</Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => setDifficulty(value => clampNumber(value - 1, 1, 10))} style={styles.stepBtn}><Text style={styles.stepText}>-</Text></Pressable>
                <Text style={styles.stepValue}>{difficulty}</Text>
                <Pressable onPress={() => setDifficulty(value => clampNumber(value + 1, 1, 10))} style={styles.stepBtn}><Text style={styles.stepText}>+</Text></Pressable>
              </View>
            </View>
          </View>

          <Text style={styles.inputLabel}>דגשים למנהל</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="לדוגמה: יחס ישר והפוך, אנלוגיות, סדרות צורות..."
            placeholderTextColor={Colors.textTertiary}
            style={[styles.input, styles.textArea]}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />

          <View style={styles.actionsRow}>
            <Pressable onPress={generateDrafts} disabled={isGenerating} style={[styles.primaryBtn, isGenerating && styles.disabledBtn]}>
              {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>צור טיוטות</Text>}
            </Pressable>
            <Pressable onPress={savePreset} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>שמור פריסה</Text>
            </Pressable>
          </View>
        </View>

        {drafts.length > 0 && (
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.sectionTitle}>טיוטות ({drafts.length})</Text>
              <Pressable onPress={saveAll} disabled={savingAll} style={styles.saveAllBtn}>
                <Text style={styles.saveAllText}>{savingAll ? 'שומר...' : 'שמור הכל'}</Text>
              </Pressable>
            </View>
            {drafts.map(draft => (
              <View key={draft.localId} style={styles.draftCard}>
                <Text style={styles.draftMeta}>{QUESTION_TYPES.find(item => item.type === draft.questionType)?.label} · רמה {draft.difficulty}</Text>
                <Text style={styles.draftQuestion}>{draft.questionText}</Text>
                {draft.options.map(option => (
                  <Text key={option.id} style={[styles.optionLine, option.isCorrect && styles.correctOption]}>
                    {option.id.toUpperCase()}. {option.text}
                  </Text>
                ))}
                <Text style={styles.explanation}>{draft.explanation}</Text>
                <View style={styles.draftActions}>
                  <Pressable onPress={() => saveDraft(draft)} style={styles.smallPrimaryBtn}><Text style={styles.smallPrimaryText}>שמור</Text></Pressable>
                  <Pressable onPress={() => setDrafts(prev => prev.filter(item => item.localId !== draft.localId))} style={styles.smallDangerBtn}><Text style={styles.smallDangerText}>הסר</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>פריסות שמורות</Text>
          {generationPresets.length === 0 ? (
            <Text style={styles.emptyText}>אין פריסות שמורות עדיין.</Text>
          ) : generationPresets.map(preset => (
            <View key={preset.id} style={styles.presetRow}>
              <Pressable onPress={() => applyPreset(preset.id)} style={styles.presetMain}>
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetMeta}>רמה {preset.difficulty} · {preset.count} שאלות</Text>
              </Pressable>
              <Pressable onPress={() => deleteGenerationPreset(preset.id)} style={styles.deletePresetBtn}>
                <Text style={styles.deletePresetText}>מחק</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>היסטוריית יצירה</Text>
          {generationSessions.length === 0 ? (
            <Text style={styles.emptyText}>עדיין לא נשמרו סשנים.</Text>
          ) : generationSessions.slice(0, 8).map(session => (
            <View key={session.id} style={styles.sessionRow}>
              <Text style={styles.sessionTitle}>{session.topicName || 'ללא נושא'} · {session.savedCount}/{session.count} נשמרו</Text>
              <Text style={styles.sessionMeta}>{new Date(session.createdAt).toLocaleString('he-IL')}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 44 },
  header: { marginBottom: 14 },
  title: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: Colors.text, textAlign: 'right' },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginTop: 6, lineHeight: 21 },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
    ...Shadow.sm,
  },
  panelHeaderRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right', marginBottom: 10 },
  chipRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  chip: { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  typeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeBtn: { width: '48%', minHeight: 62, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', padding: 8 },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLighter },
  typeIcon: { fontSize: 20, marginBottom: 3 },
  typeText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  typeTextActive: { color: Colors.primary },
  row: { flexDirection: 'row-reverse', gap: 10, marginBottom: 12 },
  inputWrap: { flex: 1 },
  inputLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6 },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, color: Colors.text, fontFamily: FontFamily.regular, paddingHorizontal: 12, paddingVertical: 11 },
  textArea: { minHeight: 96, writingDirection: 'rtl' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, minHeight: 45 },
  stepBtn: { width: 52, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },
  stepValue: { minWidth: 44, textAlign: 'center', fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text },
  actionsRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 14 },
  primaryBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.lg, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: FontFamily.bold, color: '#fff', fontSize: FontSize.base },
  secondaryBtn: { borderRadius: Radius.lg, minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { fontFamily: FontFamily.bold, color: Colors.text, fontSize: FontSize.sm },
  disabledBtn: { opacity: 0.6 },
  saveAllBtn: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  saveAllText: { fontFamily: FontFamily.bold, color: '#fff', fontSize: FontSize.sm },
  draftCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 10 },
  draftMeta: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary, textAlign: 'right', marginBottom: 6 },
  draftQuestion: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', lineHeight: 23, marginBottom: 8 },
  optionLine: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 4 },
  correctOption: { color: Colors.success, fontFamily: FontFamily.bold },
  explanation: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', lineHeight: 18, marginTop: 4 },
  draftActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  smallPrimaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  smallPrimaryText: { fontFamily: FontFamily.bold, color: '#fff', fontSize: FontSize.sm },
  smallDangerBtn: { backgroundColor: Colors.danger + '18', borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  smallDangerText: { fontFamily: FontFamily.bold, color: Colors.danger, fontSize: FontSize.sm },
  presetRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 10, marginBottom: 8 },
  presetMain: { flex: 1, alignItems: 'flex-end' },
  presetName: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  presetMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  deletePresetBtn: { borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.danger + '18' },
  deletePresetText: { fontFamily: FontFamily.bold, color: Colors.danger, fontSize: FontSize.xs },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  sessionRow: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 9 },
  sessionTitle: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  sessionMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
});
