import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAdminStore } from '../../store/adminStore';
import { TOPICS } from '../../data/mockData';
import { Question, QuestionType } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

// Mock AI-generated questions templates
const AI_TEMPLATES: Record<string, Partial<Question>[]> = {
  topic_quantitative: [
    {
      questionText: 'טרן נסע ממהירות 80 קמ"ש למרחק 240 ק"מ. כמה זמן הנסיעה?',
      options: [
        { id: 'a', text: '2 שעות', isCorrect: false },
        { id: 'b', text: '3 שעות', isCorrect: true },
        { id: 'c', text: '4 שעות', isCorrect: false },
        { id: 'd', text: '2.5 שעות', isCorrect: false },
      ],
      correctAnswer: 'b',
      explanation: 'זמן = מרחק / מהירות = 240 / 80 = 3 שעות.',
      difficulty: 2,
      questionType: 'multiple_choice' as QuestionType,
    },
    {
      questionText: 'מהו שטח מלבן שאורכו 12 ס"מ ורוחבו 7 ס"מ?',
      options: [
        { id: 'a', text: '84 סמ"ר', isCorrect: true },
        { id: 'b', text: '38 סמ"ר', isCorrect: false },
        { id: 'c', text: '96 סמ"ר', isCorrect: false },
        { id: 'd', text: '76 סמ"ר', isCorrect: false },
      ],
      correctAnswer: 'a',
      explanation: 'שטח מלבן = אורך × רוחב = 12 × 7 = 84 סמ"ר.',
      difficulty: 2,
      questionType: 'multiple_choice' as QuestionType,
    },
    {
      questionText: 'ב-5 ימים הדפיסה מדפסת 1,500 עמודים. כמה עמודים תדפיס ב-8 ימים?',
      options: [
        { id: 'a', text: '2,200', isCorrect: false },
        { id: 'b', text: '2,400', isCorrect: true },
        { id: 'c', text: '1,800', isCorrect: false },
        { id: 'd', text: '2,000', isCorrect: false },
      ],
      correctAnswer: 'b',
      explanation: 'קצב: 1500/5 = 300 עמ׳ ביום. ב-8 ימים: 300×8 = 2,400.',
      difficulty: 3,
      questionType: 'multiple_choice' as QuestionType,
    },
  ],
  topic_verbal: [
    {
      questionText: 'אנלוגיה: מוזיקאי : תזמורת = שחקן : ___',
      options: [
        { id: 'a', text: 'תיאטרון', isCorrect: false },
        { id: 'b', text: 'להקה', isCorrect: false },
        { id: 'c', text: 'קהל', isCorrect: false },
        { id: 'd', text: 'חברה תיאטרונית', isCorrect: true },
      ],
      correctAnswer: 'd',
      explanation: 'מוזיקאי הוא חלק מתזמורת (להקה של נגנים), שחקן הוא חלק מחברה תיאטרונית.',
      difficulty: 5,
      questionType: 'verbal' as QuestionType,
    },
    {
      questionText: 'מה ההפך של "גלוי"?',
      options: [
        { id: 'a', text: 'נסתר', isCorrect: true },
        { id: 'b', text: 'פתוח', isCorrect: false },
        { id: 'c', text: 'זמין', isCorrect: false },
        { id: 'd', text: 'חשוף', isCorrect: false },
      ],
      correctAnswer: 'a',
      explanation: '"גלוי" = פתוח לעין, נראה. ההפך הוא "נסתר" — מוסתר מהעין.',
      difficulty: 3,
      questionType: 'verbal' as QuestionType,
    },
  ],
  topic_logic: [
    {
      questionText: 'מצא את ההמשך: 1, 1, 2, 3, 5, 8, ___',
      options: [
        { id: 'a', text: '11', isCorrect: false },
        { id: 'b', text: '12', isCorrect: false },
        { id: 'c', text: '13', isCorrect: true },
        { id: 'd', text: '14', isCorrect: false },
      ],
      correctAnswer: 'c',
      explanation: 'סדרת פיבונאצ׳י — כל איבר שווה לסכום שני הקודמים: 5+8=13.',
      difficulty: 3,
      questionType: 'logic' as QuestionType,
    },
  ],
  topic_spatial: [
    {
      questionText: 'לגוף בצורת ריבוע (2D) עם 4 צלעות שוות — כמה ציר סימטריה?',
      options: [
        { id: 'a', text: '2', isCorrect: false },
        { id: 'b', text: '4', isCorrect: true },
        { id: 'c', text: '1', isCorrect: false },
        { id: 'd', text: '8', isCorrect: false },
      ],
      correctAnswer: 'b',
      explanation: 'ריבוע: 2 אלכסונות + אנכי + אופקי = 4 צירי סימטריה.',
      difficulty: 4,
      questionType: 'shapes' as QuestionType,
    },
  ],
};

