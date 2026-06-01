import React, { useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { useScreenVisit } from '../utils/visitTracker';
import { useColors } from '../hooks/useColors';
import { useLayout } from '../hooks/useLayout';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

const { width: W } = Dimensions.get('window');

// ─── Static data (no Colors refs — colors applied inline) ───────────────────

const FEATURES = [
  { icon: '🎯', title: 'מותאם אישית',       desc: 'מנוע אדפטיבי מזהה את רמתך ומתאים שאלות בזמן אמת',           accentKey: 'primary'  as const },
  { icon: '📊', title: 'מעקב מתקדם',         desc: 'גרפים, רצפים ותגים — ראה בדיוק כיצד אתה משתפר',             accentKey: 'accent'   as const },
  { icon: '⚡', title: 'סימולציות מלאות',    desc: 'מבחנים מדויקים בתנאי לחץ עם ניתוח ביצועים',                  accentKey: 'warning'  as const },
  { icon: '🏆', title: 'מערכת הישגים',       desc: 'תגים, רמות ולוח מובילים — הפוך את הלמידה למשחק',            accentKey: 'success'  as const },
  { icon: '💡', title: 'הסברים מעמיקים',    desc: 'כל שאלה עם הסבר מפורט — למד מהטעויות',                      accentKey: 'cyan'     as const },
  { icon: '🎓', title: 'כל תחומי הפסיכוטכני', desc: 'חשיבה לוגית, כמותית, מילולית ומרחבית',                   accentKey: 'primary'  as const },
];

const STATS = [
  { value: '10,000+', label: 'משתמשים' },
  { value: '95%',     label: 'שיפור ממוצע' },
  { value: '3,000+',  label: 'שאלות' },
];

const HOW_STEPS = [
  { icon: '📋', title: 'הירשם',  desc: 'הרשמה מהירה ב-30 שניות' },
  { icon: '🧠', title: 'תרגל',   desc: 'שאלות מותאמות לרמתך' },
  { icon: '🚀', title: 'תצליח',  desc: 'הגע לציון הרצוי' },
];

const TESTIMONIALS = [
  {
    text: 'עלה לי 30 נקודות תוך חודש! האפליקציה מרגישה כמו מאמן אישי. ממליץ בחום!',
    author: 'דנה ג.',
    score: 'ציון 134',
    avatarColor: '#7C6FF7',
    avatarInitial: 'ד',
  },
  {
    text: 'הסימולציות חיקו בדיוק את המבחן האמיתי. הגעתי מוכן לחלוטין.',
    author: 'יואב מ.',
    score: 'ציון 141',
    avatarColor: '#C084FC',
    avatarInitial: 'י',
  },
];

// ─── Styles factory ──────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>, isWide: boolean) {
  const contentMaxWidth = isWide ? 700 : undefined;

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Ambient orbs
    orbPurple: {
      position: 'absolute', width: 380, height: 380,
      borderRadius: 190, backgroundColor: colors.primaryGlow,
      top: -100, left: -100, opacity: 0.18,
    },
    orbPink: {
      position: 'absolute', width: 300, height: 300,
      borderRadius: 150, backgroundColor: colors.accentGlow,
      top: 240, right: -120, opacity: 0.12,
    },
    orbCyan: {
      position: 'absolute', width: 240, height: 240,
      borderRadius: 120, backgroundColor: colors.cyanGlow,
      bottom: 320, left: -80, opacity: 0.07,
    },

    // ── Nav Bar ──────────────────────────────────────────────────────────────
    navBar: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background + 'D8',
    },
    navAppName: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      color: colors.text,
      letterSpacing: -0.3,
    },
    navLogin: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: Radius.full,
      backgroundColor: colors.primaryLighter,
      borderWidth: 1,
      borderColor: colors.borderGlow,
    },
    navLoginText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      color: colors.primaryLight,
    },

    // ── Scroll / content wrapper ─────────────────────────────────────────────
    scroll: { paddingBottom: 56 },
    contentWrap: {
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      width: '100%',
    },

    // ── Hero ─────────────────────────────────────────────────────────────────
    hero: {
      alignItems: 'center',
      paddingTop: 44,
      paddingBottom: 36,
      paddingHorizontal: 24,
    },
    heroBadgeWrap: { marginBottom: 28, borderRadius: Radius.full, overflow: 'hidden' },
    heroBadgeGrad: {
      paddingHorizontal: 20, paddingVertical: 9,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: colors.borderGlow,
    },
    heroBadgeText: {
      fontFamily: FontFamily.medium, fontSize: FontSize.xs,
      color: colors.primaryLight, letterSpacing: 0.5,
    },

    logoWrap: {
      marginBottom: 24, position: 'relative',
      alignItems: 'center', justifyContent: 'center',
    },
    logoGrad: {
      width: 100, height: 100, borderRadius: 30,
      alignItems: 'center', justifyContent: 'center',
      ...Shadow.primary,
    },
    logoEmoji: { fontSize: 50 },
    logoGlow: {
      position: 'absolute', width: 150, height: 150, borderRadius: 75,
      backgroundColor: colors.primaryGlow, opacity: 0.20,
    },

    // Floating geometric shapes
    floatShape1: {
      position: 'absolute', width: 52, height: 52, borderRadius: 14,
      backgroundColor: colors.primaryLighter,
      borderWidth: 1, borderColor: colors.borderGlow,
      top: 20, right: -20, transform: [{ rotate: '18deg' }],
    },
    floatShape2: {
      position: 'absolute', width: 34, height: 34, borderRadius: 17,
      backgroundColor: colors.accentLight,
      borderWidth: 1, borderColor: colors.accentGlow,
      top: 10, left: -24,
    },
    floatShape3: {
      position: 'absolute', width: 22, height: 22, borderRadius: 6,
      backgroundColor: colors.cyanLight,
      borderWidth: 1, borderColor: colors.cyanGlow,
      bottom: 0, right: -36, transform: [{ rotate: '-12deg' }],
    },

    appName: {
      fontFamily: FontFamily.heading, fontSize: 40, color: colors.text,
      textAlign: 'center', letterSpacing: -1.2,
      marginBottom: 12,
    },
    tagline: {
      fontFamily: FontFamily.regular, fontSize: FontSize.lg,
      color: colors.textSecondary, textAlign: 'center',
      lineHeight: 26, maxWidth: 300,
      marginBottom: 8,
    },
    subTagline: {
      fontFamily: FontFamily.medium, fontSize: FontSize.xs,
      color: colors.textTertiary, textAlign: 'center',
      letterSpacing: 0.4, marginBottom: 32,
    },

    // CTA buttons
    ctaPrimaryWrap: { width: '100%', marginBottom: 14, position: 'relative' },
    ctaPrimary: { borderRadius: Radius.xl, overflow: 'hidden' },
    ctaPrimaryGrad: {
      paddingVertical: 18, paddingHorizontal: 24,
      alignItems: 'center', justifyContent: 'center',
    },
    ctaShimmer: {
      position: 'absolute',
      top: 0, bottom: 0,
      left: '40%', width: 60,
      backgroundColor: 'rgba(255,255,255,0.12)',
      transform: [{ skewX: '-20deg' }],
    },
    ctaPrimaryText: {
      fontFamily: FontFamily.bold, fontSize: FontSize.base,
      color: '#fff', letterSpacing: 0.2,
    },
    ctaGlow: {
      position: 'absolute', bottom: -12, left: '10%', right: '10%', height: 30,
      backgroundColor: colors.primaryGlow, borderRadius: 20, opacity: 0.40,
    },
    ctaSecondary: {
      paddingVertical: 14, paddingHorizontal: 24,
      borderRadius: Radius.xl, alignItems: 'center',
      width: '100%',
      borderWidth: 1.5, borderColor: colors.border,
    },
    ctaSecondaryText: {
      fontFamily: FontFamily.medium, fontSize: FontSize.base,
      color: colors.textSecondary,
    },

    // ── Stats ─────────────────────────────────────────────────────────────────
    statsCard: {
      flexDirection: 'row-reverse',
      backgroundColor: colors.surfaceCard,
      marginHorizontal: 20, borderRadius: Radius.xl, paddingVertical: 22, paddingHorizontal: 10,
      borderWidth: 1, borderColor: colors.border,
      marginBottom: 40,
      ...Shadow.md,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statValue: {
      fontFamily: FontFamily.bold, fontSize: 26,
      color: colors.primaryLight,
    },
    statLabel: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: colors.textTertiary, marginTop: 2, textAlign: 'center',
    },
    statDivider: {
      width: 1, backgroundColor: colors.border,
      marginVertical: 6, alignSelf: 'stretch',
    },

    // ── Section header reusable ───────────────────────────────────────────────
    sectionHeader: { marginBottom: 20, alignItems: 'flex-end' },
    sectionTag: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primaryLighter,
      borderRadius: Radius.full,
      paddingHorizontal: 14, paddingVertical: 6,
      borderWidth: 1, borderColor: colors.borderGlow,
      marginBottom: 8,
    },
    sectionTagText: {
      fontFamily: FontFamily.medium, fontSize: 11,
      color: colors.primaryLight, letterSpacing: 0.5,
    },
    sectionTitle: {
      fontFamily: FontFamily.bold, fontSize: FontSize['2xl'],
      color: colors.text, textAlign: 'right', lineHeight: 32,
    },

    // ── How It Works ─────────────────────────────────────────────────────────
    howSection: { paddingHorizontal: 20, marginBottom: 40 },
    howSteps: { flexDirection: 'row-reverse', gap: 8, alignItems: 'stretch' },
    howStep: {
      flex: 1,
      backgroundColor: colors.surfaceCard,
      borderRadius: Radius.xl, padding: 14,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'flex-end',
    },
    howIconWrap: {
      width: 48, height: 48, borderRadius: 15,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 10,
    },
    howIcon: { fontSize: 22 },
    howStepNum: {
      fontFamily: FontFamily.regular, fontSize: 10,
      color: colors.primaryLight, letterSpacing: 0.5,
      marginBottom: 2, textAlign: 'right',
      opacity: 0.8,
    },
    howStepTitle: {
      fontFamily: FontFamily.bold, fontSize: FontSize.sm,
      color: colors.text, textAlign: 'right', marginBottom: 4,
    },
    howStepDesc: {
      fontFamily: FontFamily.regular, fontSize: 10,
      color: colors.textSecondary, textAlign: 'right', lineHeight: 14,
    },
    howArrow: {
      alignSelf: 'center',
      paddingTop: 24,
    },
    howArrowText: {
      fontSize: 16, color: colors.textTertiary,
    },

    // ── Features ─────────────────────────────────────────────────────────────
    featuresSection: { paddingHorizontal: 20, marginBottom: 40 },
    featuresGrid: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 12,
    },
    featureCard: {
      width: isWide ? '46%' : (W - 52) / 2,
      backgroundColor: colors.surfaceCard,
      borderRadius: Radius.xl,
      borderWidth: 1, borderColor: colors.border,
      overflow: 'hidden',
      flexDirection: 'row-reverse',
      alignItems: 'flex-start',
      padding: 14,
      gap: 10,
    },
    featureAccentBar: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: 2,
    },
    featureContent: { flex: 1, alignItems: 'flex-end' },
    featureIconCircle: {
      width: 42, height: 42, borderRadius: 21,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 10, flexShrink: 0,
    },
    featureIcon: { fontSize: 20 },
    featureTitle: {
      fontFamily: FontFamily.semiBold ?? FontFamily.bold,
      fontSize: FontSize.sm,
      color: colors.text, textAlign: 'right', marginBottom: 5,
    },
    featureDesc: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: colors.textSecondary, textAlign: 'right', lineHeight: 16,
    },

    // ── Testimonials ─────────────────────────────────────────────────────────
    testimonialsSection: { marginBottom: 40 },
    testimonialsRow: { paddingHorizontal: 20, gap: 14, flexDirection: 'row-reverse' },
    testimonialCard: {
      width: Math.min(W * 0.80, 340),
      borderRadius: Radius.xl,
      overflow: 'hidden',
      borderWidth: 1, borderColor: colors.borderGlow,
      backgroundColor: colors.surfaceCard,
    },
    testimonialGrad: { padding: 22 },
    testimonialQuoteMark: {
      fontFamily: FontFamily.bold, fontSize: 52,
      color: colors.primaryLight, lineHeight: 44,
      textAlign: 'right', marginBottom: 6, opacity: 0.45,
    },
    testimonialStars: {
      flexDirection: 'row-reverse',
      marginBottom: 12,
    },
    testimonialStar: { fontSize: 15, color: '#FBBF24', marginHorizontal: 1 },
    testimonialText: {
      fontFamily: FontFamily.regular, fontSize: FontSize.sm,
      color: colors.text, textAlign: 'right', lineHeight: 22,
      marginBottom: 16,
    },
    testimonialFooter: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
    },
    testimonialAvatar: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
    },
    testimonialAvatarText: {
      fontFamily: FontFamily.bold, fontSize: 16, color: '#fff',
    },
    testimonialAuthorBlock: { alignItems: 'flex-end' },
    testimonialAuthor: {
      fontFamily: FontFamily.bold, fontSize: FontSize.sm,
      color: colors.text, textAlign: 'right',
    },
    testimonialScore: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: colors.primaryLight, textAlign: 'right',
    },

    // ── Pricing ───────────────────────────────────────────────────────────────
    pricingSection: { paddingHorizontal: 20, marginBottom: 40 },
    pricingRow: { flexDirection: 'row-reverse', gap: 12 },
    pricingCard: {
      flex: 1,
      backgroundColor: colors.surfaceCard,
      borderRadius: Radius.xl,
      overflow: 'hidden',
      borderWidth: 1, borderColor: colors.border,
    },
    pricingCardPremium: {
      borderColor: colors.borderGlow,
      ...Shadow.primary,
    },
    pricingHeader: {
      padding: 16, alignItems: 'flex-end',
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    pricingPlanName: {
      fontFamily: FontFamily.bold, fontSize: FontSize.base,
      color: colors.text, textAlign: 'right',
    },
    pricingPrice: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: colors.textTertiary, textAlign: 'right', marginTop: 2,
    },
    pricingPremiumHeader: {
      padding: 16, alignItems: 'flex-end',
    },
    pricingPremiumName: {
      fontFamily: FontFamily.bold, fontSize: FontSize.base,
      color: '#fff', textAlign: 'right',
    },
    pricingPremiumPrice: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: 'rgba(255,255,255,0.80)', textAlign: 'right', marginTop: 2,
    },
    pricingFeatures: { padding: 14, gap: 8, alignItems: 'flex-end' },
    pricingFeatureRow: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
    pricingFeatureDot: {
      fontFamily: FontFamily.bold, fontSize: FontSize.sm,
      color: colors.textTertiary, width: 14, textAlign: 'center',
    },
    pricingFeatureText: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: colors.textSecondary, textAlign: 'right',
    },

    // ── Final CTA Banner ──────────────────────────────────────────────────────
    finalCtaSection: { paddingHorizontal: 20, marginBottom: 32 },
    finalCtaBanner: {
      borderRadius: Radius['2xl'], padding: 32,
      borderWidth: 1, borderColor: colors.borderGlow,
      alignItems: 'center', overflow: 'hidden',
    },
    finalCtaGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(124,111,247,0.04)',
    },
    finalCtaTitle: {
      fontFamily: FontFamily.heading, fontSize: FontSize['2xl'],
      color: colors.text, textAlign: 'center', marginBottom: 10,
    },
    finalCtaSub: {
      fontFamily: FontFamily.regular, fontSize: FontSize.sm,
      color: colors.textSecondary, textAlign: 'center',
      lineHeight: 20, marginBottom: 26, maxWidth: 280,
    },
    finalCtaBtn: { borderRadius: Radius.xl, overflow: 'hidden' },
    finalCtaBtnGrad: {
      paddingVertical: 17, paddingHorizontal: 36,
      alignItems: 'center',
    },
    finalCtaBtnShimmer: {
      position: 'absolute',
      top: 0, bottom: 0,
      left: '38%', width: 55,
      backgroundColor: 'rgba(255,255,255,0.13)',
      transform: [{ skewX: '-20deg' }],
    },
    finalCtaBtnText: {
      fontFamily: FontFamily.bold, fontSize: FontSize.lg,
      color: '#fff', letterSpacing: 0.2,
    },

    // ── Footer ───────────────────────────────────────────────────────────────
    footerWrap: {
      marginHorizontal: 20,
      borderRadius: Radius.xl,
      overflow: 'hidden',
      marginBottom: 8,
    },
    footerGrad: {
      paddingVertical: 20, paddingHorizontal: 24,
      alignItems: 'center', gap: 6,
    },
    footerVersion: {
      fontFamily: FontFamily.regular, fontSize: 11,
      color: colors.textTertiary, letterSpacing: 0.3,
    },
    footerText: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: colors.textTertiary, textAlign: 'center', lineHeight: 18,
    },
    footerLink: { color: colors.primaryLight, fontFamily: FontFamily.medium },
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LandingScreen() {
  useScreenVisit('דף נחיתה');
  const colors = useColors();
  const layout = useLayout();
  const styles = useMemo(() => makeStyles(colors, layout.isWide), [colors, layout.isWide]);

  // Animation refs
  const navOpacity    = useRef(new Animated.Value(0)).current;
  const heroOpacity   = useRef(new Animated.Value(0)).current;
  const heroSlide     = useRef(new Animated.Value(28)).current;
  const heroScale     = useRef(new Animated.Value(0.92)).current;
  const statsOpacity  = useRef(new Animated.Value(0)).current;
  const statsSlide    = useRef(new Animated.Value(20)).current;
  const howOpacity    = useRef(new Animated.Value(0)).current;
  const howSlide      = useRef(new Animated.Value(20)).current;
  const featOpacity   = useRef(new Animated.Value(0)).current;
  const featSlide     = useRef(new Animated.Value(20)).current;
  const testOpacity   = useRef(new Animated.Value(0)).current;
  const testSlide     = useRef(new Animated.Value(20)).current;
  const priceOpacity  = useRef(new Animated.Value(0)).current;
  const priceSlide    = useRef(new Animated.Value(20)).current;
  const ctaOpacity    = useRef(new Animated.Value(0)).current;
  const ctaSlide      = useRef(new Animated.Value(16)).current;
  const ctaPressScale = useRef(new Animated.Value(1)).current;

  // Floating shapes animation
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance sequence
    Animated.sequence([
      Animated.timing(navOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.spring(heroSlide,   { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
        Animated.spring(heroScale,   { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(statsOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(statsSlide,   { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(howOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(howSlide,   { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(featOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(featSlide,   { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(testOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.spring(testSlide,   { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(priceOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.spring(priceSlide,   { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(ctaSlide,   { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
    ]).start();

    // Gentle float loop for geometric shapes
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, []); // eslint-disable-line

  const floatY  = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const floatY2 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0,  6] });

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/auth');
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/auth');
  };

  const onCtaPressIn = () => {
    Animated.spring(ctaPressScale, { toValue: 0.96, friction: 10, tension: 120, useNativeDriver: true }).start();
  };
  const onCtaPressOut = () => {
    Animated.spring(ctaPressScale, { toValue: 1, friction: 10, tension: 120, useNativeDriver: true }).start();
  };

  // Resolve accent color for a feature card
  const resolveAccent = (key: typeof FEATURES[0]['accentKey']) => {
    const map = {
      primary: colors.primary,
      accent:  colors.accent,
      warning: colors.warning,
      success: colors.success,
      cyan:    colors.cyan,
    };
    return map[key];
  };

  return (
    <View style={styles.root}>
      {/* Ambient orbs */}
      <View style={styles.orbPurple} />
      <View style={styles.orbPink} />
      <View style={styles.orbCyan} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* ─── Nav Bar ─── */}
        <Animated.View style={[styles.navBar, { opacity: navOpacity }]}>
          <Pressable onPress={handleLogin} style={styles.navLogin}>
            <Text style={styles.navLoginText}>כניסה</Text>
          </Pressable>
          <Text style={styles.navAppName}>PsychoTechniPlus</Text>
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.contentWrap}>

            {/* ─── Hero ─── */}
            <Animated.View style={[styles.hero, {
              opacity: heroOpacity,
              transform: [{ translateY: heroSlide }, { scale: heroScale }],
            }]}>
              {/* Badge */}
              <View style={styles.heroBadgeWrap}>
                <LinearGradient
                  colors={[colors.primaryLighter, colors.accentLight]}
                  style={styles.heroBadgeGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.heroBadgeText}>🏆 הכנה לפסיכוטכני</Text>
                </LinearGradient>
              </View>

              {/* Logo with floating geometric shapes */}
              <View style={styles.logoWrap}>
                {/* Floating shapes */}
                <Animated.View style={[styles.floatShape1, { transform: [{ translateY: floatY }, { rotate: '18deg' }] }]} />
                <Animated.View style={[styles.floatShape2, { transform: [{ translateY: floatY2 }] }]} />
                <Animated.View style={[styles.floatShape3, { transform: [{ translateY: floatY }, { rotate: '-12deg' }] }]} />

                <LinearGradient
                  colors={colors.gradients.primary}
                  style={styles.logoGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.logoEmoji}>🧠</Text>
                </LinearGradient>
                <View style={styles.logoGlow} />
              </View>

              <Text style={styles.appName}>פסיכוטכניPlus</Text>
              <Text style={styles.tagline}>הדרך החכמה ביותר להגיע לציון שרצית</Text>
              <Text style={styles.subTagline}>מנוע אדפטיבי · תרגול חכם · סימולציות מלאות</Text>

              {/* Primary CTA */}
              <Animated.View style={[styles.ctaPrimaryWrap, { transform: [{ scale: ctaPressScale }] }]}>
                <Pressable
                  onPress={handleStart}
                  onPressIn={onCtaPressIn}
                  onPressOut={onCtaPressOut}
                  style={styles.ctaPrimary}
                >
                  <LinearGradient
                    colors={colors.gradients.primary}
                    style={styles.ctaPrimaryGrad}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.ctaPrimaryText}>התחל בחינם — ללא כרטיס אשראי ←</Text>
                    {/* Shimmer overlay */}
                    <View style={styles.ctaShimmer} />
                  </LinearGradient>
                </Pressable>
                <View style={styles.ctaGlow} />
              </Animated.View>

              {/* Secondary CTA */}
              <Pressable onPress={handleLogin} style={styles.ctaSecondary}>
                <Text style={styles.ctaSecondaryText}>יש לי חשבון — כניסה</Text>
              </Pressable>
            </Animated.View>

            {/* ─── Social Proof Stats ─── */}
            <Animated.View style={[styles.statsCard, {
              opacity: statsOpacity,
              transform: [{ translateY: statsSlide }],
            }]}>
              {STATS.map((s, i) => (
                <React.Fragment key={s.label}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primaryLight }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                  {i < STATS.length - 1 && <View style={styles.statDivider} />}
                </React.Fragment>
              ))}
            </Animated.View>

            {/* ─── How It Works ─── */}
            <Animated.View style={[styles.howSection, {
              opacity: howOpacity,
              transform: [{ translateY: howSlide }],
            }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTag}>
                  <Text style={styles.sectionTagText}>איך זה עובד</Text>
                </View>
                <Text style={styles.sectionTitle}>3 צעדים פשוטים</Text>
              </View>
              <View style={styles.howSteps}>
                {HOW_STEPS.map((step, i) => (
                  <React.Fragment key={step.title}>
                    <View style={styles.howStep}>
                      <LinearGradient
                        colors={[colors.primaryLighter, colors.accentLight]}
                        style={styles.howIconWrap}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.howIcon}>{step.icon}</Text>
                      </LinearGradient>
                      <Text style={styles.howStepNum}>שלב {i + 1}</Text>
                      <Text style={styles.howStepTitle}>{step.title}</Text>
                      <Text style={styles.howStepDesc}>{step.desc}</Text>
                    </View>
                    {i < HOW_STEPS.length - 1 && (
                      <View style={styles.howArrow}>
                        <Text style={styles.howArrowText}>←</Text>
                      </View>
                    )}
                  </React.Fragment>
                ))}
              </View>
            </Animated.View>

            {/* ─── Features Grid ─── */}
            <Animated.View style={[styles.featuresSection, {
              opacity: featOpacity,
              transform: [{ translateY: featSlide }],
            }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTag}>
                  <Text style={styles.sectionTagText}>מה תקבל</Text>
                </View>
                <Text style={styles.sectionTitle}>כל מה שצריך{'\n'}כדי להצליח</Text>
              </View>
              <View style={styles.featuresGrid}>
                {FEATURES.map((f) => {
                  const accent = resolveAccent(f.accentKey);
                  return (
                    <View key={f.title} style={styles.featureCard}>
                      {/* Gradient left-border accent */}
                      <View style={[styles.featureAccentBar, { backgroundColor: accent }]} />
                      <View style={styles.featureContent}>
                        {/* Icon in a gradient circle */}
                        <LinearGradient
                          colors={[accent + '30', accent + '12']}
                          style={styles.featureIconCircle}
                        >
                          <Text style={styles.featureIcon}>{f.icon}</Text>
                        </LinearGradient>
                        <Text style={styles.featureTitle}>{f.title}</Text>
                        <Text style={styles.featureDesc}>{f.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>

            {/* ─── Testimonials ─── */}
            <Animated.View style={[styles.testimonialsSection, {
              opacity: testOpacity,
              transform: [{ translateY: testSlide }],
            }]}>
              <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
                <View style={styles.sectionTag}>
                  <Text style={styles.sectionTagText}>מה אומרים עלינו</Text>
                </View>
                <Text style={styles.sectionTitle}>סטודנטים שהצליחו</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.testimonialsRow}
                decelerationRate="fast"
              >
                {TESTIMONIALS.map((t, i) => (
                  <View key={i} style={styles.testimonialCard}>
                    <LinearGradient
                      colors={[colors.primaryLighter, colors.accentLight]}
                      style={styles.testimonialGrad}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                      {/* Decorative quote mark */}
                      <Text style={styles.testimonialQuoteMark}>"</Text>

                      {/* Star rating */}
                      <View style={styles.testimonialStars}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Text key={n} style={styles.testimonialStar}>★</Text>
                        ))}
                      </View>

                      <Text style={styles.testimonialText}>{t.text}</Text>

                      {/* Avatar + author */}
                      <View style={styles.testimonialFooter}>
                        <LinearGradient
                          colors={[t.avatarColor, t.avatarColor + 'AA']}
                          style={styles.testimonialAvatar}
                        >
                          <Text style={styles.testimonialAvatarText}>{t.avatarInitial}</Text>
                        </LinearGradient>
                        <View style={styles.testimonialAuthorBlock}>
                          <Text style={styles.testimonialAuthor}>{t.author}</Text>
                          <Text style={styles.testimonialScore}>{t.score}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>

            {/* ─── Pricing Preview ─── */}
            <Animated.View style={[styles.pricingSection, {
              opacity: priceOpacity,
              transform: [{ translateY: priceSlide }],
            }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTag}>
                  <Text style={styles.sectionTagText}>תוכניות</Text>
                </View>
                <Text style={styles.sectionTitle}>בחר את התוכנית שלך</Text>
              </View>
              <View style={styles.pricingRow}>
                {/* Free plan */}
                <View style={styles.pricingCard}>
                  <View style={styles.pricingHeader}>
                    <Text style={styles.pricingPlanName}>חינמי 🆓</Text>
                    <Text style={styles.pricingPrice}>ללא עלות</Text>
                  </View>
                  <View style={styles.pricingFeatures}>
                    {['תרגול בסיסי', '3 נושאים', 'ללא סימולציות'].map(f => (
                      <View key={f} style={styles.pricingFeatureRow}>
                        <Text style={styles.pricingFeatureDot}>·</Text>
                        <Text style={styles.pricingFeatureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Premium plan */}
                <View style={[styles.pricingCard, styles.pricingCardPremium]}>
                  <LinearGradient
                    colors={colors.gradients.primary}
                    style={styles.pricingPremiumHeader}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.pricingPremiumName}>פרמיום 💎</Text>
                    <Text style={styles.pricingPremiumPrice}>₪49 לחודש</Text>
                  </LinearGradient>
                  <View style={styles.pricingFeatures}>
                    {['כל הנושאים', 'סימולציות מלאות', 'אנליטיקס מלא', 'תמיכה'].map(f => (
                      <View key={f} style={styles.pricingFeatureRow}>
                        <Text style={[styles.pricingFeatureDot, { color: colors.primary }]}>✓</Text>
                        <Text style={[styles.pricingFeatureText, { color: colors.text }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* ─── Final CTA Banner ─── */}
            <Animated.View style={[styles.finalCtaSection, {
              opacity: ctaOpacity,
              transform: [{ translateY: ctaSlide }],
            }]}>
              <LinearGradient
                colors={[colors.primaryLighter, colors.accentLight]}
                style={styles.finalCtaBanner}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <View style={styles.finalCtaGlow} />
                <Text style={styles.finalCtaTitle}>מוכן להצליח בפסיכוטכני?</Text>
                <Text style={styles.finalCtaSub}>
                  הצטרף לאלפי סטודנטים שכבר משתמשים ב-PsychoTechniPlus
                </Text>
                <Animated.View style={{ transform: [{ scale: ctaPressScale }] }}>
                  <Pressable
                    onPress={handleStart}
                    onPressIn={onCtaPressIn}
                    onPressOut={onCtaPressOut}
                    style={styles.finalCtaBtn}
                  >
                    <LinearGradient
                      colors={colors.gradients.primary}
                      style={styles.finalCtaBtnGrad}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.finalCtaBtnText}>התחל עכשיו — בחינם ←</Text>
                      {/* Shimmer overlay */}
                      <View style={styles.finalCtaBtnShimmer} />
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </LinearGradient>
            </Animated.View>

            {/* ─── Footer ─── */}
            <View style={styles.footerWrap}>
              <LinearGradient
                colors={[colors.surfaceCard, colors.surface]}
                style={styles.footerGrad}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              >
                <Text style={styles.footerVersion}>PsychoTechniPlus v1.0</Text>
                <Text style={styles.footerText}>
                  בלחיצה על "התחל" אתה מסכים ל
                  <Text style={styles.footerLink} onPress={() => router.push('/terms')}> תנאי השימוש </Text>
                  ול
                  <Text style={styles.footerLink} onPress={() => router.push('/privacy')}> מדיניות הפרטיות</Text>
                </Text>
              </LinearGradient>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
