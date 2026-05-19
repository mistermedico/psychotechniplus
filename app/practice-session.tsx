import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Animated, Alert, Dimensions, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { usePracticeStore } from '../store/practiceStore';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { useSettingsStore } from '../store/settingsStore';
import { getTopicById, getTargetById, TOPICS } from '../data/mockData';
import { fetchQuestions } from '../lib/db';
import { QuestionCard } from '../components/QuestionCard';
import { ProgressBar } from '../components/ProgressBar';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { calcAllScores } from '../utils/scoring';
import { SessionMode } from '../data/types';
import { generateSmartExamQuestions, GeneratedExamSection } from '../utils/smartExam';

const { width: W } = Dimensions.get('window');
const SPEED_LIMIT = 60; // seconds per question in speed mode

export default function PracticeSession() {
  const { topicId, targetId, mode, templateId, questionLimit } = useLocalSearchParams<{
    topicId: string;
    targetId: string;
    mode?: SessionMode;
    templateId?: string;
    questionLimit?: string;
  }>();

  const insets = useSafeAreaInsets();

  const {
    session, startSession, submitAnswer, skipQuestion,
    nextQuestion, endSession, getCurrentQuestion,
  } = usePracticeStore();

  const { updateElo, recordSession, getTopicElo, topicElos, userId, name: userName } = useUserStore();
  const { templates, questions: adminQuestions, practiceSettings, addSessionRecord } = useAdminStore();

  const {
    showTimerInPractice,
    autoAdvanceDelay,
    showExplanationAuto,
  } = useSettingsStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timer, setTimer] = useState(practiceSettings.speedModeSecondsPerQuestion);
  const [isFinished, setIsFinished] = useState(false);

  // Favorite & note features
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteTargetId, setNoteTargetId] = useState<string | null>(null);

  // Simulation state
  const [examSections, setExamSections] = useState<GeneratedExamSection[]>([]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [showRestScreen, setShowRestScreen] = useState(false);
  const [restCountdown, setRestCountdown] = useState(0);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSimulation = mode === 'simulation' && !!templateId;

  const explanationAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topic = getTopicById(topicId ?? '');
  const target = getTargetById(targetId ?? '');
  const isSpeedMode = mode === 'speed';

  // Whether to show the timer (speed mode OR user enabled showTimerInPractice)
  const showTimer = isSpeedMode || showTimerInPractice;

  // Initialize session — simulation mode or free practice
  useEffect(() => {
    let cancelled = false;

    if (isSimulation && templateId) {
      // SIMULATION MODE: generate questions from template
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        Alert.alert('שגיאה', 'תבנית המבחן לא נמצאה');
        router.back();
        return;
      }
      const userElos: Record<string, number> = {};
      Object.entries(topicElos).forEach(([tid, data]) => {
        userElos[tid] = (data as { elo: number }).elo ?? 1200;
      });
      const generated = generateSmartExamQuestions(
        template, adminQuestions.filter(q => q.validationStatus === 'validated'), userElos
      );
      if (generated.allQuestions.length === 0) {
        Alert.alert('שגיאה', 'לא נמצאו שאלות מתאימות למבחן זה. נסה לאמת שאלות קודם.');
        router.back();
        return;
      }
      setExamSections(generated.sections);
      // Start with first section's questions
      const firstSection = generated.sections[0];
      startSession({
        targetId: targetId ?? '',
        topicId: firstSection?.topicId ?? topicId ?? '',
        mode: 'simulation',
        questions: generated.allQuestions,
      });
      return () => { cancelled = true; };
    }

    // FREE PRACTICE MODE
    const limit = questionLimit ? parseInt(questionLimit) : 10;
    fetchQuestions({ topicId: topicId ?? '' }).then(questions => {
      if (cancelled) return;
      if (questions.length === 0) {
        Alert.alert('שגיאה', 'לא נמצאו שאלות לנושא זה');
        router.back();
        return;
      }
      startSession({
        targetId: targetId ?? '',
        topicId: topicId ?? '',
        mode: mode ?? 'practice',
        questions: questions.slice(0, limit),
      });
    });
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Speed mode timer (only in speed mode — showTimerInPractice shows timer but doesn't auto-skip)
  useEffect(() => {
    if (!isSpeedMode || revealed) return;
    setTimer(practiceSettings.speedModeSecondsPerQuestion);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session?.currentIndex, revealed]);

  // Non-speed timer display (counts up to SPEED_LIMIT for display only)
  const [practiceTimer, setPracticeTimer] = useState(0);
  useEffect(() => {
    if (isSpeedMode || revealed) return;
    setPracticeTimer(0);
    const id = setInterval(() => {
      setPracticeTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [session?.currentIndex, revealed, isSpeedMode]);

  // Auto-advance after answer is revealed
  useEffect(() => {
    if (!revealed || autoAdvanceDelay === 0) return;
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = setTimeout(() => {
      handleNext();
    }, autoAdvanceDelay * 1000);
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [revealed, autoAdvanceDelay]);

  const handleTimeUp = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!revealed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      handleSkip();
    }
  }, [revealed]);

  const handleSelect = (optId: string) => {
    if (revealed) return;
    Haptics.selectionAsync();
    setSelectedId(optId);
  };

  const handleConfirm = () => {
    if (!selectedId || revealed) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const { isCorrect, correctAnswerId } = submitAnswer(selectedId);

    Haptics.notificationAsync(
      isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );

    // Update ELO
    const question = getCurrentQuestion();
    if (question) {
      updateElo(question.topicId, question.psychometricStats.elo, isCorrect);
    }

    setLastAnswerCorrect(isCorrect);
    setRevealed(true);

    // Only auto-show explanation if setting is on
    if (showExplanationAuto) {
      setShowExplanation(true);
      Animated.spring(explanationAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleShowExplanation = () => {
    setShowExplanation(true);
    Animated.spring(explanationAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleSkip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    skipQuestion();
    advanceOrEnd();
  };

  const handleNext = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setSelectedId(null);
    setRevealed(false);
    setLastAnswerCorrect(false);
    setShowExplanation(false);
    explanationAnim.setValue(0);
    advanceOrEnd();
  };

  const advanceOrEnd = () => {
    const hasMore = nextQuestion();
    if (!hasMore) {
      // In simulation: check if there are more sections
      if (isSimulation && examSections.length > 1) {
        const nextSectionIdx = currentSectionIdx + 1;
        if (nextSectionIdx < examSections.length) {
          // Show rest screen between sections
          const template = templates.find(t => t.id === templateId);
          const restTime = template?.restTimeBetweenRules ?? 0;
          if (restTime > 0) {
            setShowRestScreen(true);
            setRestCountdown(restTime);
            let t = restTime;
            restTimerRef.current = setInterval(() => {
              t--;
              setRestCountdown(t);
              if (t <= 0) {
                if (restTimerRef.current) clearInterval(restTimerRef.current);
                setShowRestScreen(false);
                setCurrentSectionIdx(nextSectionIdx);
              }
            }, 1000);
          } else {
            setCurrentSectionIdx(nextSectionIdx);
          }
          return;
        }
      }
      finishSession();
    }
  };

  const finishSession = () => {
    const finished = endSession();
    if (!finished) return;
    const scores = calcAllScores(finished.answers);
    const correct = finished.answers.filter(a => a.isCorrect).length;

    // Save session record to Supabase and admin store
    const template = isSimulation ? templates.find(t => t.id === templateId) : undefined;
    const sessionRec = {
      id: finished.id,
      userId: userId ?? `anon_${Date.now()}`,
      userName: userName || undefined,
      targetId: targetId ?? '',
      topicId: topicId ?? '',
      mode: mode ?? 'practice',
      templateId: templateId ?? undefined,
      templateName: template?.name ?? undefined,
      totalQuestions: finished.answers.length,
      correctAnswers: correct,
      skippedQuestions: finished.answers.filter((a: any) => a.isSkipped).length,
      score: scores.score,
      timeSpentSeconds: finished.answers.reduce((s: number, a: any) => s + a.timeSpent, 0),
      startedAt: finished.startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      answers: finished.answers.map((a: any) => ({
        questionId: a.questionId,
        isCorrect: a.isCorrect,
        isSkipped: a.isSkipped ?? false,
        timeSpent: a.timeSpent,
        difficulty: a.questionDifficulty ?? 5,
      })),
    };
    addSessionRecord(sessionRec);

    recordSession(correct, finished.answers.filter(a => !a.isSkipped).length);

    router.replace({
      pathname: '/results',
      params: {
        sessionId: finished.id,
        topicId: topicId ?? '',
        targetId: targetId ?? '',
        score: scores.score,
        correct,
        total: finished.answers.length,
        timeSpent: finished.answers.reduce((s, a) => s + a.timeSpent, 0),
        percentile: scores.percentileRank,
        difficultyScore: scores.difficultyWeightedScore,
        speedScore: scores.speedAdjustedScore,
        stability: scores.stabilityScore,
      },
    });
  };

  const handleQuit = () => {
    Alert.alert('יציאה מהתרגול', 'האם לצאת ולשמור את ההתקדמות?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'יציאה',
        style: 'destructive',
        onPress: () => {
          endSession();
          router.back();
        },
      },
    ]);
  };

  const handleToggleFavorite = (questionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleOpenNote = (questionId: string) => {
    setNoteTargetId(questionId);
    setNoteText(notes[questionId] ?? '');
    setShowNoteModal(true);
  };

  const handleSaveNote = () => {
    if (!noteTargetId) return;
    if (noteText.trim()) {
      setNotes(prev => ({ ...prev, [noteTargetId]: noteText.trim() }));
    } else {
      setNotes(prev => { const n = { ...prev }; delete n[noteTargetId]; return n; });
    }
    setShowNoteModal(false);
    setNoteTargetId(null);
  };

  // NOTE MODAL
  const noteModal = (
    <Modal
      visible={showNoteModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowNoteModal(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.noteModal}>
          <Text style={styles.noteModalTitle}>📝 הערה לשאלה</Text>
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="כתוב הערה..."
            placeholderTextColor="#475569"
            multiline
            numberOfLines={4}
            textAlign="right"
            autoFocus
          />
          <View style={styles.noteModalActions}>
            <Pressable
              onPress={() => setShowNoteModal(false)}
              style={styles.noteCancelBtn}
            >
              <Text style={styles.noteCancelText}>ביטול</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveNote}
              style={styles.noteSaveBtn}
            >
              <Text style={styles.noteSaveText}>שמור</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // REST SCREEN between simulation sections
  if (showRestScreen) {
    const template = templates.find(t => t.id === templateId);
    const nextSection = examSections[currentSectionIdx + 1];
    const nextTopic = nextSection ? TOPICS.find(t => t.id === nextSection.topicId) : null;
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <LinearGradient colors={['#060912', '#1E1B4B', '#312E81']} style={styles.restScreen}>
          <Text style={styles.restIcon}>😴</Text>
          <Text style={styles.restTitle}>
            {template?.restScreenMessage ?? 'כל הכבוד! מנוחה קצרה לפני החלק הבא'}
          </Text>
          {nextTopic && (
            <Text style={styles.restNext}>
              החלק הבא: {nextTopic.icon} {nextTopic.name}
            </Text>
          )}
          <View style={styles.restCountdownWrap}>
            <Text style={styles.restCountdown}>{restCountdown}</Text>
            <Text style={styles.restCountdownLabel}>שניות</Text>
          </View>
          <Pressable
            onPress={() => {
              if (restTimerRef.current) clearInterval(restTimerRef.current);
              setShowRestScreen(false);
              setCurrentSectionIdx(prev => prev + 1);
            }}
            style={styles.restSkipBtn}
          >
            <Text style={styles.restSkipText}>דלג על המנוחה ←</Text>
          </Pressable>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>
            {isSimulation ? 'בונה מבחן חכם...' : 'טוען שאלות...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const question = getCurrentQuestion();
  if (!question) return null;

  const progress = (session.currentIndex + 1) / session.questions.length;
  const correct = session.answers.filter(a => a.isCorrect).length;

  // Timer display values
  const displayTimer = isSpeedMode ? timer : practiceTimer;
  const timerColor = isSpeedMode
    ? (timer <= 10 ? Colors.danger : timer <= 20 ? Colors.warning : Colors.success)
    : Colors.textSecondary;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {noteModal}
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleQuit} style={styles.quitBtn}>
          <Text style={styles.quitText}>✕</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTopic}>
            {isSimulation && examSections.length > 1
              ? `${examSections[currentSectionIdx] ? TOPICS.find(t => t.id === examSections[currentSectionIdx].topicId)?.name ?? 'תרגול' : 'תרגול'} (חלק ${currentSectionIdx + 1}/${examSections.length})`
              : (topic?.name ?? 'תרגול')}
          </Text>
          <Text style={styles.headerProgress}>
            {session.currentIndex + 1} / {session.questions.length}
            {'  '}✅ {correct}
          </Text>
        </View>

        {showTimer ? (
          <View style={[styles.timerBadge, { borderColor: timerColor }]}>
            <Text style={[styles.timerText, { color: timerColor }]}>
              {displayTimer}ש׳
            </Text>
          </View>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      {/* Progress */}
      <View style={styles.progressWrap}>
        <ProgressBar
          progress={progress}
          color={topic?.color ?? Colors.primary}
          height={5}
        />
      </View>

      {/* Question */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionCard
          question={question}
          selectedId={selectedId}
          revealed={revealed}
          onSelect={handleSelect}
        />

        {/* Favorite & note quick actions */}
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => handleOpenNote(question.id)}
            style={[styles.quickBtn, notes[question.id] ? styles.quickBtnActive : null]}
          >
            <Text style={styles.quickBtnIcon}>📝</Text>
            <Text style={[styles.quickBtnLabel, notes[question.id] ? { color: Colors.primary } : null]}>
              {notes[question.id] ? 'עריכת הערה' : 'הוסף הערה'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleToggleFavorite(question.id)}
            style={[styles.quickBtn, favorites.has(question.id) ? styles.quickBtnFav : null]}
          >
            <Text style={styles.quickBtnIcon}>{favorites.has(question.id) ? '⭐' : '☆'}</Text>
            <Text style={[styles.quickBtnLabel, favorites.has(question.id) ? { color: '#F59E0B' } : null]}>
              {favorites.has(question.id) ? 'מסומן' : 'מועדף'}
            </Text>
          </Pressable>
        </View>

        {/* Show existing note inline */}
        {notes[question.id] ? (
          <View style={styles.noteDisplay}>
            <Text style={styles.noteDisplayLabel}>📝 ההערה שלך:</Text>
            <Text style={styles.noteDisplayText}>{notes[question.id]}</Text>
          </View>
        ) : null}

        {/* Explanation panel — either auto or manual */}
        {revealed && !showExplanation && !showExplanationAuto && (
          <Pressable
            onPress={handleShowExplanation}
            style={({ pressed }) => [styles.showExplanationBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.showExplanationText}>הצג הסבר</Text>
          </Pressable>
        )}

        {showExplanation && (
          <Animated.View
            style={[
              styles.explanation,
              {
                opacity: explanationAnim,
                transform: [{ translateY: explanationAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              },
            ]}
          >
            <LinearGradient
              colors={
                lastAnswerCorrect
                  ? [Colors.successLight, '#fff']
                  : [Colors.dangerLight, '#fff']
              }
              style={styles.explanationGrad}
            >
              <Text style={styles.explanationResult}>
                {lastAnswerCorrect ? '✅ נכון!' : '❌ לא נכון'}
              </Text>
              <Text style={styles.explanationTitle}>הסבר:</Text>
              <Text style={styles.explanationText}>{question.explanation}</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Auto-advance countdown indicator */}
        {revealed && autoAdvanceDelay > 0 && (
          <View style={styles.autoAdvanceBanner}>
            <Text style={styles.autoAdvanceText}>
              ממשיך אוטומטית עוד {autoAdvanceDelay} שניות...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.actions, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
        {!revealed ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.skipText}>דלג</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={!selectedId}
              style={({ pressed }) => [
                styles.confirmBtn,
                !selectedId && styles.confirmBtnDisabled,
                pressed && selectedId && { opacity: 0.9 },
              ]}
            >
              <LinearGradient
                colors={selectedId ? Colors.gradients.primary : ['#CBD5E1', '#94A3B8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmBtnGrad}
              >
                <Text style={styles.confirmText}>אשר תשובה</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={Colors.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtnGrad}
            >
              <Text style={styles.nextText}>
                {session.currentIndex + 1 >= session.questions.length
                  ? 'סיום וראה תוצאות 🏁'
                  : 'שאלה הבאה ←'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textSecondary },

  // Rest screen between simulation sections
  restScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  restIcon: { fontSize: 64, marginBottom: 20 },
  restTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: '#fff', textAlign: 'center', lineHeight: 30, marginBottom: 12 },
  restNext: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: '#94A3B8', textAlign: 'center', marginBottom: 32 },
  restCountdownWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 2, borderColor: Colors.primary },
  restCountdown: { fontFamily: FontFamily.heading, fontSize: 42, color: Colors.primary },
  restCountdownLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8' },
  restSkipBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  restSkipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#fff' },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  quitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textSecondary },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTopic: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  headerProgress: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  timerBadge: {
    width: 48,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },

  progressWrap: { paddingHorizontal: 0 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 14 },

  explanation: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.md,
  },
  explanationGrad: { padding: 18 },
  explanationResult: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 10,
  },
  explanationTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 6,
  },
  explanationText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 24,
  },

  showExplanationBtn: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  showExplanationText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.primary,
  },

  autoAdvanceBanner: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  autoAdvanceText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  actions: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionsRow: { flexDirection: 'row-reverse', gap: 12 },
  skipBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  skipText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
  confirmBtn: { flex: 1, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  confirmBtnDisabled: { shadowOpacity: 0 },
  confirmBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  confirmText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  nextBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  nextBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  nextText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  quickActions: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLighter,
  },
  quickBtnFav: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  quickBtnIcon: { fontSize: 16 },
  quickBtnLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  noteDisplay: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  noteDisplayLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  noteDisplayText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 20,
  },

  // Note modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  noteModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    padding: 24,
    gap: 16,
  },
  noteModalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'right',
  },
  noteInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  noteModalActions: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  noteCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteCancelText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  noteSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  noteSaveText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#fff',
  },
});
