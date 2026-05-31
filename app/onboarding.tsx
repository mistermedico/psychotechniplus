import React, { useState, useRef, useMemo } from 'react';
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
import { useColors } from '../hooks/useColors';
import { useLayout } from '../hooks/useLayout';
import { ThemeColors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { useScreenVisit } from '../utils/visitTracker';

const haptic = (style: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(style);
const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

const TOTAL_STEPS = 2;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' },

    // Responsive centering wrapper
    centeringWrap: { flex: 1, alignItems: 'center' },
    innerWide: { flex: 1, width: '100%', maxWidth: 480 },

    // Ambient orbs
    orb: {
      position: 'absolute',
      borderRadius: 9999,
      opacity: 0.10,
      pointerEvents: 'none',
    } as any,
    orbA: {
      width: 300,
      height: 300,
      top: -80,
      right: -60,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 100,
    },
    orbB: {
      width: 220,
      height: 220,
      bottom: 120,
      left: -60,
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 80,
    },

    // Progress bar at top
    progressTrack: {
      height: 4,
      backgroundColor: colors.surface,
      marginHorizontal: 24,
      borderRadius: 2,
      marginBottom: 8,
      overflow: 'hidden',
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
    },

    // Step dots
    dotsRow: {
      flexDirection: 'row-reverse',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 24,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },

    stepContainer: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 24,
    },

    // Step 1 — Welcome
    heroSection: { alignItems: 'center', marginBottom: 32 },
    heroGradCircle: {
      width: 100,
      height: 100,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
      elevation: 16,
    },
    heroEmoji: { fontSize: 52 },
    h1: {
      fontFamily: FontFamily.heading,
      fontSize: FontSize['3xl'],
      color: colors.text,
      textAlign: 'right',
      marginBottom: 10,
    },
    subtitle: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.base,
      color: colors.textSecondary,
      textAlign: 'right',
      lineHeight: 24,
      marginBottom: 32,
    },

    // Name input
    inputContainer: { marginBottom: 28 },
    inputLabel: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      textAlign: 'right',
      marginBottom: 10,
    },
    inputWrapper: {
      borderRadius: Radius.xl,
      borderWidth: 2,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    inputWrapperFocused: {
      borderColor: colors.borderFocus,
    },
    inputRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
    },
    inputIcon: {
      paddingHorizontal: 16,
      fontSize: 20,
    },
    input: {
      flex: 1,
      backgroundColor: 'transparent',
      borderRadius: Radius.xl,
      paddingVertical: 16,
      paddingHorizontal: 4,
      fontFamily: FontFamily.regular,
      fontSize: FontSize.lg,
      color: colors.text,
    },

    motivationalNote: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      color: colors.textTertiary,
      textAlign: 'right',
      marginTop: 10,
    },

    // Step 2 — Target selection
    targetsScroll: { flex: 1, marginBottom: 16 },
    targetsGrid: { gap: 14, paddingBottom: 8 },

    targetOptionOuter: {
      borderRadius: Radius.xl,
      padding: 2,
    },
    targetOptionInner: {
      borderRadius: Radius['2xl'] - 2,
      padding: 18,
      overflow: 'hidden',
      ...Shadow.sm,
    },
    targetOptionInnerSelected: {
      ...Shadow.primary,
    },
    targetOptionIcon: { fontSize: 34, marginBottom: 10, textAlign: 'right' },
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

    // Primary button
    primaryBtn: {
      borderRadius: Radius.xl,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.55,
      shadowRadius: 20,
      elevation: 14,
    },
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
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 16,
    },
  });
}

