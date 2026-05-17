import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ScrollView, TextInput, Platform, KeyboardAvoidingView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { useUserStore } from '../store/userStore';
import { TARGETS, TOPICS } from '../data/mockData';
import { Target } from '../data/types';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { DEFAULT_ELO } from '../utils/elo';

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};
const hapticSuccess = () => {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const completeOnboarding = useUserStore(s => s.completeOnboarding);

  const animateTo = (toValue: number) => {
    Animated.spring(progressAnim, { toValue, useNativeDriver: false, friction: 8 }).start();
  };

  const goNext = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setStep(1);
    animateTo(0.5);
  };

  const handleTargetSelect = (t: Target) => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTarget(t);
  };

  const handleFinish = () => {
    hapticSuccess();
    animateTo(1);
    const initialElos: Record<string, number> = {};
    TOPICS.forEach(t => { initialElos[t.id] = DEFAULT_ELO; });
    completeOnboarding(name || 'מתאמן', selectedTarget?.id ?? TARGETS[0].id, initialElos);
    router.replace('/(tabs)');
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {step === 0 && <StepWelcome name={name} setName={setName} onNext={goNext} />}
      {step === 1 && (
        <StepSelectTarget
          selected={selectedTarget}
          onSelect={handleTargetSelect}
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
  selected, onSelect, onFinish,
}: {
  selected: Target | null;
  onSelect: (t: Target) => void;
  onFinish: () => void;
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
        onPress={selected ? onFinish : undefined}
        disabled={!selected}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.primaryBtnGrad}>
          <Text style={styles.primaryBtnText}>כניסה לאפליקציה 🚀</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceTertiary,
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

  heroEmoji: { alignItems: 'center', marginBottom: 24 },
  heroEmojiText: { fontSize: 72 },

  h1: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 10,
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
});
