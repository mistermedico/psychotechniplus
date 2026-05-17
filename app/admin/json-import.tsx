import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const EXAMPLE_JSON = `[
  {
    "questionText": "כמה הם 15% מ-200?",
    "topicId": "topic_quantitative",
    "targetIds": ["target_psychometric"],
    "options": [
      { "id": "a", "text": "25", "isCorrect": false },
      { "id": "b", "text": "30", "isCorrect": true },
      { "id": "c", "text": "35", "isCorrect": false },
      { "id": "d", "text": "20", "isCorrect": false }
    ],
    "correctAnswer": "b",
    "explanation": "15% × 200 = 0.15 × 200 = 30",
    "difficulty": 2,
    "accessLevel": "free"
  }
]`;

interface ImportedQuestion {
  questionText: string;
  topicId: string;
  targetIds?: string[];
  options: Array<{ id: string; text: string; isCorrect: boolean; analysisTag?: string }>;
  correctAnswer: string;
  explanation?: string;
  difficulty?: number;
  accessLevel?: 'free' | 'premium';
  questionType?: string;
  readingPassage?: string;
}

function validateQuestion(q: unknown, index: number): string | null {
  if (typeof q !== 'object' || q === null) return `שאלה ${index + 1}: לא אובייקט תקין`;
  const item = q as Record<string, unknown>;
  if (!item.questionText) return `שאלה ${index + 1}: חסר questionText`;
  if (!item.topicId) return `שאלה ${index + 1}: חסר topicId`;
  if (!Array.isArray(item.options) || item.options.length < 2) return `שאלה ${index + 1}: options חייב להכיל לפחות 2 אפשרויות`;
  if (!item.correctAnswer) return `שאלה ${index + 1}: חסר correctAnswer`;
  const hasCorrectOption = (item.options as any[]).some(o => o.id === item.correctAnswer);
  if (!hasCorrectOption) return `שאלה ${index + 1}: correctAnswer ("${item.correctAnswer}") לא קיים ב-options`;
  return null;
}