export default function Onboarding() {
  useScreenVisit('אונבורדינג');
  const colors = useColors();
  const layout = useLayout();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

  const innerContent = (
    <>
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={i === step ? styles.dotActive : styles.dot} />
        ))}
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
          <LinearGradient
            colors={colors.gradients.primary}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 2 }]}
          />
        </Animated.View>
      </View>

      {step === 0 && (
        <StepWelcome
          name={name}
          setName={setName}
          onNext={goNext}
          colors={colors}
          styles={styles}
        />
      )}
      {step === 1 && (
        <StepSelectTarget
          selected={selectedTarget}
          onSelect={handleTargetSelect}
          onFinish={handleFinish}
          colors={colors}
          styles={styles}
        />
      )}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={colors.gradients.bg as unknown as [string, string, string]}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient orbs */}
      <View style={[styles.orb, styles.orbA]} />
      <View style={[styles.orb, styles.orbB]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {layout.isWide ? (
          <View style={styles.centeringWrap}>
            <View style={styles.innerWide}>
              {innerContent}
            </View>
          </View>
        ) : (
          innerContent
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Step 1: Welcome ─────────────────────────────────────────────────────────

function StepWelcome({
  name, setName, onNext, colors, styles,
}: {
  name: string;
  setName: (v: string) => void;
  onNext: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [focused, setFocused] = useState(false);
  const submitScale = useRef(new Animated.Value(1)).current;

  return (
    <KeyboardAvoidingView
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.heroSection}>
        <LinearGradient
          colors={colors.gradients.primary}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroGradCircle}
        >
          <Text style={styles.heroEmoji}>🧠</Text>
        </LinearGradient>
      </View>

      <Text style={styles.h1}>ברוך הבא!</Text>
      <Text style={styles.subtitle}>
        פלטפורמת ההכנה החכמה למבחן הפסיכוטכני.{'\n'}
        נתאים את התרגול אישית עבורך.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>מה שמך?</Text>
        <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="הכנס/י שם..."
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              textAlign="right"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={onNext}
              textContentType="name"
              autoComplete="name"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            <Text style={styles.inputIcon}>👤</Text>
          </View>
        </View>
        <Text style={styles.motivationalNote}>
          אפשר גם להשאיר ריק — נקרא לך "מתאמן" 😊
        </Text>
      </View>

      <Animated.View style={{ transform: [{ scale: submitScale }] }}>
        <Pressable
          style={styles.primaryBtn}
          onPress={onNext}
          onPressIn={() =>
            Animated.spring(submitScale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start()
          }
          onPressOut={() =>
            Animated.spring(submitScale, { toValue: 1, useNativeDriver: true, friction: 8 }).start()
          }
        >
          <LinearGradient colors={colors.gradients.primary} style={styles.primaryBtnGrad}>
            <Text style={styles.primaryBtnText}>בוא נתחיל ←</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <Text style={styles.legalNote}>בלחיצה על המשך אתה מאשר את תנאי השימוש</Text>
    </KeyboardAvoidingView>
  );
}

// ── Step 2: Select Target ────────────────────────────────────────────────────

function StepSelectTarget({
  selected, onSelect, onFinish, colors, styles,
}: {
  selected: Target | null;
  onSelect: (t: Target) => void;
  onFinish: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const activeTargets = TARGETS.filter(t => t.isActive && !t.comingSoon);
  const submitScale = useRef(new Animated.Value(1)).current;

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.h1}>מה המסלול שלך?</Text>
      <Text style={styles.subtitle}>נבנה לך תוכנית תרגול מותאמת אישית</Text>

      <ScrollView
        style={styles.targetsScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.targetsGrid}
      >
        {activeTargets.map(t => {
          const isSelected = selected?.id === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t)}
              style={({ pressed }) => [
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              {/* Gradient border wrapper when selected */}
              {isSelected ? (
                <LinearGradient
                  colors={t.gradientColors as [string, string]}
                  style={[styles.targetOptionOuter]}
                >
                  <View style={[styles.targetOptionInner, styles.targetOptionInnerSelected]}>
                    <LinearGradient
                      colors={t.gradientColors as [string, string]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.targetOptionIcon}>{t.icon}</Text>
                    <Text style={[styles.targetOptionName, { color: '#fff' }]}>
                      {t.name}
                    </Text>
                    <Text style={[styles.targetOptionDesc, { color: 'rgba(255,255,255,0.80)' }]} numberOfLines={2}>
                      {t.description}
                    </Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.targetOptionOuter, { backgroundColor: colors.border }]}>
                  <View style={styles.targetOptionInner}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.targetOptionIcon}>{t.icon}</Text>
                    <Text style={[styles.targetOptionName, { color: colors.text }]}>
                      {t.name}
                    </Text>
                    <Text style={[styles.targetOptionDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                      {t.description}
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Animated.View style={{ transform: [{ scale: submitScale }] }}>
        <Pressable
          style={[styles.primaryBtn, !selected && { opacity: 0.4 }]}
          onPress={selected ? onFinish : undefined}
          disabled={!selected}
          onPressIn={() => {
            if (selected)
              Animated.spring(submitScale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
          }}
          onPressOut={() =>
            Animated.spring(submitScale, { toValue: 1, useNativeDriver: true, friction: 8 }).start()
          }
        >
          <LinearGradient colors={colors.gradients.primary} style={styles.primaryBtnGrad}>
            <Text style={styles.primaryBtnText}>כניסה לאפליקציה 🚀</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}
