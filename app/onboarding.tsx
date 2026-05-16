import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
  ScrollView, TextInput, Platform, KeyboardAvoidingView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUserStore } from '../store/userStore';
import { TARGETS, TOPICS } from '../data/mockData';
import { Target } from '../data/types';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow, Spacing } from '../constants/theme';
import { DEFAULT_ELO } from '../utils/elo';

const { width: SCREEN_W } = Dimensions.get('window');

const PLACEMENT_QUESTIONS = [
  { q: 'מה תוצאת: 15 × 8 - 40?', options: ['80', '120', '100', '140'], correct: 0 },
  { q: 'מצא את החריג: 2, 4, 8, 15, 32', options: ['2', '4', '15', '32'], correct: 2 },
  { q: 'ספר : ספרייה = תמונה : ___', options: ['גלריה', 'צייר', 'מסגרת', 'קיר'], correct: 0 },
  { q: 'אם כל A הוא B, וכל B הוא C, האם כל A הוא C?', options: ['כן', 'לא', 'אולי', 'תלוי'], correct: 0 },
  { q: '60% מ-200 הוא?', options: ['100', '120', '140', '90'], correct: 1 },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [placementIndex, setPlacementIndex] = useState(0);
  const [placementScore, setPlacementScore] = useState(0);
  const [placementDone, setPlacementDone] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const completeOnboarding = useUserStore(s => s.completeOnboarding);

  const animateTo = (toValue: number) => {
    Animated.spring(progressAnim, { toValue, useNativeDriver: false, friction: 8 }).start();
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = step + 1;
    setStep(next);
    animateTo(next / 2);
  };

  const handleTargetSelect = (t: Target) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTarget(t);
  };

  const handlePlacementAnswer = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q = PLACEMENT_QUESTIONS[placementIndex];
    const correct = idx === q.correct;
    if (correct) setPlacementScore(s => s + 1);
    const next = placementIndex + 1;
    if (next >= PLACEMENT_QUESTIONS.length) {
      setPlacementDone(true);
    } else {
      setPlacementIndex(next);
    }
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Calculate initial ELO based on placement score
    const ratio = placementScore / PLACEMENT_QUESTIONS.length;
    const initialElo = Math.round(DEFAULT_ELO + (ratio - 0.5) * 400);

    const initialElos: Record<string, number> = {};
    TOPICS.forEach(t => {
      initialElos[t.id] = initialElo;
    });

    completeOnboarding(name || 'מתאמן', selectedTarget?.id ?? TARGETS[0].id, initialElos);
    router.replace('/(tabs)');
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {step === 0 && <StepWelcome name={name} setName={setName} onNext={goNext} />}
      {step === 1 && (
        <StepSelectTarget
          selected={selectedTarget}
          onSelect={handleTargetSelect}
          onNext={goNext}
        />
      )}
      {step === 2 && (
        <StepPlacement
          questions={PLACEMENT_QUESTIONS}
          index={placementIndex}
          score={placementScore}
          done={placementDone}
          onAnswer={handlePlacementAnswer}
          onFinish={handleFinish}
        />
      )}
    </SafeAreaView>
  );
}

// ── Step 1: Welcome ────────────────────────────────────────────────────────

function StepWelcome({
  name, setName, onNext,
}: { name: string; setName: (v: string) => void; onNext: () => void }) {
  return (
    <KeyboardAvoidingView
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[Colors.primaryLighter, '#fff']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroEmoji}>
        <Text style={styles.heroEmojiText}>🧠</Text>
      </View>
      <Text style={styles.h1}>ברוך הבא ל-PsychoTechniPlus</Text>
      <Text style={styles.subtitle}>
        פלטפורמת ההכנה החכמה למבחנים פסיכוטכניים ופסיכומטריים.{'\n'}
        נתאים את התרגול אישית עבורך.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>מה שמך?</Text>
        <TextInput
          style={styles.input}
          placeholder="הכנס/י שם..."
          placeholderTextColor={Colors.textTertiary}
          value={name}
          onChangeText={setName}
          textAlign="right"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={onNext}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        onPress={onNext}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.primaryBtnGrad}>
          <Text style={styles.primaryBtnText}>בוא נתחיל ←</Text>
        </LinearGradient>
      </Pressable>

      <Text style={styles.legalNote}>בלחיצה על המשך אתה מאשר את תנאי השימוש</Text>
    </KeyboardAvoidingView>
  );
}

// ── Step 2: Select Target ──────────────────────────────────────────────────

