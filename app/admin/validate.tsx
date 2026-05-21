import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Alert, ScrollView, Image,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { TOPICS } from '../../data/mockData';
import { Question, QuestionOption, QuestionType, AccessLevel } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { detectDir, textAlign as ta } from '../../utils/textDirection';
import { startBulkGeneration, stopBulkGeneration } from '../../utils/backgroundGenerator';

// ── Question type options ──────────────────────────────────────────────────

const QUESTION_TYPES: { type: QuestionType; label: string }[] = [
  { type: 'multiple_choice', label: 'בחירה מרובה' },
  { type: 'verbal', label: 'מילולי' },
  { type: 'logic', label: 'היגיון' },
  { type: 'quantitative', label: 'כמותי' },
  { type: 'shapes', label: 'צורות' },
  { type: 'reading_comprehension', label: 'הבנת הנקרא' },
  { type: 'true_false', label: 'נכון/לא נכון' },
  { type: 'fill_in_the_blank', label: 'השלמת משפט' },
];

// ── Edit draft type ────────────────────────────────────────────────────────

interface EditDraft {
  questionText: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  topicId: string;
  questionType: QuestionType;
  accessLevel: AccessLevel;
}

function questionToDraft(q: Question): EditDraft {
  return {
    questionText: q.questionText,
    options: q.options.map(o => ({ ...o })),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    topicId: q.topicId,
    questionType: q.questionType,
    accessLevel: q.accessLevel,
  };
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ValidateQueue() {
  const {
    getPendingQuestions, validateQuestion, getQuestionsByStatus, bulkValidate,
    addQuestion, updateQuestion,
    bgGenRunning, bgGenProgress, setBgGenRunning, setBgGenProgress,
  } = useAdminStore();

  const pending = getPendingQuestions();
  const rejected = getQuestionsByStatus('rejected');

  const [currentIdx, setCurrentIdx] = useState(0);
  const [filter, setFilter] = useState<'pending' | 'rejected'>('pending');
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [showGenLog, setShowGenLog] = useState(false);

  const queue = filter === 'pending' ? pending : rejected;
  const safeIdx = Math.min(currentIdx, Math.max(0, queue.length - 1));
  const current = queue[safeIdx];

  const slideAnim = useState(new Animated.Value(0))[0];
  const [isAnimating, setIsAnimating] = useState(false);

  const animateOut = (direction: 'approve' | 'reject', cb: () => void) => {
    if (isAnimating) return;
    setIsAnimating(true);
    Animated.timing(slideAnim, {
      toValue: direction === 'approve' ? -400 : 400,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(0);
      setIsAnimating(false);
      cb();
    });
  };

  const handleApprove = (q: Question) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    animateOut('approve', () => {
      validateQuestion(q.id, 'validated');
      setCurrentIdx(i => Math.max(0, i >= pending.length - 1 ? 0 : i));
    });
  };

  const handleReject = (q: Question) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    animateOut('reject', () => {
      validateQuestion(q.id, 'rejected');
      setCurrentIdx(i => Math.max(0, i >= pending.length - 1 ? 0 : i));
    });
  };

  const handleReApprove = (q: Question) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    animateOut('approve', () => {
      validateQuestion(q.id, 'validated');
      setCurrentIdx(i => Math.max(0, i >= rejected.length - 1 ? 0 : i));
    });
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    setCurrentIdx(i => (i + 1) % Math.max(1, queue.length));
  };

  const handleOpenEdit = (q: Question) => {
    setEditDraft(questionToDraft(q));
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (!current || !editDraft) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Fix correctAnswer to match the option marked isCorrect
    const correctOpt = editDraft.options.find(o => o.isCorrect);
    const finalDraft = {
      ...editDraft,
      correctAnswer: correctOpt?.id ?? editDraft.correctAnswer,
    };
    updateQuestion(current.id, finalDraft);
    setEditMode(false);
    setEditDraft(null);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditDraft(null);
  };

  // ── Background generator ───────────────────────────────────────────────

  const handleStartGenerator = () => {
    Alert.alert(
      '🤖 יצירת שאלות אוטומטית',
      `הסוכן ייצור ~120 שאלות בקטגוריות שונות.\nכל השאלות יחכו לאימות שלך.\n\nהיצירה עשויה לארוך כמה דקות.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התחל', onPress: () => {
            setBgGenRunning(true);
            setBgGenProgress({ done: 0, total: 40, currentTopic: '...', currentType: '...', log: [] });
            startBulkGeneration(
              addQuestion,
              (p) => setBgGenProgress(p),
              (totalDone) => {
                setBgGenRunning(false);
                Alert.alert('✅ הושלם!', `נוצרו שאלות מ-${totalDone} קבוצות.\nבדוק את תור האימות.`);
              },
            ).catch(() => {
              setBgGenRunning(false);
            });
          },
        },
      ]
    );
  };

  const handleStopGenerator = () => {
    stopBulkGeneration();
    setBgGenRunning(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header stats */}
      <View style={styles.statsRow}>
        <Pressable onPress={() => { setFilter('pending'); setCurrentIdx(0); setEditMode(false); }}>
          <StatPill label="ממתינות" value={pending.length} color={Colors.warning} active={filter === 'pending'} />
        </Pressable>
        <Pressable onPress={() => { setFilter('rejected'); setCurrentIdx(0); setEditMode(false); }}>
          <StatPill label="נדחו" value={rejected.length} color={Colors.danger} active={filter === 'rejected'} />
        </Pressable>
        <StatPill label="אושרו" value={getQuestionsByStatus('validated').length} color={Colors.success} active={false} />

        {/* Generator button */}
        {!bgGenRunning ? (
          <Pressable onPress={handleStartGenerator} style={styles.genBtn}>
            <Text style={styles.genBtnText}>🤖</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleStopGenerator} style={[styles.genBtn, { backgroundColor: Colors.dangerLight, borderColor: Colors.danger }]}>
            <Text style={styles.genBtnText}>⏹️</Text>
          </Pressable>
        )}
      </View>

      {/* Generator progress banner */}
      {bgGenRunning && bgGenProgress && (
        <Pressable onPress={() => setShowGenLog(v => !v)} style={styles.genBanner}>
          <View style={styles.genBannerInner}>
            <View style={styles.genProgressTrack}>
              <View style={[styles.genProgressFill, { width: `${(bgGenProgress.done / bgGenProgress.total) * 100}%` as any }]} />
            </View>
            <Text style={styles.genBannerText}>
              ⚙️ יוצר שאלות... {bgGenProgress.done}/{bgGenProgress.total} — {bgGenProgress.currentTopic}
            </Text>
          </View>
          {showGenLog && bgGenProgress.log.length > 0 && (
            <ScrollView style={styles.genLogScroll} nestedScrollEnabled>
              {bgGenProgress.log.slice(0, 10).map((msg, i) => (
                <Text key={i} style={styles.genLogText}>{msg}</Text>
              ))}
            </ScrollView>
          )}
        </Pressable>
      )}

      {queue.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{filter === 'pending' ? '🎉' : '✨'}</Text>
          <Text style={styles.emptyTitle}>{filter === 'pending' ? 'אין שאלות ממתינות!' : 'אין שאלות נדחות'}</Text>
          <Text style={styles.emptyDesc}>{filter === 'pending' ? 'כל השאלות עברו ולידציה.' : 'לא נדחתה אף שאלה.'}</Text>
          {filter === 'pending' && !bgGenRunning && (
            <Pressable onPress={handleStartGenerator} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>🤖 יצור שאלות אוטומטית</Text>
            </Pressable>
          )}
          {filter === 'pending' && (
            <Pressable onPress={() => router.push('/admin/ai-generator')} style={[styles.emptyBtn, { backgroundColor: Colors.primaryLighter, marginTop: 10 }]}>
              <Text style={[styles.emptyBtnText, { color: Colors.primary }]}>✏️ יצור שאלות ידנית</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {/* Progress */}
          {!editMode && (
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>{safeIdx + 1} / {queue.length}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: `${((safeIdx + 1) / queue.length) * 100}%`,
                  backgroundColor: filter === 'pending' ? Colors.warning : Colors.danger,
                }]} />
              </View>
            </View>
          )}

          {/* Card or Edit Form */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {editMode && editDraft && current ? (
              <QuestionEditForm
                draft={editDraft}
                onChange={setEditDraft}
              />
            ) : (
              <Animated.View style={[styles.cardWrap, { transform: [{ translateX: slideAnim }] }]}>
                {current && <QuestionPreviewCard question={current} />}
              </Animated.View>
            )}

            {/* Action buttons */}
            <View style={styles.actions}>
              {editMode ? (
                <>
                  <Pressable
                    onPress={handleCancelEdit}
                    style={({ pressed }) => [styles.skipBtn, { flex: 1 }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.skipText}>ביטול</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveEdit}
                    style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
                  >
                    <LinearGradient colors={Colors.gradients.primary} style={styles.saveBtnGrad}>
                      <Text style={styles.saveBtnText}>💾 שמור שינויים</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : filter === 'pending' ? (
                <>
                  <Pressable
                    onPress={() => !isAnimating && handleReject(current)}
                    style={({ pressed }) => [styles.rejectBtn, (pressed || isAnimating) && { transform: [{ scale: 0.95 }] }]}
                  >
                    <Text style={styles.rejectIcon}>❌</Text>
                    <Text style={styles.rejectText}>דחה</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSkip}
                    style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.skipText}>דלג</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => current && handleOpenEdit(current)}
                    style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.editText}>✏️ ערוך</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => !isAnimating && handleApprove(current)}
                    style={({ pressed }) => [styles.approveBtn, (pressed || isAnimating) && { transform: [{ scale: 0.95 }] }]}
                  >
                    <Text style={styles.approveIcon}>✅</Text>
                    <Text style={styles.approveText}>אשר</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={handleSkip}
                    style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.skipText}>דלג</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => current && handleOpenEdit(current)}
                    style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.editText}>✏️ ערוך</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => !isAnimating && current && handleReApprove(current)}
                    style={({ pressed }) => [styles.approveBtn, (pressed || isAnimating) && { transform: [{ scale: 0.95 }] }]}
                  >
                    <Text style={styles.approveIcon}>↩️</Text>
                    <Text style={styles.approveText}>אשר מחדש</Text>
                  </Pressable>
                </>
              )}
            </View>
          </KeyboardAvoidingView>

          {/* Bulk actions — only when not in edit mode */}
          {!editMode && (
            <View style={styles.bulkRow}>
              {filter === 'pending' && (
                <Pressable
                  onPress={() => Alert.alert('אישור קבוצתי', `לאשר את כל ${pending.length} השאלות הממתינות?`, [
                    { text: 'ביטול', style: 'cancel' },
                    { text: 'אשר הכל', onPress: () => { bulkValidate(pending.map(q => q.id), 'validated'); setCurrentIdx(0); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
                  ])}
                  style={[styles.bulkApproveBtn, { flex: 1 }]}
                >
                  <Text style={styles.bulkApproveText}>✅ אשר את כל {pending.length} הממתינות</Text>
                </Pressable>
              )}
              {filter === 'rejected' && (
                <Pressable
                  onPress={() => Alert.alert('אישור מחדש', `לאשר את כל ${rejected.length} השאלות הנדחות?`, [
                    { text: 'ביטול', style: 'cancel' },
                    { text: 'אשר הכל', onPress: () => { bulkValidate(rejected.map(q => q.id), 'validated'); setCurrentIdx(0); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
                  ])}
                  style={[styles.bulkApproveBtn, { flex: 1, backgroundColor: Colors.successLight, borderColor: Colors.success }]}
                >
                  <Text style={[styles.bulkApproveText, { color: Colors.success }]}>↩️ אשר מחדש את כל {rejected.length} הנדחות</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ── Question Edit Form ─────────────────────────────────────────────────────

function QuestionEditForm({
  draft, onChange,
}: {
  draft: EditDraft;
  onChange: (d: EditDraft) => void;
}) {
  const topics = TOPICS;

  const setCorrectAnswer = (optId: string) => {
    onChange({
      ...draft,
      correctAnswer: optId,
      options: draft.options.map(o => ({ ...o, isCorrect: o.id === optId })),
    });
  };

  const updateOptionText = (optId: string, text: string) => {
    onChange({
      ...draft,
      options: draft.options.map(o => o.id === optId ? { ...o, text } : o),
    });
  };

  return (
    <ScrollView
      style={editStyles.scroll}
      contentContainerStyle={editStyles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={editStyles.sectionLabel}>טקסט השאלה</Text>
      <TextInput
        style={[editStyles.textInput, editStyles.multiline]}
        value={draft.questionText}
        onChangeText={v => onChange({ ...draft, questionText: v })}
        multiline
        numberOfLines={4}
        textAlign="right"
        textAlignVertical="top"
        placeholder="הכנס טקסט שאלה..."
        placeholderTextColor="rgba(255,255,255,0.25)"
      />

      <Text style={editStyles.sectionLabel}>תשובות</Text>
      {draft.options.map(opt => (
        <View key={opt.id} style={[editStyles.optionRow, opt.isCorrect && editStyles.optionRowCorrect]}>
          <Pressable
            onPress={() => setCorrectAnswer(opt.id)}
            style={[editStyles.radioBtn, opt.isCorrect && editStyles.radioBtnActive]}
          >
            {opt.isCorrect && <View style={editStyles.radioDot} />}
          </Pressable>
          <Text style={editStyles.optionLetter}>{opt.id.toUpperCase()}</Text>
          <TextInput
            style={editStyles.optionInput}
            value={opt.text}
            onChangeText={v => updateOptionText(opt.id, v)}
            textAlign="right"
            placeholder={`אפשרות ${opt.id.toUpperCase()}`}
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
        </View>
      ))}

      <Text style={editStyles.sectionLabel}>הסבר</Text>
      <TextInput
        style={[editStyles.textInput, editStyles.multiline]}
        value={draft.explanation}
        onChangeText={v => onChange({ ...draft, explanation: v })}
        multiline
        numberOfLines={3}
        textAlign="right"
        textAlignVertical="top"
        placeholder="הסבר מפורט..."
        placeholderTextColor="rgba(255,255,255,0.25)"
      />

      <Text style={editStyles.sectionLabel}>רמת קושי: {draft.difficulty}</Text>
      <View style={editStyles.diffRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
          <Pressable
            key={d}
            onPress={() => onChange({ ...draft, difficulty: d })}
            style={[
              editStyles.diffChip,
              draft.difficulty === d && {
                backgroundColor: d <= 3 ? Colors.success : d <= 6 ? Colors.warning : Colors.danger,
                borderColor: 'transparent',
              },
            ]}
          >
            <Text style={[editStyles.diffChipText, draft.difficulty === d && { color: '#fff' }]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={editStyles.sectionLabel}>נושא</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={editStyles.chipsScroll}>
        <View style={editStyles.chipsRow}>
          {topics.map(t => (
            <Pressable
              key={t.id}
              onPress={() => onChange({ ...draft, topicId: t.id })}
              style={[editStyles.chip, draft.topicId === t.id && { backgroundColor: Colors.primaryLighter, borderColor: Colors.primary }]}
            >
              <Text style={editStyles.chipText}>{t.icon} {t.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={editStyles.sectionLabel}>סוג שאלה</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={editStyles.chipsScroll}>
        <View style={editStyles.chipsRow}>
          {QUESTION_TYPES.map(qt => (
            <Pressable
              key={qt.type}
              onPress={() => onChange({ ...draft, questionType: qt.type })}
              style={[editStyles.chip, draft.questionType === qt.type && { backgroundColor: Colors.primaryLighter, borderColor: Colors.primary }]}
            >
              <Text style={editStyles.chipText}>{qt.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={editStyles.sectionLabel}>רמת גישה</Text>
      <View style={editStyles.chipsRow}>
        {(['free', 'premium'] as AccessLevel[]).map(level => (
          <Pressable
            key={level}
            onPress={() => onChange({ ...draft, accessLevel: level })}
            style={[
              editStyles.chip,
              draft.accessLevel === level && {
                backgroundColor: level === 'free' ? Colors.successLight : Colors.warningLight,
                borderColor: level === 'free' ? Colors.success : Colors.warning,
              },
            ]}
          >
            <Text style={editStyles.chipText}>{level === 'free' ? '🆓 חינמי' : '💎 פרמיום'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Question Preview Card ──────────────────────────────────────────────────

function QuestionPreviewCard({ question }: { question: Question }) {
  const topic = TOPICS.find(t => t.id === question.topicId);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={cardStyles.card}>
        <View style={cardStyles.meta}>
          <View style={[cardStyles.diffBadge, {
            backgroundColor: question.difficulty <= 3 ? Colors.successLight
              : question.difficulty <= 6 ? Colors.warningLight : Colors.dangerLight,
          }]}>
            <Text style={[cardStyles.diffText, {
              color: question.difficulty <= 3 ? Colors.success
                : question.difficulty <= 6 ? Colors.warning : Colors.danger,
            }]}>
              רמה {question.difficulty}
            </Text>
          </View>
          <Text style={cardStyles.typeBadge}>{question.questionType}</Text>
          <Text style={cardStyles.topicBadge}>{topic?.icon} {topic?.name}</Text>
        </View>

        <Text style={[cardStyles.questionText, { textAlign: ta(question.questionText), writingDirection: detectDir(question.questionText) }]}>
          {question.questionText}
        </Text>

        {question.mediaUrl && question.mediaType === 'image' && (
          <Image source={{ uri: question.mediaUrl }} style={{ width: '100%', height: 160, borderRadius: 8, marginBottom: 8 }} resizeMode="contain" />
        )}

        <View style={cardStyles.options}>
          {question.options.map(opt => {
            const optDir = detectDir(opt.text);
            return (
              <View
                key={opt.id}
                style={[
                  cardStyles.optionRow,
                  { flexDirection: optDir === 'rtl' ? 'row-reverse' : 'row' },
                  opt.isCorrect && { backgroundColor: Colors.successLight, borderColor: Colors.success },
                ]}
              >
                <Text style={[cardStyles.optionId, opt.isCorrect && { color: Colors.success }]}>{opt.id.toUpperCase()}</Text>
                <Text style={[cardStyles.optionText, { textAlign: ta(opt.text), writingDirection: optDir }]}>{opt.text}</Text>
                {opt.isCorrect && <Text style={cardStyles.correctMark}>✓</Text>}
              </View>
            );
          })}
        </View>

        {question.explanation ? (
          <View style={cardStyles.explanation}>
            <Text style={cardStyles.explanationLabel}>💡 הסבר:</Text>
            <Text style={[cardStyles.explanationText, { textAlign: ta(question.explanation), writingDirection: detectDir(question.explanation) }]}>
              {question.explanation}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

// ── StatPill ───────────────────────────────────────────────────────────────

function StatPill({ label, value, color, active }: { label: string; value: number; color: string; active: boolean }) {
  return (
    <View style={[pillStyles.pill, { borderColor: active ? color : color + '40', borderWidth: active ? 2 : 1.5, backgroundColor: active ? color + '15' : Colors.surface }]}>
      <Text style={[pillStyles.value, { color }]}>{value}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const pillStyles = StyleSheet.create({
  pill: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    ...Shadow.sm,
  },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
  label: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
});

const cardStyles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, ...Shadow.md, borderWidth: 1, borderColor: Colors.border, margin: 4 },
  meta: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  diffBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  diffText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  typeBadge: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  topicBadge: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, backgroundColor: Colors.primaryLighter, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  questionText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.text, lineHeight: 24, marginBottom: 12 },
  options: { gap: 6, marginBottom: 12 },
  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 10, gap: 8, backgroundColor: Colors.surfaceSecondary },
  optionId: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary, width: 20, textAlign: 'center' },
  optionText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text },
  correctMark: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.success },
  explanation: { backgroundColor: Colors.primaryLighter, borderRadius: Radius.lg, padding: 10 },
  explanationLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary, textAlign: 'right', marginBottom: 4 },
  explanationText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
});

const editStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  sectionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary, textAlign: 'right', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },

  textInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.lg,
    padding: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },

  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  optionRowCorrect: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  radioBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioBtnActive: { borderColor: Colors.success },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  optionLetter: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary, width: 18, textAlign: 'center' },
  optionInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    padding: 4,
  },

  diffRow: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  diffChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary },

  chipsScroll: { marginBottom: 4 },
  chipsRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  statsRow: { flexDirection: 'row-reverse', padding: 12, gap: 8 },

  genBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genBtnText: { fontSize: 20 },

  genBanner: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    padding: 10,
  },
  genBannerInner: { gap: 6 },
  genProgressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  genProgressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  genBannerText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.primaryLight, textAlign: 'right' },
  genLogScroll: { maxHeight: 120, marginTop: 6 },
  genLogText: { fontFamily: FontFamily.regular, fontSize: 11, color: Colors.textTertiary, textAlign: 'right', lineHeight: 18 },

  progressRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  progressText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, width: 50, textAlign: 'right' },
  progressTrack: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.warning, borderRadius: 3 },

  cardWrap: { flex: 1, paddingHorizontal: 16, marginBottom: 4 },

  actions: { flexDirection: 'row-reverse', padding: 12, gap: 10, alignItems: 'center' },

  rejectBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.danger },
  rejectIcon: { fontSize: 20 },
  rejectText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.danger, marginTop: 2 },

  skipBtn: { height: 48, backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14 },
  skipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  editBtn: { height: 48, paddingHorizontal: 14, backgroundColor: Colors.primaryLighter, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  editText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },

  approveBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.successLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.success },
  approveIcon: { fontSize: 20 },
  approveText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.success, marginTop: 2 },

  saveBtn: { flex: 1, borderRadius: Radius.xl, overflow: 'hidden' },
  saveBtnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  bulkRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  bulkApproveBtn: { backgroundColor: Colors.successLight, borderRadius: Radius.lg, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.success },
  bulkApproveText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.success },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: Colors.text, marginBottom: 8 },
  emptyDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { marginTop: 20, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 14, ...Shadow.primary },
  emptyBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
