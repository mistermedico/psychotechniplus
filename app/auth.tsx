import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  ScrollView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { useAdminStore, ADMIN_EMAIL } from '../store/adminStore';
import { logUserAction } from '../utils/visitTracker';
import { useColors } from '../hooks/useColors';
import { useLayout } from '../hooks/useLayout';
import { ThemeColors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

type AuthMode = 'login' | 'register';
type FieldName = 'name' | 'email' | 'password' | 'confirm';

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
    wideContent: { maxWidth: 420, alignSelf: 'center', width: '100%' },

    // Ambient orbs
    orb: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      opacity: 0.10,
      pointerEvents: 'none',
    } as any,
    orbTop: {
      top: -60,
      right: -50,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 80,
    },
    orbBottom: {
      bottom: 80,
      left: -80,
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 80,
    },

    // Logo
    logoSection: { alignItems: 'center', paddingTop: 20, paddingBottom: 32 },
    logoOrb: {
      marginBottom: 18,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
      elevation: 16,
    },
    logoGrad: {
      width: 80,
      height: 80,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoEmoji: { fontSize: 40 },
    appName: {
      fontFamily: FontFamily.heading,
      fontSize: FontSize['3xl'],
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    logoSub: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    // Form card
    formCard: {
      backgroundColor: colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.borderGlow,
      borderRadius: Radius['3xl'],
      padding: 22,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 32,
      elevation: 16,
    },
    cardGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.primaryLighter,
    },

    // Tabs — pill-shaped switcher
    tabs: {
      flexDirection: 'row-reverse',
      backgroundColor: colors.surface,
      borderRadius: 999,
      padding: 4,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 999,
      minHeight: 44,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tabActive: {
      borderColor: colors.borderGlow,
    },
    tabText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.base,
      color: colors.textTertiary,
    },
    tabTextActive: {
      color: colors.primaryLight,
      fontFamily: FontFamily.semiBold,
    },

    // Form
    form: { gap: 14 },

    // Input wrapper to support left-border accent
    inputWrapper: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    inputWrapperFocused: {
      borderColor: colors.borderFocus,
    },
    inputRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
    },
    inputIcon: {
      paddingHorizontal: 14,
      fontSize: 18,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontFamily: FontFamily.regular,
      fontSize: FontSize.base,
      paddingHorizontal: 4,
      paddingVertical: 15,
      minHeight: 52,
      textAlign: 'right',
    },

    // Registration closed
    registrationClosedBox: {
      backgroundColor: colors.dangerLight,
      borderRadius: Radius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.dangerGlow,
      marginTop: 16,
    },
    registrationClosedTitle: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      color: colors.danger,
      textAlign: 'right',
      marginBottom: 8,
    },
    registrationClosedBody: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      textAlign: 'right',
      lineHeight: 20,
    },
    registrationClosedBtn: {
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: 12,
      alignItems: 'center',
    },
    registrationClosedBtnText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      color: colors.textSecondary,
    },

    // Error
    errorBox: {
      flexDirection: 'row-reverse',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.dangerLight,
      borderRadius: Radius.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.dangerGlow,
    },
    errorIcon: {
      fontSize: 16,
      lineHeight: 22,
    },
    errorText: {
      flex: 1,
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      color: colors.danger,
      textAlign: 'right',
      lineHeight: 22,
    },

    // Submit button
    submitBtn: {
      borderRadius: Radius.xl,
      overflow: 'hidden',
      marginTop: 6,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.55,
      shadowRadius: 20,
      elevation: 14,
    },
    submitGrad: {
      paddingVertical: 17,
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    submitShimmer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    submitText: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.lg,
      color: '#fff',
      letterSpacing: 0.3,
    },

    // Social proof
    socialProof: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.xs,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 12,
    },

    hint: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.xs,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 4,
    },

    // Legal
    legalRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 2,
    },
    legalText: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.xs,
      color: colors.textTertiary,
    },
    legalLink: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.xs,
      color: colors.primaryLight,
      textDecorationLine: 'underline',
    },

    // Email pending
    pendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    pendingCard: {
      width: '100%',
      backgroundColor: colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.borderGlow,
      borderRadius: Radius['3xl'],
      padding: 32,
      alignItems: 'center',
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.30,
      shadowRadius: 32,
      elevation: 16,
    },
    pendingGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.primaryLighter,
    },
    pendingEmoji: { fontSize: 68, marginBottom: 18 },
    pendingTitle: {
      fontFamily: FontFamily.heading,
      fontSize: FontSize['2xl'],
      color: colors.text,
      marginBottom: 14,
      textAlign: 'center',
    },
    pendingBody: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.base,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 26,
      marginBottom: 28,
    },
    pendingEmail: { fontFamily: FontFamily.bold, color: colors.primaryLight },
    pendingBtn: {
      width: '100%',
      borderRadius: Radius.xl,
      overflow: 'hidden',
      marginBottom: 14,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.50,
      shadowRadius: 16,
      elevation: 10,
    },
    pendingBtnGrad: { paddingVertical: 17, alignItems: 'center' },
    pendingBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
    pendingBack: { padding: 12 },
    pendingBackText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: colors.textTertiary },

    // Announcement
    announcementCritical: {
      backgroundColor: colors.dangerLight,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.dangerGlow,
    },
    announcementWarning: {
      backgroundColor: colors.warningLight,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.warningGlow,
    },
    announcementInfo: {
      backgroundColor: colors.primaryLighter,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.borderGlow,
    },
    announcementTextCritical: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      color: colors.danger,
      textAlign: 'right',
      lineHeight: 20,
    },
    announcementTextWarning: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      color: colors.warning,
      textAlign: 'right',
      lineHeight: 20,
    },
    announcementTextInfo: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      color: colors.primaryLight,
      textAlign: 'right',
      lineHeight: 20,
    },
  });
}

