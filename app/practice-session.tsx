import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Animated, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { usePracticeStore } from '../store/practiceStore';
import { useUserStore } from '../store/userStore';
import { getQuestionsByTopic, getTopicById, getTargetById } from '../data/mockData';
import { QuestionCard } from '../components/QuestionCard';
import { ProgressBar } from '../components/ProgressBar';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { calcAllScores } from '../utils/scoring';
import { SessionMode } from '../data/types';

const { width: W } = Dimensions.get('window');
const SPEED_LIMIT = 60; // seconds per question in speed mode

export default function PracticeSession() {
  const { topicId, targetId, mode } = useLocalSearchParams<{
    topicId: string;
    targetId: string;
    mode: SessionMode;
  }>();

  const {
    session, startSession, submitAnswer, skipQuestion,
    nextQuestion, endSession, getCurrentQuestion,
  } = usePracticeStore();

  const { updateElo, recordSession, getTopicElo } = useUserStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timer, setTimer] = useState(SPEED_LIMIT);
  const [isFinished, setIsFinished] = useState(false);

  const explanationAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topic = getTopicById(topicId ?? '');
  const target = getTargetById(targetId ?? '');
  const isSpeedMode = mode === 'speed';

  // Initialize session
  useEffect(() => {
    const questions = getQuestionsByTopic(topicId ?? '');
    if (questions.length === 0) {
      Alert.alert('שגיאה', 'לא נמצאו שאלות לנושא זה');
      router.back();
      return;
    }

    startSession({
      targetId: targetId ?? '',
      topicId: topicId ?? '',
      mode: mode ?? 'practice',
      questions: questions.slice(0, 10),
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Speed mode timer
  useEffect(() => {
    if (!isSpeedMode || revealed) return;
    setTimer(SPEED_LIMIT);
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

    setRevealed(true);
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
    setSelectedId(null);
    setRevealed(false);
    setShowExplanation(false);
    explanationAnim.setValue(0);
    advanceOrEnd();
  };

  const advanceOrEnd = () => {
    const hasMore = nextQuestion();
    if (!hasMore) finishSession();
  };

  const finishSession = () => {
    const finished = endSession();
    if (!finished) return;
    const scores = calcAllScores(finished.answers);
    const correct = finished.answers.filter(a => a.isCorrect).length;
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

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>טוען שאלות...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const question = getCurrentQuestion();
  if (!question) return null;

  const progress = (session.currentIndex + 1) / session.questions.length;
  const correct = session.answers.filter(a => a.isCorrect).length;
  const timerColor = timer <= 10 ? Colors.danger : timer <= 20 ? Colors.warning : Colors.success;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleQuit} style={styles.quitBtn}>
          <Text style={styles.quitText}>✕</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTopic}>{topic?.name ?? 'תרגול'}</Text>
          <Text style={styles.headerProgress}>
            {session.currentIndex + 1} / {session.questions.length}
            {'  '}✅ {correct}
          </Text>
        </View>

        {isSpeedMode && (
          <View style={[styles.timerBadge, { borderColor: timerColor }]}>
            <Text style={[styles.timerText, { color: timerColor }]}>{timer}ש׳</Text>
          </View>
        )}
        {!isSpeedMode && <View style={{ width: 48 }} />}
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

        {/* Explanation panel */}
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
                selectedId === question.correctAnswer
                  ? [Colors.successLight, '#fff']
                  : [Colors.dangerLight, '#fff']
              }
              style={styles.explanationGrad}
            >
              <Text style={styles.explanationResult}>
                {selectedId === question.correctAnswer ? '✅ נכון!' : '❌ לא נכון'}
              </Text>
              <Text style={styles.explanationTitle}>הסבר:</Text>
              <Text style={styles.explanationText}>{question.explanation}</Text>
            </LinearGradient>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.actions}>
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
});
