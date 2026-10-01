import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ScrollView, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { Target } from '../data/types';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

const haptic = (style: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(style);
const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
const DEFAULT_TARGET_ID = 'target_psychometric';

export default function Onboarding() {
  const [name, setName] = useState('');
  const { targets } = useAdminStore();
  const psychometricTarget =
    targets.find(t => t.id === DEFAULT_TARGET_ID && t.isActive !== false && !t.comingSoon) ??
    targets.find(t => t.id === DEFAULT_TARGET_ID);

  const completeOnboarding = useUserStore(s => s.completeOnboarding);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    const finalName = name.trim() || 'מתאמן';
    try {
      await completeOnboarding(finalName, psychometricTarget?.id ?? DEFAULT_TARGET_ID);
      hapticSuccess();
      router.replace('/(tabs)');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaveError('לא הצלחנו לשמור את הפרטים שלך. בדוק את החיבור לאינטרנט ונסה שוב.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={{ flex: 1 }}>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StepWelcome name={name} setName={setName} onFinish={handleFinish} saving={saving} error={saveError} />
    </SafeAreaView>
    </LinearGradient>
  );
}

// ── Step 1: Welcome ────────────────────────────────────────────────────────

function StepWelcome({
  name, setName, onFinish, saving = false, error = '',
}: { name: string; setName: (v: string) => void; onFinish: () => void; saving?: boolean; error?: string }) {
  return (
    <KeyboardAvoidingView
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['rgba(99,102,241,0.15)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.stepScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            onSubmitEditing={onFinish}
            textContentType="name"
            autoComplete="name"
            maxLength={80}
            accessibilityLabel="שם לתצוגה"
          />
        </View>

        {!!error && (
          <Text accessibilityRole="alert" style={styles.saveError}>⚠️ {error}</Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, (pressed || saving) && { opacity: 0.85 }]}
          onPress={onFinish}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={error ? 'נסה שוב' : 'המשך לאפליקציה'}
          accessibilityState={{ disabled: saving }}
        >
          <LinearGradient colors={Colors.gradients.primary} style={styles.primaryBtnGrad}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>{error ? 'נסה שוב ←' : 'בוא נתחיל ←'}</Text>}
          </LinearGradient>
        </Pressable>

        <View style={styles.legalRow}>
          <Text style={styles.legalNote}>בלחיצה על המשך אתה מאשר את </Text>
          <Pressable
            onPress={() => router.push('/terms')}
            accessibilityRole="link"
            accessibilityLabel="פתיחת תנאי השימוש"
            hitSlop={8}
          >
            <Text style={styles.legalLink}>תנאי השימוש</Text>
          </Pressable>
          <Text style={styles.legalNote}> ואת </Text>
          <Pressable
            onPress={() => router.push('/privacy')}
            accessibilityRole="link"
            accessibilityLabel="פתיחת מדיניות הפרטיות"
            hitSlop={8}
          >
            <Text style={styles.legalLink}>מדיניות הפרטיות</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Step 2: Select Target ──────────────────────────────────────────────────

function StepSelectTarget({
  selected, onSelect, onFinish, targets,
}: {
  selected: Target | null;
  onSelect: (t: Target) => void;
  onFinish: () => void;
  targets: Target[];
}) {
  const activeTargets = targets.filter(t => t.isActive !== false && !t.comingSoon);

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
  saveError: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 12,
    lineHeight: 20,
  },

  stepContainer: {
    flex: 1,
  },
  stepScrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    justifyContent: 'center',
  },

  heroEmoji: { alignItems: 'center', marginBottom: 18 },
  heroEmojiText: { fontSize: 60 },

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

  legalRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  legalNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  legalLink: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    textDecorationLine: 'underline',
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
