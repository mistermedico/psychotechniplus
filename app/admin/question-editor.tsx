import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, KeyboardAvoidingView, Platform, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Question, QuestionOption, QuestionType, AccessLevel, ValidationStatus } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { detectDir, textAlign as ta } from '../../utils/textDirection';
import { AdminImagePicker } from '../../components/AdminImagePicker';
import { VisualImage } from '../../components/VisualImage';
import { loadQuestionUsageStats, QuestionUsageStats } from '../../lib/db';
import { auditPsychotechnicQuestion } from '../../utils/questionQuality';
import AdminErrorToast, { AdminToastError, showAdminErrorToast } from '../../components/AdminErrorToast';

const QUESTION_TYPES: QuestionType[] = [
  'multiple_choice', 'true_false', 'logic', 'verbal', 'quantitative', 'shapes',
  'reading_comprehension', 'fill_in_the_blank',
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

// difficulty (1-10) → suggested ELO
const difficultyToElo = (d: number) => Math.round(700 + (d / 10) * 1300);

interface AdminOption extends QuestionOption {
  imageUrl?: string;
}

const DEFAULT_OPTIONS: AdminOption[] = [
  { id: 'a', text: '', isCorrect: true },
  { id: 'b', text: '', isCorrect: false },
  { id: 'c', text: '', isCorrect: false },
  { id: 'd', text: '', isCorrect: false },
];

export default function QuestionEditor() {
  const insets = useSafeAreaInsets();
  const { questionId, mode } = useLocalSearchParams<{ questionId?: string; mode: string }>();
  const { questions, topics, targets, addQuestion, updateQuestion } = useAdminStore();

  const existing = questionId ? questions.find(q => q.id === questionId) : undefined;
  const isEdit = mode === 'edit' && !!existing;
  const defaultTopicId = existing?.topicId ?? topics[0]?.id ?? '';
  const defaultTargetId = existing?.targetIds?.[0] ?? targets[0]?.id ?? '';

  const [questionText, setQuestionText] = useState(existing?.questionText ?? '');
  const [readingPassage, setReadingPassage] = useState(existing?.readingPassage ?? '');
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [topicId, setTopicId] = useState(defaultTopicId);
  const [questionType, setQuestionType] = useState<QuestionType>(existing?.questionType ?? 'multiple_choice');
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 5);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(existing?.accessLevel ?? 'free');
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>(existing?.validationStatus ?? 'draft');
  const [targetIds, setTargetIds] = useState<string[]>(existing?.targetIds ?? (defaultTargetId ? [defaultTargetId] : []));
  const [options, setOptions] = useState<AdminOption[]>(
    existing?.options.map(o => ({ ...o })) ?? DEFAULT_OPTIONS.map(o => ({ ...o }))
  );
  const [eloOverride, setEloOverride] = useState(String(existing?.psychometricStats.elo ?? difficultyToElo(5)));
  const eloManuallyEdited = useRef(!!existing);
  const [isDirty, setIsDirty] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(existing?.mediaUrl ?? '');
  const [explanationImageUrl, setExplanationImageUrl] = useState(existing?.explanationImageUrl ?? '');
  const [usageStats, setUsageStats] = useState<QuestionUsageStats | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | undefined>(
    existing?.mediaType === 'image' ? 'image' : undefined
  );
  const [imageOnlyMode, setImageOnlyMode] = useState(false);
  const [toastError, setToastError] = useState<AdminToastError | null>(null);

  const markDirty = () => { if (!isDirty) setIsDirty(true); };

  useEffect(() => {
    if (!topicId && topics[0]?.id) setTopicId(topics[0].id);
  }, [topicId, topics]);

  useEffect(() => {
    if (targetIds.length === 0 && targets[0]?.id) setTargetIds([targets[0].id]);
  }, [targetIds.length, targets]);

  // Auto-assign target when topic changes
  useEffect(() => {
    const topic = topics.find(t => t.id === topicId);
    if (topic?.targetId && !targetIds.includes(topic.targetId)) {
      setTargetIds(prev => [...prev, topic.targetId]);
      markDirty();
    }
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-suggest ELO when difficulty changes (unless user manually edited)
  useEffect(() => {
    if (!eloManuallyEdited.current) {
      setEloOverride(String(difficultyToElo(difficulty)));
    }
  }, [difficulty]);

  useEffect(() => {
    if (!isEdit || !questionId) return;
    let cancelled = false;
    setUsageLoading(true);
    loadQuestionUsageStats(questionId)
      .then(stats => {
        if (!cancelled) setUsageStats(stats);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => { cancelled = true; };
  }, [isEdit, questionId]);

  const handleBack = () => {
    if (isDirty) {
      Alert.alert('שינויים לא שמורים', 'יש שינויים שלא נשמרו. לצאת בכל זאת?', [
        { text: 'המשך עריכה', style: 'cancel' },
        { text: 'צא ללא שמירה', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  const setCorrectOption = (id: string) => {
    setOptions(prev => prev.map(o => ({ ...o, isCorrect: o.id === id })));
    markDirty();
  };

  const updateOptionText = (id: string, text: string) => {
    setOptions(prev => prev.map(o => (o.id === id ? { ...o, text } : o)));
    markDirty();
  };

  const updateOptionImage = (id: string, imageUrl: string) => {
    setOptions(prev => prev.map(o => (o.id === id ? { ...o, imageUrl: imageUrl || undefined } : o)));
    markDirty();
  };

  const addOption = () => {
    if (options.length >= 6) return;
    const nextId = String.fromCharCode(97 + options.length);
    setOptions(prev => [...prev, { id: nextId, text: '', isCorrect: false }]);
    markDirty();
  };

  const removeOption = (id: string) => {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter(o => o.id !== id));
    markDirty();
  };

  const toggleTarget = (tId: string) => {
    setTargetIds(prev =>
      prev.includes(tId) ? prev.filter(x => x !== tId) : [...prev, tId]
    );
    markDirty();
  };

  const handleTopicChange = (tId: string) => {
    setTopicId(tId);
    // Auto-assign the topic's parent target
    const topic = topics.find(t => t.id === tId);
    if (topic?.targetId) {
      setTargetIds(prev => prev.includes(topic.targetId) ? prev : [...prev, topic.targetId]);
    }
    markDirty();
  };

  const currentDraftForAudit = useMemo<Omit<Question, 'id'>>(() => {
    const correctOpt = options.find(o => o.isCorrect);
    const rawElo = parseInt(eloOverride);
    const elo = isNaN(rawElo) ? difficultyToElo(difficulty) : Math.max(800, Math.min(2000, rawElo));
    return {
      targetIds,
      topicId,
      questionType,
      questionText,
      readingPassage: readingPassage.trim() || undefined,
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaUrl ? 'image' : undefined,
      options,
      correctAnswer: correctOpt?.id ?? '',
      explanation,
      explanationImageUrl: explanationImageUrl || undefined,
      difficulty,
      psychometricStats: { elo, discrimination: 0.75, guessProbability: 0.25 },
      accessLevel,
      validationStatus,
      smartPracticeEligible: validationStatus === 'validated',
      generalPracticeEligible: validationStatus === 'validated',
    };
  }, [accessLevel, difficulty, eloOverride, explanation, explanationImageUrl, mediaUrl, options, questionText, questionType, readingPassage, targetIds, topicId, validationStatus]);

  const qualityIssues = useMemo(() => auditPsychotechnicQuestion(currentDraftForAudit), [currentDraftForAudit]);
  const selectedTopic = topics.find(t => t.id === topicId);
  const selectedTargets = targetIds.map(id => targets.find(t => t.id === id)?.name ?? id);
  const correctOption = options.find(o => o.isCorrect);
  const imageCount = (mediaUrl ? 1 : 0) + (explanationImageUrl ? 1 : 0) + options.filter(o => o.imageUrl).length;

  const handleSave = (nextAction: 'back' | 'stay' | 'preview' = 'back') => {
    if (!questionText.trim()) {
      showAdminErrorToast(setToastError, 'חסר טקסט שאלה', 'נא להזין את טקסט השאלה לפני שמירה.', { questionId, mode, currentDraftForAudit }, 'admin:question-editor');
      return;
    }
    if (questionText.trim().length < 10) {
      showAdminErrorToast(setToastError, 'טקסט קצר מדי', 'טקסט השאלה חייב להיות לפחות 10 תווים.', { questionId, length: questionText.trim().length }, 'admin:question-editor');
      return;
    }
    const optionsNeedText = !imageOnlyMode && !options.every(o => !!o.imageUrl);
    if (optionsNeedText && options.some(o => !o.text.trim())) {
      showAdminErrorToast(setToastError, 'אפשרויות חסרות', 'נא למלא טקסט או תמונה לכל אפשרות תשובה.', { questionId, options }, 'admin:question-editor');
      return;
    }
    const correctOpt = options.find(o => o.isCorrect);
    if (!correctOpt) {
      showAdminErrorToast(setToastError, 'חסרה תשובה נכונה', 'נא לסמן תשובה נכונה אחת לפני שמירה.', { questionId, options }, 'admin:question-editor');
      return;
    }
    if (!explanation.trim()) {
      showAdminErrorToast(setToastError, 'חסר הסבר', 'נא להוסיף הסבר לשאלה לפני שמירה.', { questionId }, 'admin:question-editor');
      return;
    }
    if (targetIds.length === 0) {
      showAdminErrorToast(setToastError, 'חסר שיוך', 'יש לבחור לפחות מסלול/קורס אחד לפני שמירה.', { questionId, topicId }, 'admin:question-editor');
      return;
    }

    const rawElo = parseInt(eloOverride);
    const elo = isNaN(rawElo) ? difficultyToElo(difficulty) : Math.max(800, Math.min(2000, rawElo));
    const q: Omit<Question, 'id'> = {
      targetIds,
      topicId,
      questionType,
      questionText: questionText.trim(),
      readingPassage: readingPassage.trim() || undefined,
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaUrl ? 'image' : undefined,
      options: options.map(o => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect,
        analysisTag: o.analysisTag,
        imageUrl: o.imageUrl || undefined,
      })),
      correctAnswer: correctOpt.id,
      explanation: explanation.trim(),
      explanationImageUrl: explanationImageUrl || undefined,
      difficulty,
      psychometricStats: { elo, discrimination: 0.75, guessProbability: 0.25 },
      accessLevel,
      validationStatus,
      smartPracticeEligible: validationStatus === 'validated',
      generalPracticeEligible: validationStatus === 'validated',
    };

    const openPreview = (savedId: string) => {
      router.push({ pathname: '/practice-session', params: { questionId: savedId, adminPreview: '1' } });
    };

    if (isEdit && questionId) {
      updateQuestion(questionId, q);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsDirty(false);
      if (nextAction === 'stay') {
        Alert.alert('נשמר', 'השאלה עודכנה ונשמרה ל-Supabase.');
        return;
      }
      if (nextAction === 'preview') {
        openPreview(questionId);
        return;
      }
      Alert.alert(
        '✅ שאלה עודכנה',
        `נשמרה ל-Supabase עם סטטוס "${validationStatus}"\nעדכונים יופיעו מיד.`,
        [{ text: 'אוקי', onPress: () => router.back() }]
      );
    } else {
      const saved = addQuestion(q);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsDirty(false);
      if (nextAction === 'stay') {
        Alert.alert('נשמר', 'השאלה נוצרה ונשמרה ל-Supabase.');
        return;
      }
      if (nextAction === 'preview') {
        openPreview(saved.id);
        return;
      }
      Alert.alert(
        '✅ שאלה נוצרה',
        `נשמרה ל-Supabase עם סטטוס "${validationStatus}"\nתופיע בתור ולידציה.`,
        [
          { text: 'הוסף עוד', onPress: () => {
            setQuestionText('');
            setExplanation('');
            setExplanationImageUrl('');
            setOptions(DEFAULT_OPTIONS.map(o => ({ ...o })));
            setDifficulty(5);
            setEloOverride(String(difficultyToElo(5)));
            eloManuallyEdited.current = false;
            setIsDirty(false);
          }},
          { text: 'אוקי', onPress: () => router.back() },
        ]
      );
    }
  };

  const diffColor = difficulty <= 3 ? Colors.success : difficulty <= 6 ? Colors.warning : Colors.danger;

  return (
    <>
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backBtnText}>→ חזרה{isDirty ? ' •' : ''}</Text>
          </Pressable>

          {/* Header */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>{isEdit ? '✏️ עריכת שאלה' : '➕ שאלה חדשה'}</Text>
            {isDirty && <Text style={styles.dirtyBadge}>לא נשמר</Text>}
          </View>

          <View style={styles.workflowBar}>
            <View style={styles.workflowInfo}>
              <Text style={styles.workflowTitle}>{selectedTopic?.icon} {selectedTopic?.name ?? 'ללא נושא'}</Text>
              <Text style={styles.workflowSub} numberOfLines={2}>
                {selectedTargets.join(', ') || 'לא משויך למסלול'} · {TYPE_LABELS[questionType]} · {accessLevel === 'premium' ? 'פרימיום' : 'חינמי'}
              </Text>
            </View>
            <View style={styles.workflowStats}>
              <WorkflowPill label="תמונות" value={imageCount} tone={imageCount ? Colors.success : Colors.textTertiary} />
              <WorkflowPill label="תשובה" value={correctOption?.id.toUpperCase() ?? '-'} tone={correctOption ? Colors.success : Colors.danger} />
              <WorkflowPill label="בדיקות" value={qualityIssues.length ? qualityIssues.length : 'OK'} tone={qualityIssues.length ? Colors.warning : Colors.success} />
            </View>
            <View style={styles.workflowActions}>
              <Pressable onPress={() => router.push('/admin/question-assignment')} style={styles.workflowAction}>
                <Text style={styles.workflowActionText}>שיוך</Text>
              </Pressable>
              <Pressable onPress={() => handleSave('stay')} style={styles.workflowActionPrimary}>
                <Text style={styles.workflowActionPrimaryText}>שמור והשאר</Text>
              </Pressable>
              <Pressable onPress={() => handleSave('preview')} style={styles.workflowAction}>
                <Text style={styles.workflowActionText}>שמור ותצוגה</Text>
              </Pressable>
            </View>
          </View>

          {/* Section: question text */}
          <Section title="📝 טקסט השאלה">
            <TextInput
              style={[styles.textArea, { writingDirection: detectDir(questionText) }]}
              multiline
              value={questionText}
              onChangeText={v => { setQuestionText(v); markDirty(); }}
              placeholder="הזן את נוסח השאלה..."
              placeholderTextColor={Colors.textTertiary}
              textAlign={ta(questionText)}
              textAlignVertical="top"
              numberOfLines={4}
            />
            <Text style={styles.charCount}>{questionText.length} תווים</Text>
          </Section>

          {/* Section: question image */}
          <Section title="🖼️ תמונה לשאלה (אופציונלי)">
            {imageOnlyMode && (
              <Text style={styles.altTextHint}>
                מצב תמונה בלבד — הטקסט משמש כ-alt text בלבד
              </Text>
            )}
            <AdminImagePicker
              imageUri={mediaUrl}
              onImageChange={uri => {
                setMediaUrl(uri);
                setMediaType(uri ? 'image' : undefined);
                markDirty();
              }}
              placeholder="תמונה לשאלה"
              compact={false}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>שאלת תמונה בלבד</Text>
              <Switch
                value={imageOnlyMode}
                onValueChange={v => { setImageOnlyMode(v); markDirty(); }}
                trackColor={{ true: Colors.primary, false: Colors.border }}
              />
            </View>
          </Section>

          {/* Reading passage */}
          <Section title={`📖 קטע קריאה${questionType === 'reading_comprehension' ? ' (נדרש)' : ' (אופציונלי)'}`}>
            <TextInput
              style={[
                styles.textArea,
                { minHeight: 80, writingDirection: detectDir(readingPassage) },
                questionType === 'reading_comprehension' && { borderColor: Colors.primary },
              ]}
              multiline
              value={readingPassage}
              onChangeText={v => { setReadingPassage(v); markDirty(); }}
              placeholder="להבנת הנקרא — הכנס קטע טקסט..."
              placeholderTextColor={Colors.textTertiary}
              textAlign={ta(readingPassage)}
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
                    onPress={() => { setQuestionType(t); markDirty(); }}
                    style={[styles.chip, questionType === t && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, questionType === t && { color: '#fff' }]}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.diffHeader}>
              <Text style={styles.fieldLabel}>רמת קושי</Text>
              <View style={[styles.diffValueBadge, { backgroundColor: diffColor }]}>
                <Text style={styles.diffValueText}>{difficulty}/10</Text>
              </View>
            </View>
            {/* Difficulty slider — horizontal scroll, all 10 levels */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={styles.diffRow}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                  const btnColor = n <= difficulty
                    ? (n <= 3 ? Colors.success : n <= 6 ? Colors.warning : Colors.danger)
                    : Colors.surfaceSecondary;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => { setDifficulty(n); markDirty(); }}
                      style={[styles.diffBtn, { backgroundColor: btnColor }]}
                    >
                      <Text style={[styles.diffBtnText, { color: n <= difficulty ? '#fff' : Colors.textTertiary }]}>
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={styles.diffHint}>
              {difficulty <= 3 ? '🟢 קל — מתאים למתחילים' :
               difficulty <= 6 ? '🟡 בינוני — רמה ממוצעת' :
               '🔴 קשה — למתקדמים'}
            </Text>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>ELO שאלה (800 – 2000)</Text>
            <TextInput
              style={styles.input}
              value={eloOverride}
              onChangeText={v => {
                setEloOverride(v);
                eloManuallyEdited.current = true;
                markDirty();
              }}
              keyboardType="number-pad"
              textAlign="right"
              placeholder="1200"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.eloHint}>
              ELO מוצע לרמה {difficulty}: {difficultyToElo(difficulty)}
            </Text>
          </Section>

          {/* Section: topic + targets — auto-assignment */}
          <Section title="📚 נושא ומסלולים">
            <Text style={styles.fieldLabel}>נושא (בחירה אחת — המסלול יוגדר אוטומטית)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                {topics.map(t => (
                  <Pressable
                    key={t.id}
                    onPress={() => handleTopicChange(t.id)}
                    style={[styles.topicChip, topicId === t.id && { backgroundColor: t.color, borderColor: t.color }]}
                  >
                    <Text style={styles.topicChipIcon}>{t.icon}</Text>
                    <Text style={[styles.chipText, topicId === t.id && { color: '#fff' }]}>
                      {t.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: 4 }]}>מסלולים (ניתן לבחור כמה)</Text>
            <View style={styles.chipRow}>
              {targets.map(t => {
                const isSelected = targetIds.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggleTarget(t.id)}
                    style={[styles.chip, isSelected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isSelected && { color: '#fff' }]}>
                      {t.icon} {t.name}
                    </Text>
                    {isSelected && <Text style={styles.chipCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
            {targetIds.length === 0 && (
              <Text style={styles.warningText}>⚠️ יש לבחור לפחות מסלול אחד</Text>
            )}
          </Section>

          {/* Section: options */}
          <Section title="🔘 אפשרויות תשובה">
            <Text style={styles.fieldLabel}>לחץ על ○ לסמן תשובה נכונה</Text>
            {options.map((opt) => (
              <View key={opt.id} style={styles.optionBlock}>
                <View style={styles.optionRow}>
                  <Pressable
                    onPress={() => setCorrectOption(opt.id)}
                    style={styles.radioWrap}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={[styles.radio, opt.isCorrect && styles.radioActive]}>
                      {opt.isCorrect && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>
                  <Text style={styles.optionLabel}>{opt.id.toUpperCase()}.</Text>
                  <TextInput
                    style={[
                      styles.optionInput,
                      opt.isCorrect && { borderColor: Colors.success },
                      { writingDirection: detectDir(opt.text) },
                    ]}
                    value={opt.text}
                    onChangeText={t => updateOptionText(opt.id, t)}
                    placeholder={`אפשרות ${opt.id.toUpperCase()}...`}
                    placeholderTextColor={Colors.textTertiary}
                    textAlign={ta(opt.text)}
                  />
                  {options.length > 2 && (
                    <Pressable
                      onPress={() => removeOption(opt.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.removeOptBtn}
                    >
                      <Text style={{ fontSize: 16, color: Colors.danger }}>✕</Text>
                    </Pressable>
                  )}
                </View>
                <AdminImagePicker
                  imageUri={opt.imageUrl ?? ''}
                  onImageChange={uri => updateOptionImage(opt.id, uri)}
                  placeholder={`תמונה לאפשרות ${opt.id.toUpperCase()}`}
                  compact
                />
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
              style={[styles.textArea, { minHeight: 80, writingDirection: detectDir(explanation) }]}
              multiline
              value={explanation}
              onChangeText={v => { setExplanation(v); markDirty(); }}
              placeholder="הסבר מפורט לפתרון..."
              placeholderTextColor={Colors.textTertiary}
              textAlign={ta(explanation)}
              textAlignVertical="top"
            />
            <View style={styles.explanationImagePicker}>
              <AdminImagePicker
                imageUri={explanationImageUrl}
                onImageChange={uri => { setExplanationImageUrl(uri); markDirty(); }}
                placeholder="תמונה להסבר"
                compact={false}
              />
            </View>
          </Section>

          <Section title="👁️ תצוגה חיה של רכיבי השאלה">
            <QuestionEditorPreview
              questionText={questionText}
              mediaUrl={mediaUrl}
              options={options}
              explanation={explanation}
              explanationImageUrl={explanationImageUrl}
            />
          </Section>

          <Section title="🧪 בדיקת איכות לפני פרסום">
            <QualityChecklist issues={qualityIssues} imageCount={imageCount} optionCount={options.length} />
          </Section>

          {isEdit && (
            <Section title="📊 סטטיסטיקה והיסטוריית מענה">
              <QuestionUsagePanel stats={usageStats} loading={usageLoading} />
            </Section>
          )}

          {/* Access + Status */}
          <Section title="⚙️ הגדרות גישה וסטטוס">
            <View style={styles.accessRow}>
              <View style={styles.accessToggle}>
                <Text style={styles.switchLabel}>גישה חינמית</Text>
                <Switch
                  value={accessLevel === 'free'}
                  onValueChange={v => { setAccessLevel(v ? 'free' : 'premium'); markDirty(); }}
                  trackColor={{ true: Colors.success, false: Colors.warning }}
                />
              </View>
              <Text style={styles.accessHint}>
                {accessLevel === 'free' ? '🆓 כל המשתמשים' : '💎 פרמיום בלבד'}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>סטטוס ולידציה</Text>
            <View style={styles.chipRow}>
              {(['draft', 'pending', 'validated', 'rejected'] as ValidationStatus[]).map(s => (
                <Pressable
                  key={s}
                  onPress={() => { setValidationStatus(s); markDirty(); }}
                  style={[
                    styles.chip,
                    validationStatus === s && { backgroundColor: STATUS_BG[s], borderColor: STATUS_BG[s] },
                  ]}
                >
                  <Text style={[styles.chipText, validationStatus === s && { color: '#fff' }]}>
                    {s === 'draft' ? 'טיוטה' : s === 'pending' ? 'ממתין' : s === 'validated' ? '✅ מאושר' : '❌ נדחה'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {validationStatus === 'validated' && (
              <Text style={styles.validatedHint}>✅ שאלה מאושרת תופיע בתרגול</Text>
            )}
          </Section>

          {/* Save */}
          <Pressable
            onPress={() => handleSave('back')}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.saveBtnText}>{isEdit ? '💾 שמור שינויים' : '➕ הוסף שאלה'}</Text>
          </Pressable>

          {isEdit && (
            <Pressable
              onPress={() => router.push({ pathname: '/practice-session', params: { questionId, adminPreview: '1' } })}
              style={styles.previewBtn}
            >
              <Text style={styles.previewBtnText}>👁️ תצוגה מקדימה</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    <AdminErrorToast error={toastError} onDismiss={() => setToastError(null)} />
    </>
  );
}

function WorkflowPill({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <View style={[styles.workflowPill, { borderColor: tone + '55', backgroundColor: tone + '12' }]}>
      <Text style={[styles.workflowPillValue, { color: tone }]}>{value}</Text>
      <Text style={styles.workflowPillLabel}>{label}</Text>
    </View>
  );
}

function QualityChecklist({ issues, imageCount, optionCount }: { issues: string[]; imageCount: number; optionCount: number }) {
  const rows = [
    { label: 'תשובה נכונה אחת בלבד', ok: !issues.some(issue => issue.includes('תשובה נכונה')) },
    { label: 'הסבר מספיק ברור', ok: !issues.some(issue => issue.includes('הסבר')) },
    { label: 'לפחות שתי אפשרויות', ok: optionCount >= 2 },
    { label: 'מדיה ותמונות נשמרות', ok: imageCount > 0 },
    { label: 'מוכנה לפרסום במאגר', ok: issues.length === 0 },
  ];
  return (
    <View style={styles.qualityWrap}>
      {rows.map(row => (
        <View key={row.label} style={styles.qualityRow}>
          <Text style={[styles.qualityStatus, { color: row.ok ? Colors.success : Colors.warning }]}>{row.ok ? 'תקין' : 'לבדיקה'}</Text>
          <Text style={styles.qualityLabel}>{row.label}</Text>
        </View>
      ))}
      {issues.length > 0 && (
        <View style={styles.qualityIssuesBox}>
          {issues.map(issue => <Text key={issue} style={styles.qualityIssueText}>• {issue}</Text>)}
        </View>
      )}
    </View>
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

function QuestionEditorPreview({
  questionText,
  mediaUrl,
  options,
  explanation,
  explanationImageUrl,
}: {
  questionText: string;
  mediaUrl: string;
  options: AdminOption[];
  explanation: string;
  explanationImageUrl: string;
}) {
  return (
    <View style={styles.livePreviewWrap}>
      <Text style={[styles.livePreviewQuestion, { textAlign: ta(questionText), writingDirection: detectDir(questionText) }]}>
        {questionText.trim() || 'נוסח השאלה יוצג כאן'}
      </Text>
      <VisualImage uri={mediaUrl} style={styles.livePreviewQuestionImage} fallbackLabel="אין תמונת שאלה" />
      <View style={styles.livePreviewOptions}>
        {options.map(option => (
          <View key={option.id} style={[styles.livePreviewOption, option.isCorrect && styles.livePreviewOptionCorrect]}>
            <View style={styles.livePreviewOptionHeader}>
              <Text style={styles.livePreviewOptionId}>{option.id.toUpperCase()}</Text>
              {option.isCorrect && <Text style={styles.livePreviewCorrectBadge}>תשובה נכונה</Text>}
            </View>
            <VisualImage uri={option.imageUrl} style={styles.livePreviewOptionImage} fallbackLabel="אין תמונה" />
            <Text style={[styles.livePreviewOptionText, { textAlign: ta(option.text), writingDirection: detectDir(option.text) }]} numberOfLines={2}>
              {option.text?.trim() || 'טקסט תשובה ריק'}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.livePreviewExplanation}>
        <View style={styles.livePreviewExplanationTextBox}>
          <Text style={styles.previewMiniTitle}>הסבר</Text>
          <Text style={[styles.livePreviewExplanationText, { textAlign: ta(explanation), writingDirection: detectDir(explanation) }]}>
            {explanation.trim() || 'הסבר יוצג כאן'}
          </Text>
        </View>
        <VisualImage uri={explanationImageUrl} style={styles.livePreviewExplanationImage} fallbackLabel="אין תמונת הסבר" />
      </View>
    </View>
  );
}

function QuestionUsagePanel({ stats, loading }: { stats: QuestionUsageStats | null; loading: boolean }) {
  if (loading) {
    return (
      <View style={styles.usageLoading}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.usageLoadingText}>טוען נתוני מענה מסופאבייס...</Text>
      </View>
    );
  }

  if (!stats || stats.attempts === 0) {
    return (
      <View style={styles.usageEmpty}>
        <Text style={styles.usageEmptyTitle}>אין עדיין היסטוריית מענה לשאלה הזו</Text>
        <Text style={styles.usageEmptyText}>ברגע שמשתמש או אורח יענה עליה, הניסיונות, אחוזי ההצלחה והזמנים יופיעו כאן.</Text>
      </View>
    );
  }

  return (
    <View style={styles.usageWrap}>
      <View style={styles.usageStatsGrid}>
        <UsageChip label="ניסיונות" value={stats.attempts} tone={Colors.primary} />
        <UsageChip label="הצלחה" value={`${stats.correctRate}%`} tone={stats.correctRate >= 60 ? Colors.success : Colors.warning} />
        <UsageChip label="נכונות" value={stats.correctCount} tone={Colors.success} />
        <UsageChip label="דילוגים" value={stats.skippedCount} tone={stats.skippedCount ? Colors.warning : Colors.textTertiary} />
        <UsageChip label="זמן ממוצע" value={`${stats.avgTimeSeconds}s`} tone={Colors.accent} />
      </View>
      <Text style={styles.usageHistoryTitle}>מענה אחרון</Text>
      {stats.recentEvents.map(event => (
        <View key={`${event.sessionId}-${event.completedAt}`} style={styles.usageEventRow}>
          <Text style={[styles.usageEventResult, { color: event.isCorrect ? Colors.success : event.isSkipped ? Colors.warning : Colors.danger }]}>
            {event.isCorrect ? 'נכון' : event.isSkipped ? 'דילוג' : 'שגוי'}
          </Text>
          <Text style={styles.usageEventText}>
            {(event.userName || (event.userId.startsWith('guest_') ? 'אורח' : event.userId.slice(0, 8)))} · נבחרה {event.selectedAnswerId || '-'} · נכונה {event.correctAnswerId || '-'} · {event.timeSpentSeconds}s
          </Text>
          <Text style={styles.usageEventDate}>
            {event.completedAt ? new Date(event.completedAt).toLocaleString('he-IL') : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function UsageChip({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <View style={[styles.usageChip, { borderColor: tone + '55', backgroundColor: tone + '12' }]}>
      <Text style={[styles.usageChipValue, { color: tone }]}>{value}</Text>
      <Text style={styles.usageChipLabel}>{label}</Text>
    </View>
  );
}

const STATUS_BG: Record<ValidationStatus, string> = {
  draft: Colors.textTertiary,
  pending: Colors.warning,
  validated: Colors.success,
  rejected: Colors.danger,
  deleted: Colors.textTertiary,
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
  content: { padding: 16 },

  backBtn: { paddingVertical: 12, marginBottom: 4, alignSelf: 'flex-end' },
  backBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary, textAlign: 'right' },

  pageHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pageTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text },
  dirtyBadge: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  workflowBar: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    padding: 12,
    marginBottom: 12,
    gap: 12,
    ...Shadow.sm,
  },
  workflowInfo: { alignItems: 'flex-end', gap: 3 },
  workflowTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  workflowSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
  workflowStats: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  workflowPill: { flexGrow: 1, minWidth: 86, borderRadius: Radius.lg, borderWidth: 1, padding: 8, alignItems: 'flex-end' },
  workflowPillValue: { fontFamily: FontFamily.heading, fontSize: FontSize.base, textAlign: 'right' },
  workflowPillLabel: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
  workflowActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  workflowAction: {
    flexGrow: 1,
    minHeight: 40,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  workflowActionPrimary: {
    flexGrow: 1,
    minHeight: 40,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  workflowActionText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.text, textAlign: 'center' },
  workflowActionPrimaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff', textAlign: 'center' },

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

  charCount: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },
  explanationImagePicker: { marginTop: 12 },
  eloHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },
  warningText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.danger, textAlign: 'right', marginTop: 6 },
  validatedHint: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.success, textAlign: 'right', marginTop: 6 },

  livePreviewWrap: { gap: 12, writingDirection: 'rtl' },
  livePreviewQuestion: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, lineHeight: 24 },
  livePreviewQuestionImage: {
    width: '100%',
    height: 220,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundDark,
  },
  livePreviewOptions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  livePreviewOption: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 10,
    gap: 8,
  },
  livePreviewOptionCorrect: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  livePreviewOptionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  livePreviewOptionId: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  livePreviewCorrectBadge: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.success, textAlign: 'right' },
  livePreviewOptionImage: {
    width: '100%',
    height: 112,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundDark,
  },
  livePreviewOptionText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, minHeight: 18 },
  livePreviewExplanation: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' },
  livePreviewExplanationTextBox: { flex: 2, minWidth: 240, gap: 6 },
  previewMiniTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary, textAlign: 'right' },
  livePreviewExplanationText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 21 },
  livePreviewExplanationImage: {
    flex: 1,
    minWidth: 200,
    height: 150,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundDark,
  },
  usageLoading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  usageLoadingText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  usageEmpty: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  usageEmptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', marginBottom: 4 },
  usageEmptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', lineHeight: 18 },
  usageWrap: { gap: 12 },
  usageStatsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  usageChip: { flexGrow: 1, minWidth: 100, borderRadius: Radius.lg, borderWidth: 1, padding: 10, alignItems: 'flex-end' },
  usageChipValue: { fontFamily: FontFamily.heading, fontSize: FontSize.lg, textAlign: 'right' },
  usageChipLabel: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
  usageHistoryTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  usageEventRow: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'flex-end', gap: 2 },
  usageEventResult: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, textAlign: 'right' },
  usageEventText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
  usageEventDate: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'right' },
  qualityWrap: { gap: 8 },
  qualityRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  qualityStatus: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, minWidth: 62, textAlign: 'left' },
  qualityLabel: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  qualityIssuesBox: {
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    padding: 10,
    marginTop: 4,
  },
  qualityIssueText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.warning, textAlign: 'right', lineHeight: 19 },

  // Difficulty
  diffHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  diffValueBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  diffValueText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  diffRow: { flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 2, paddingBottom: 4 },
  diffBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  diffHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },

  // Chips
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  chipCheck: { fontFamily: FontFamily.bold, fontSize: 10, color: '#fff' },

  // Topic chip (wider, shows icon prominently)
  topicChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  topicChipIcon: { fontSize: 16 },

  // Options
  optionBlock: { marginBottom: 14 },
  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  radioWrap: { padding: 6 },
  radio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.success },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.success },
  optionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textSecondary, width: 22 },
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
  removeOptBtn: { padding: 6 },

  addOptionBtn: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addOptionText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },

  // Access row
  accessRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  accessToggle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  accessHint: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  switchRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  switchLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text, flex: 1, textAlign: 'right' },

  altTextHint: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
    textAlign: 'right',
    marginBottom: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.md,
    padding: 8,
  },

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
    marginBottom: 8,
  },
  previewBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
});