export default function JsonImportScreen() {
  const { addQuestion } = useAdminStore();
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<ImportedQuestion[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const handleParse = () => {
    setParseError('');
    setPreview([]);
    setImportResult(null);

    if (!jsonText.trim()) {
      setParseError('הדבק JSON לפני הניתוח');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e: any) {
      setParseError(`שגיאת JSON: ${e.message}`);
      return;
    }

    const arr = Array.isArray(parsed) ? parsed : [parsed];

    const errors: string[] = [];
    arr.forEach((q, i) => {
      const err = validateQuestion(q, i);
      if (err) errors.push(err);
    });

    if (errors.length > 0) {
      setParseError(errors.join('\n'));
      return;
    }

    setPreview(arr as ImportedQuestion[]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    setImportResult(null);

    let success = 0;
    let failed = 0;

    for (const item of preview) {
      try {
        addQuestion({
          targetIds: item.targetIds ?? ['target_psychometric'],
          topicId: item.topicId,
          questionType: (item.questionType as any) ?? 'multiple_choice',
          questionText: item.questionText,
          readingPassage: item.readingPassage,
          options: item.options.map(o => ({
            id: o.id, text: o.text, isCorrect: o.isCorrect, analysisTag: o.analysisTag,
          })),
          correctAnswer: item.correctAnswer,
          explanation: item.explanation ?? '',
          difficulty: item.difficulty ?? 3,
          psychometricStats: { elo: 1200, discrimination: 0.7, guessProbability: 0.25 },
          accessLevel: item.accessLevel ?? 'free',
          validationStatus: 'pending',
          smartPracticeEligible: false,
          generalPracticeEligible: false,
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImporting(false);
    setImportResult({ success, failed });
    if (success > 0) {
      setPreview([]);
      setJsonText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const loadExample = () => {
    setJsonText(EXAMPLE_JSON);
    setParseError('');
    setPreview([]);
    setImportResult(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📥 פורמט JSON לייבוא</Text>
          <Text style={styles.infoText}>
            הדבק מערך JSON של שאלות. כל שאלה חייבת לכלול:{'\n'}
            • <Text style={styles.bold}>questionText</Text> — טקסט השאלה{'\n'}
            • <Text style={styles.bold}>topicId</Text> — topic_quantitative / topic_verbal / topic_logic / topic_spatial{'\n'}
            • <Text style={styles.bold}>options</Text> — מערך עם id, text, isCorrect{'\n'}
            • <Text style={styles.bold}>correctAnswer</Text> — ה-id של התשובה הנכונה{'\n'}
            • <Text style={styles.bold}>explanation</Text> — הסבר (אופציונלי){'\n'}
            • <Text style={styles.bold}>difficulty</Text> — 1–10 (ברירת מחדל: 3)
          </Text>
          <Pressable onPress={loadExample} style={({ pressed }) => [styles.exampleBtn, pressed && { opacity: 0.8 }]}>
            <Text style={styles.exampleBtnText}>טען דוגמה</Text>
          </Pressable>
        </View>

        {/* JSON input */}
        <Text style={styles.label}>JSON</Text>
        <TextInput
          style={[styles.jsonInput, parseError ? { borderColor: Colors.danger } : null]}
          value={jsonText}
          onChangeText={t => { setJsonText(t); setParseError(''); setPreview([]); }}
          placeholder={`[{ "questionText": "...", ... }]`}
          placeholderTextColor={Colors.textTertiary}
          multiline
          textAlignVertical="top"
          autoCorrect={false}
          autoCapitalize="none"
        />

        {parseError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{parseError}</Text>
          </View>
        ) : null}

        {/* Parse button */}
        <Pressable onPress={handleParse} style={({ pressed }) => [styles.parseBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.parseBtnText}>🔍 נתח JSON</Text>
        </Pressable>

        {/* Preview */}
        {preview.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>תצוגה מקדימה — {preview.length} שאלות</Text>
            {preview.slice(0, 5).map((q, i) => (
              <View key={i} style={styles.previewCard}>
                <Text style={styles.previewNum}>שאלה {i + 1}</Text>
                <Text style={styles.previewText} numberOfLines={3}>{q.questionText}</Text>
                <View style={styles.previewMeta}>
                  <Text style={styles.previewMetaText}>נושא: {q.topicId}</Text>
                  <Text style={styles.previewMetaText}>קושי: {q.difficulty ?? 3}</Text>
                  <Text style={styles.previewMetaText}>תשובות: {q.options.length}</Text>
                </View>
              </View>
            ))}
            {preview.length > 5 && (
              <Text style={styles.moreText}>+ עוד {preview.length - 5} שאלות...</Text>
            )}

            {/* Import button */}
            <Pressable onPress={handleImport} disabled={importing} style={({ pressed }) => [styles.importBtnWrap, pressed && { opacity: 0.9 }]}>
              <LinearGradient colors={Colors.gradients.success} style={styles.importBtn}>
                {importing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.importBtnText}>✅ ייבא {preview.length} שאלות ל-Supabase</Text>
                }
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Result */}
        {importResult && (
          <View style={[styles.resultBox, { borderColor: importResult.failed === 0 ? Colors.success : Colors.warning }]}>
            <Text style={styles.resultTitle}>
              {importResult.failed === 0 ? '✅ ייבוא הצליח!' : '⚠️ ייבוא חלקי'}
            </Text>
            <Text style={styles.resultText}>
              עברו בהצלחה: {importResult.success}{'\n'}
              נכשלו: {importResult.failed}{'\n'}
              {'\n'}השאלות המיובאות יופיעו בתור ולידציה לאישור.
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 48 },

  infoCard: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  infoTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.primary, textAlign: 'right', marginBottom: 10 },
  infoText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 22 },
  bold: { fontFamily: FontFamily.bold },
  exampleBtn: {
    marginTop: 12, alignSelf: 'flex-end',
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  exampleBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#fff' },

  label: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', marginBottom: 8 },
  jsonInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    minHeight: 200,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'left',
    marginBottom: 8,
    ...Shadow.sm,
  },

  errorBox: {
    backgroundColor: Colors.danger + '15',
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
  },
  errorText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.danger, textAlign: 'right', lineHeight: 20 },

  parseBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    ...Shadow.primary,
  },
  parseBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  previewSection: { marginBottom: 20 },
  previewTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right', marginBottom: 12 },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  previewNum: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary, textAlign: 'right', marginBottom: 4 },
  previewText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20, marginBottom: 8 },
  previewMeta: { flexDirection: 'row-reverse', gap: 12 },
  previewMetaText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  moreText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: 12 },

  importBtnWrap: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary, marginTop: 8 },
  importBtn: { padding: 18, alignItems: 'center' },
  importBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  resultBox: {
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 2,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  resultTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right', marginBottom: 8 },
  resultText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 22 },
});