interface GeneratedPreview {
  topicId: string;
  question: Partial<Question>;
}

export default function AiGenerator() {
  const { addQuestion } = useAdminStore();
  const [selectedTopicId, setSelectedTopicId] = useState(TOPICS[0]?.id ?? '');
  const [difficulty, setDifficulty] = useState(4);
  const [count, setCount] = useState(3);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedPreview[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerated([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulate AI generation delay
    await new Promise(res => setTimeout(res, 1800));

    const pool = AI_TEMPLATES[selectedTopicId] ?? AI_TEMPLATES['topic_quantitative'];
    const picked: GeneratedPreview[] = [];
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const template = pool[i % pool.length];
      picked.push({
        topicId: selectedTopicId,
        question: {
          ...template,
          difficulty,
          targetIds: ['target_psychometric'],
          accessLevel: 'free',
          validationStatus: 'pending',
          topicId: selectedTopicId,
          psychometricStats: { elo: 1000 + difficulty * 80, discrimination: 0.8, guessProbability: 0.25 },
          smartPracticeEligible: false,
          generalPracticeEligible: false,
        } as Partial<Question>,
      });
    }

    setGenerated(picked);
    setIsGenerating(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveQuestion = (preview: GeneratedPreview) => {
    const q = preview.question as Omit<Question, 'id'>;
    addQuestion(q);
    setSavedCount(c => c + 1);
    setGenerated(prev => prev.filter(p => p !== preview));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveAll = () => {
    generated.forEach(p => {
      addQuestion(p.question as Omit<Question, 'id'>);
    });
    setSavedCount(c => c + generated.length);
    setGenerated([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('נשמר!', `${generated.length} שאלות נוספו למאגר כ"ממתינות".\nיש לאשר אותן בתור הולידציה.`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient
          colors={['#6D28D9', '#4F46E5']}
          style={styles.hero}
        >
          <Text style={styles.heroIcon}>🤖</Text>
          <Text style={styles.heroTitle}>מחולל שאלות AI</Text>
          <Text style={styles.heroDesc}>
            מייצר שאלות חדשות בהתאם לנושא, קושי ורמה.{'\n'}
            השאלות נוצרות כ"ממתינות" ודורשות ולידציה.
          </Text>
          {savedCount > 0 && (
            <View style={styles.savedBadge}>
              <Text style={styles.savedBadgeText}>✅ {savedCount} שאלות נשמרו</Text>
            </View>
          )}
        </LinearGradient>

        {/* Config */}
        <View style={styles.configCard}>
          <Text style={styles.sectionTitle}>⚙️ הגדרות יצירה</Text>

          <Text style={styles.label}>נושא</Text>
          <View style={styles.chipRow}>
            {TOPICS.filter(t => !t.isPremiumOnly).map(t => (
              <Pressable
                key={t.id}
                onPress={() => setSelectedTopicId(t.id)}
                style={[styles.chip, selectedTopicId === t.id && { backgroundColor: t.color, borderColor: t.color }]}
              >
                <Text style={[styles.chipText, selectedTopicId === t.id && { color: '#fff' }]}>
                  {t.icon} {t.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>רמת קושי: {difficulty}/10</Text>
          <View style={styles.diffRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <Pressable
                key={n}
                onPress={() => setDifficulty(n)}
                style={[styles.diffBtn, { backgroundColor: n <= difficulty ? '#6D28D9' : Colors.surfaceSecondary }]}
              >
                <Text style={[styles.diffBtnText, { color: n <= difficulty ? '#fff' : Colors.textTertiary }]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>כמות שאלות: {count}</Text>
          <View style={styles.countRow}>
            {[1, 2, 3, 5, 10].map(n => (
              <Pressable
                key={n}
                onPress={() => setCount(n)}
                style={[styles.countBtn, count === n && styles.countBtnActive]}
              >
                <Text style={[styles.countBtnText, count === n && { color: '#fff' }]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>הנחיה לAI (אופציונלי)</Text>
          <TextInput
            style={styles.promptInput}
            multiline
            value={prompt}
            onChangeText={setPrompt}
            placeholder="לדוגמה: &quot;שאלות על הסתברות עם תנאי&quot;, &quot;שאלות מסוג אנלוגיה עם מילים מדעיות&quot;..."
            placeholderTextColor={Colors.textTertiary}
            textAlign="right"
            numberOfLines={3}
          />

          <Pressable
            onPress={handleGenerate}
            disabled={isGenerating}
            style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={isGenerating ? ['#6D28D9', '#6D28D9'] : ['#8B5CF6', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.generateBtnGrad}
            >
              {isGenerating ? (
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.generateBtnText}>מייצר שאלות...</Text>
                </View>
              ) : (
                <Text style={styles.generateBtnText}>🤖 יצור {count} שאלות</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* Generated preview */}
        {generated.length > 0 && (
          <>
            <View style={styles.generatedHeader}>
              <Text style={styles.sectionTitle}>✨ שאלות שנוצרו ({generated.length})</Text>
              <Pressable onPress={saveAll} style={styles.saveAllBtn}>
                <Text style={styles.saveAllText}>💾 שמור הכל</Text>
              </Pressable>
            </View>

            {generated.map((preview, idx) => (
              <View key={idx} style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewNum}>#{idx + 1}</Text>
                  <View style={styles.previewMeta}>
                    <Text style={styles.previewDiff}>רמה {preview.question.difficulty}</Text>
                    <Text style={styles.previewType}>{preview.question.questionType}</Text>
                  </View>
                </View>

                <Text style={styles.previewQ}>{preview.question.questionText}</Text>

                {(preview.question.options ?? []).map(opt => (
                  <View
                    key={opt.id}
                    style={[styles.previewOption, opt.isCorrect && { borderColor: Colors.success, backgroundColor: Colors.successLight }]}
                  >
                    <Text style={[styles.previewOptText, opt.isCorrect && { color: Colors.success }]}>
                      {opt.id.toUpperCase()}. {opt.text}
                      {opt.isCorrect ? ' ✓' : ''}
                    </Text>
                  </View>
                ))}

                {preview.question.explanation && (
                  <View style={styles.previewExplanation}>
                    <Text style={styles.previewExpText}>💡 {preview.question.explanation}</Text>
                  </View>
                )}

                <View style={styles.previewActions}>
                  <Pressable
                    onPress={() => setGenerated(prev => prev.filter((_, i) => i !== idx))}
                    style={styles.discardBtn}
                  >
                    <Text style={styles.discardText}>🗑️ מחק</Text>
                  </Pressable>
                  <Pressable onPress={() => saveQuestion(preview)} style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>💾 שמור שאלה</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },

  hero: { padding: 24, paddingTop: 28, paddingBottom: 28, alignItems: 'flex-end' },
  heroIcon: { fontSize: 48, marginBottom: 8 },
  heroTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  heroDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    lineHeight: 20,
    marginTop: 8,
  },
  savedBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(16,185,129,0.25)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-end',
  },
  savedBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  configCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right', marginBottom: 14 },
  label: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 8 },

  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  diffRow: { flexDirection: 'row-reverse', gap: 4 },
  diffBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  diffBtnText: { fontFamily: FontFamily.bold, fontSize: 11 },

  countRow: { flexDirection: 'row-reverse', gap: 8 },
  countBtn: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  countBtnActive: { backgroundColor: '#6D28D9', borderColor: '#6D28D9' },
  countBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textSecondary },

  promptInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },

  generateBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  generateBtnGrad: { padding: 16, alignItems: 'center' },
  generateBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  generatedHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  saveAllBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveAllText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  previewCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 12,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 },
  previewNum: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.primary },
  previewMeta: { flexDirection: 'row-reverse', gap: 8 },
  previewDiff: {
    fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    color: Colors.warning, backgroundColor: Colors.warningLight,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  previewType: {
    fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    color: Colors.textSecondary, backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  previewQ: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', lineHeight: 22, marginBottom: 10 },
  previewOption: {
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: 8, marginBottom: 6, backgroundColor: Colors.surfaceSecondary,
  },
  previewOptText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  previewExplanation: { backgroundColor: Colors.primaryLighter, borderRadius: Radius.lg, padding: 10, marginBottom: 10 },
  previewExpText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.text, textAlign: 'right', lineHeight: 18 },
  previewActions: { flexDirection: 'row-reverse', gap: 8 },
  discardBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1, borderColor: Colors.danger,
  },
  discardText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.danger },
  saveBtn: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.lg,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
});