function StepSelectTarget({
  selected, onSelect, onNext,
}: {
  selected: Target | null;
  onSelect: (t: Target) => void;
  onNext: () => void;
}) {
  const activeTargets = TARGETS.filter(t => !t.comingSoon);

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.h1}>מה המסלול שלך?</Text>
      <Text style={styles.subtitle}>נבנה לך תוכנית תרגול מותאמת אישית</Text>

      <ScrollView
        style={styles.targetsScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.targetsGrid}
      >
        {activeTargets.map(t => (
          <Pressable
            key={t.id}
            onPress={() => onSelect(t)}
            style={({ pressed }) => [
              styles.targetOption,
              selected?.id === t.id && styles.targetOptionSelected,
              { borderColor: selected?.id === t.id ? t.color : Colors.border },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <LinearGradient
              colors={selected?.id === t.id ? t.gradientColors : ['#fff', '#fff']}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <Text style={styles.targetOptionIcon}>{t.icon}</Text>
            <Text
              style={[
                styles.targetOptionName,
                { color: selected?.id === t.id ? '#fff' : Colors.text },
              ]}
            >
              {t.name}
            </Text>
            <Text
              style={[
                styles.targetOptionDesc,
                { color: selected?.id === t.id ? 'rgba(255,255,255,0.8)' : Colors.textTertiary },
              ]}
              numberOfLines={2}
            >
              {t.description}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          !selected && { opacity: 0.4 },
          pressed && selected && { opacity: 0.85 },
        ]}
        onPress={selected ? onNext : undefined}
        disabled={!selected}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.primaryBtnGrad}>
          <Text style={styles.primaryBtnText}>המשך ←</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ── Step 3: Placement Test ─────────────────────────────────────────────────

function StepPlacement({
  questions, index, score, done, onAnswer, onFinish,
}: {
  questions: typeof PLACEMENT_QUESTIONS;
  index: number;
  score: number;
  done: boolean;
  onAnswer: (i: number) => void;
  onFinish: () => void;
}) {
  if (done) {
    const ratio = score / questions.length;
    const level = ratio >= 0.8 ? 'גבוהה' : ratio >= 0.6 ? 'בינונית' : 'מתחילה';
    const elo = Math.round(DEFAULT_ELO + (ratio - 0.5) * 400);
    return (
      <View style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 64 }}>🎯</Text>
        <Text style={[styles.h1, { marginTop: 16 }]}>נקודת ההתחלה שלך</Text>
        <Text style={styles.subtitle}>
          {score}/{questions.length} נכון · רמה {level}
        </Text>
        <View style={styles.eloCard}>
          <Text style={styles.eloValue}>{elo}</Text>
          <Text style={styles.eloLabel}>ELO התחלתי</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { width: '100%' }, pressed && { opacity: 0.85 }]}
          onPress={onFinish}
        >
          <LinearGradient colors={Colors.gradients.primary} style={styles.primaryBtnGrad}>
            <Text style={styles.primaryBtnText}>כניסה לאפליקציה 🚀</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  const q = questions[index];
  return (
    <View style={styles.stepContainer}>
      <View style={styles.placementHeader}>
        <Text style={styles.placementCounter}>{index + 1}/{questions.length}</Text>
        <Text style={styles.h2}>מבחן רמה קצר</Text>
        <Text style={styles.subtitle}>נגדיר את נקודת ההתחלה שלך</Text>
      </View>

      <View style={styles.placementQuestion}>
        <Text style={styles.placementQ}>{q.q}</Text>
      </View>

      <View style={styles.placementOptions}>
        {q.options.map((opt, i) => (
          <Pressable
            key={i}
            onPress={() => onAnswer(i)}
            style={({ pressed }) => [
              styles.placementOption,
              pressed && { transform: [{ scale: 0.97 }], backgroundColor: Colors.primaryLighter },
            ]}
          >
            <Text style={styles.placementOptionText}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceTertiary,
    marginHorizontal: 0,
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },

  heroEmoji: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroEmojiText: { fontSize: 72 },

  h1: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 10,
  },
  h2: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 24,
    marginBottom: 32,
  },

  inputContainer: { marginBottom: 24 },
  inputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 16,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },

  primaryBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  primaryBtnGrad: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
    letterSpacing: 0.5,
  },

  legalNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 16,
  },

  targetsScroll: { flex: 1, marginBottom: 16 },
  targetsGrid: { gap: 12, paddingBottom: 8 },
  targetOption: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: 16,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  targetOptionSelected: { ...Shadow.primary },
  targetOptionIcon: { fontSize: 32, marginBottom: 8, textAlign: 'right' },
  targetOptionName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    textAlign: 'right',
    marginBottom: 4,
  },
  targetOptionDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'right',
    lineHeight: 20,
  },

  placementHeader: { marginBottom: 24 },
  placementCounter: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginBottom: 4,
  },
  placementQuestion: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 24,
    marginBottom: 20,
    ...Shadow.md,
    borderRightWidth: 4,
    borderRightColor: Colors.primary,
  },
  placementQ: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 28,
  },
  placementOptions: { gap: 10 },
  placementOption: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 56,
    justifyContent: 'center',
    ...Shadow.sm,
  },
  placementOptionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },

  eloCard: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.xl,
    padding: 32,
    alignItems: 'center',
    marginVertical: 24,
    width: '100%',
    ...Shadow.md,
  },
  eloValue: {
    fontFamily: FontFamily.heading,
    fontSize: 56,
    color: Colors.primary,
  },
  eloLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