export default function AuthScreen() {
  const colors = useColors();
  const layout = useLayout();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [emailPending, setEmailPending] = useState(false);
  const [focusedField, setFocusedField] = useState<FieldName | null>(null);

  const initialize = useUserStore(s => s.initialize);
  const setIsAdmin = useAdminStore(s => s.setIsAdmin);
  const registrationOpen = useAdminStore(s => s.appConfig.registrationOpen);
  const announcementEnabled = useAdminStore(s => s.appConfig.announcementEnabled);
  const announcementText = useAdminStore(s => s.appConfig.announcementText);
  const announcementLevel = useAdminStore(s => s.appConfig.announcementLevel);

  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(32)).current;
  const submitScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError('');
    setEmailPending(false);
    setPassword('');
    setConfirmPassword('');
  };

  const translateError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return 'מייל או סיסמה שגויים';
    if (m.includes('email not confirmed')) return 'עליך לאשר את כתובת המייל לפני הכניסה. בדוק את תיבת הדואר שלך.';
    if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already registered')) return 'כתובת מייל זו כבר רשומה — עבור להתחברות';
    if (m.includes('password should be at least')) return 'הסיסמה חייבת להכיל לפחות 6 תווים';
    if (m.includes('unable to validate email address')) return 'כתובת מייל לא תקינה';
    if (m.includes('signup disabled')) return 'ההרשמה מושבתת זמנית';
    if (m.includes('email rate limit')) return 'יותר מדי ניסיונות — נסה שוב בעוד מספר דקות';
    return msg;
  };

  const handleSubmit = async () => {
    setError('');
    setEmailPending(false);

    if (!email.trim()) { setError('נא להזין כתובת מייל'); return; }
    if (!password) { setError('נא להזין סיסמה'); return; }

    if (mode === 'register') {
      if (password.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
      if (password !== confirmPassword) { setError('הסיסמאות אינן תואמות'); return; }
    }

    setLoading(true);

    if (mode === 'login') {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      setLoading(false);

      if (err) {
        setError(translateError(err.message));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (!data.session || !data.user) {
        setError('שגיאת התחברות — נסה שוב');
        return;
      }

      await initialize(data.user.id);
      if (data.user.email?.toLowerCase() === ADMIN_EMAIL) setIsAdmin(true);
      logUserAction({ screen: 'מסך כניסה', action: 'התחברות', userId: data.user.id, userName: 'משתמש', userEmail: email.trim(), isGuest: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { hasCompletedOnboarding } = useUserStore.getState();
      router.replace(hasCompletedOnboarding ? '/(tabs)' : '/onboarding');

    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { display_name: displayName.trim() || undefined },
        },
      });
      setLoading(false);

      if (err) {
        setError(translateError(err.message));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (!data.session) {
        setEmailPending(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      if (!data.user) {
        setError('שגיאת הרשמה — נסה שוב');
        return;
      }

      await initialize(data.user.id);
      if (data.user.email?.toLowerCase() === ADMIN_EMAIL) setIsAdmin(true);
      logUserAction({ screen: 'מסך הרשמה', action: 'הרשמה', userId: data.user.id, userName: displayName.trim() || 'משתמש', userEmail: email.trim(), isGuest: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/onboarding');
    }
  };

  if (emailPending) {
    return (
      <LinearGradient colors={colors.gradients.bg as unknown as [string, string, string]} style={{ flex: 1 }}>
        <SafeAreaView style={styles.pendingContainer} edges={['top', 'bottom']}>
          <Animated.View style={[
            styles.pendingCard,
            layout.isWide && { maxWidth: 420, alignSelf: 'center', width: '100%' },
            { opacity: fadeIn, transform: [{ translateY: slideUp }] },
          ]}>
            <View style={styles.pendingGlow} />
            <Text style={styles.pendingEmoji}>📧</Text>
            <Text style={styles.pendingTitle}>בדוק את המייל שלך</Text>
            <Text style={styles.pendingBody}>
              שלחנו לך קישור אישור ל-{'\n'}
              <Text style={styles.pendingEmail}>{email}</Text>
              {'\n\n'}לחץ על הקישור ואז חזור לכאן להתחברות.
            </Text>
            <Pressable
              onPress={() => { setEmailPending(false); setMode('login'); }}
              style={styles.pendingBtn}
            >
              <LinearGradient
                colors={colors.gradients.primary}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.pendingBtnGrad}
              >
                <Text style={styles.pendingBtnText}>עבור להתחברות ←</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={async () => {
                setResending(true);
                try {
                  const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
                  if (resendError) {
                    setEmailPending(false);
                    setMode('register');
                    setError(translateError(resendError.message));
                  } else {
                    Alert.alert('נשלח!', 'בדוק את תיבת הדואר שלך שוב.');
                  }
                } catch {
                  setEmailPending(false);
                  setMode('register');
                  setError('שגיאה בשליחה מחדש — נסה שוב');
                } finally {
                  setResending(false);
                }
              }}
              disabled={resending}
              accessibilityRole="button"
              accessibilityLabel="שלח שוב או שנה מייל"
              style={styles.pendingBack}
            >
              <Text style={styles.pendingBackText}>{resending ? 'שולח...' : 'שלח שוב / שנה מייל'}</Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const contentStyle = layout.isWide ? [styles.content, styles.wideContent] : styles.content;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.gradients.bg as unknown as [string, string, string]}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient glow orbs */}
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={contentStyle}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Announcement banner */}
            {announcementEnabled && announcementText ? (
              <View style={
                announcementLevel === 'critical' ? styles.announcementCritical
                : announcementLevel === 'warning' ? styles.announcementWarning
                : styles.announcementInfo
              }>
                <Text style={
                  announcementLevel === 'critical' ? styles.announcementTextCritical
                  : announcementLevel === 'warning' ? styles.announcementTextWarning
                  : styles.announcementTextInfo
                }>
                  {announcementLevel === 'critical' ? '🚨 ' : announcementLevel === 'warning' ? '⚠️ ' : 'ℹ️ '}{announcementText}
                </Text>
              </View>
            ) : null}

            {/* Logo / header */}
            <Animated.View style={[styles.logoSection, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
              <View style={styles.logoOrb}>
                <LinearGradient
                  colors={colors.gradients.primary}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.logoGrad}
                >
                  <Text style={styles.logoEmoji}>🧠</Text>
                </LinearGradient>
              </View>
              <Text style={styles.appName}>PsychoTechni+</Text>
              <Text style={styles.logoSub}>הכנה חכמה למבחן הפסיכוטכני</Text>
            </Animated.View>

            {/* Form card */}
            <Animated.View style={[styles.formCard, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
              <View style={styles.cardGlow} />

              {/* Mode tabs — pill switcher */}
              <View style={styles.tabs}>
                {(['login', 'register'] as AuthMode[]).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => switchMode(m)}
                    style={[styles.tab, mode === m && styles.tabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === m }}
                    accessibilityLabel={m === 'login' ? 'התחברות' : 'הרשמה'}
                  >
                    {mode === m && (
                      <LinearGradient
                        colors={[colors.primaryLighter, 'transparent']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                      {m === 'login' ? 'התחברות' : 'הרשמה'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Inputs */}
              {mode === 'register' && !registrationOpen ? (
                <View style={styles.registrationClosedBox}>
                  <Text style={styles.registrationClosedTitle}>🚫 הרשמות סגורות</Text>
                  <Text style={styles.registrationClosedBody}>
                    הרשמת משתמשים חדשים אינה זמינה כרגע. פנה למנהל האפליקציה.
                  </Text>
                  <Pressable onPress={() => switchMode('login')} style={styles.registrationClosedBtn}>
                    <Text style={styles.registrationClosedBtnText}>עבור להתחברות</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.form}>
                  {mode === 'register' && (
                    <View style={[
                      styles.inputWrapper,
                      focusedField === 'name' && styles.inputWrapperFocused,
                    ]}>
                      <View style={styles.inputRow}>
                        <TextInput
                          ref={nameRef}
                          style={styles.input}
                          value={displayName}
                          onChangeText={setDisplayName}
                          placeholder="שם מלא (אופציונלי)"
                          placeholderTextColor={colors.textTertiary}
                          textAlign="right"
                          autoCorrect={false}
                          autoCapitalize="words"
                          textContentType="name"
                          autoComplete="name"
                          returnKeyType="next"
                          onSubmitEditing={() => emailRef.current?.focus()}
                          onFocus={() => setFocusedField('name')}
                          onBlur={() => setFocusedField(null)}
                          accessibilityLabel="שם מלא"
                        />
                        <Text style={styles.inputIcon}>👤</Text>
                      </View>
                    </View>
                  )}

                  <View style={[
                    styles.inputWrapper,
                    focusedField === 'email' && styles.inputWrapperFocused,
                  ]}>
                    <View style={styles.inputRow}>
                      <TextInput
                        ref={emailRef}
                        style={styles.input}
                        value={email}
                        onChangeText={v => { setEmail(v); setError(''); }}
                        placeholder="כתובת מייל"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        textAlign="right"
                        textContentType="emailAddress"
                        autoComplete="email"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        accessibilityLabel="כתובת מייל"
                      />
                      <Text style={styles.inputIcon}>📧</Text>
                    </View>
                  </View>

                  <View style={[
                    styles.inputWrapper,
                    focusedField === 'password' && styles.inputWrapperFocused,
                  ]}>
                    <View style={styles.inputRow}>
                      <TextInput
                        ref={passwordRef}
                        style={styles.input}
                        value={password}
                        onChangeText={v => { setPassword(v); setError(''); }}
                        placeholder="סיסמה (מינימום 6 תווים)"
                        placeholderTextColor={colors.textTertiary}
                        secureTextEntry
                        textAlign="right"
                        onSubmitEditing={mode === 'login' ? handleSubmit : () => confirmRef.current?.focus()}
                        textContentType={mode === 'login' ? 'password' : 'newPassword'}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        returnKeyType={mode === 'login' ? 'go' : 'next'}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        accessibilityLabel="סיסמה"
                      />
                      <Text style={styles.inputIcon}>🔐</Text>
                    </View>
                  </View>

                  {mode === 'register' && (
                    <View style={[
                      styles.inputWrapper,
                      focusedField === 'confirm' && styles.inputWrapperFocused,
                    ]}>
                      <View style={styles.inputRow}>
                        <TextInput
                          ref={confirmRef}
                          style={styles.input}
                          value={confirmPassword}
                          onChangeText={v => { setConfirmPassword(v); setError(''); }}
                          placeholder="אימות סיסמה"
                          placeholderTextColor={colors.textTertiary}
                          secureTextEntry
                          textAlign="right"
                          onSubmitEditing={handleSubmit}
                          textContentType="newPassword"
                          autoComplete="new-password"
                          returnKeyType="go"
                          onFocus={() => setFocusedField('confirm')}
                          onBlur={() => setFocusedField(null)}
                          accessibilityLabel="אימות סיסמה"
                        />
                        <Text style={styles.inputIcon}>🔐</Text>
                      </View>
                    </View>
                  )}

                  {!!error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                      <Text style={styles.errorIcon}>❌</Text>
                    </View>
                  )}

                  <Animated.View style={{ transform: [{ scale: submitScale }] }}>
                    <Pressable
                      onPress={handleSubmit}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityLabel={mode === 'login' ? 'כניסה לחשבון' : 'יצירת חשבון'}
                      accessibilityState={{ disabled: loading }}
                      style={[styles.submitBtn, { opacity: loading ? 0.85 : 1 }]}
                      onPressIn={() =>
                        Animated.spring(submitScale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start()
                      }
                      onPressOut={() =>
                        Animated.spring(submitScale, { toValue: 1, useNativeDriver: true, friction: 8 }).start()
                      }
                    >
                      <LinearGradient
                        colors={colors.gradients.primary}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.submitGrad}
                      >
                        <View style={styles.submitShimmer} />
                        {loading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={styles.submitText}>{mode === 'login' ? 'כניסה ←' : 'יצירת חשבון ←'}</Text>
                        }
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>

                  <Text style={styles.socialProof}>מצטרפים ל-10,000+ מתאמנים</Text>

                  <Text style={styles.hint}>
                    {mode === 'login'
                      ? 'אין לך חשבון? לחץ על "הרשמה" למעלה'
                      : 'יש לך חשבון? לחץ על "התחברות" למעלה'}
                  </Text>
                </View>
              )}

              {/* Legal */}
              <View style={styles.legalRow}>
                <Text style={styles.legalText}>בהרשמה אתה מסכים ל</Text>
                <Pressable onPress={() => router.push('/terms')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.legalLink}>תנאי שימוש</Text>
                </Pressable>
                <Text style={styles.legalText}> ו</Text>
                <Pressable onPress={() => router.push('/privacy')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.legalLink}>מדיניות פרטיות</Text>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
