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
import { TARGETS } from '../data/mockData';
import { Target } from '../data/types';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

const haptic = (style: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(style);
const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const psychometricTarget = TARGETS.find(t => t.id === 'target_psychometric') ?? TARGETS[0];
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(psychometricTarget);

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
    const finalName = name.trim() || 'מתאמן';
    completeOnboarding(finalName, selectedTarget?.id ?? TARGETS[0].id);
    router.replace('/(tabs)');
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={{ flex: 1 }}>
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
    </LinearGradient>
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
        colors={['rgba(99,102,241,0.15)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroEmoji}>
        <Text style={styles.heroEmojiText}>🧠</Text>
      </View>
      <Text style={styles.h1}>ברוך הבא ל-PsychoTechniPlus</Text>
      <Text style={styles.subtitle}>
        פלטפורמת ההכנה החכמה למבחן הפסיכוטכני.{'\n'}
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
          returnKeyType="go"
          onSubmitEditing={onNext}
          textContentType="name"
          autoComplete="name"
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
  const activeTargets = TARGETS.filter(t => t.id === 'target_psychometric');

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
              colors={selected?.id === t.id ? t.gradientColors : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)']}
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
  safe: { flex: 1, backgroundColor: 'transparent' },

  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.lg,
    padding: 16,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
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
