import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

const { width: W } = Dimensions.get('window');

const FEATURES = [
  {
    icon: '🧠',
    title: 'אדפטיבי ומותאם אישית',
    desc: 'מנוע ELO מזהה את רמתך ומתאים את קושי השאלות בזמן אמת — כמו מאמן פרטי',
    color: Colors.primary,
  },
  {
    icon: '📊',
    title: 'מעקב התקדמות חכם',
    desc: 'גרפים, רצפים, XP ותגים — ראה בדיוק כיצד אתה משתפר לאורך זמן',
    color: Colors.accent,
  },
  {
    icon: '🎯',
    title: 'כל תחומי הפסיכוטכני',
    desc: 'חשיבה לוגית, כמותית, מילולית ומרחבית — כיסוי מלא לכל פרק המבחן',
    color: Colors.success,
  },
  {
    icon: '⚡',
    title: 'סימולציות מלאות',
    desc: 'מבחנים מדויקים בתנאי לחץ אמיתיים עם ניתוח ביצועים מפורט',
    color: Colors.warning,
  },
  {
    icon: '🏆',
    title: 'מערכת הישגים',
    desc: 'תגים, רמות ולוח מובילים — הפוך את הלמידה לחוויה מהנה ומניעה',
    color: Colors.danger,
  },
  {
    icon: '💡',
    title: 'הסברים מעמיקים',
    desc: 'כל שאלה עם הסבר מפורט לתשובה — למד מהטעויות ואל תחזור עליהן',
    color: Colors.cyan,
  },
];

const STATS = [
  { value: '3,000+', label: 'שאלות' },
  { value: '94%', label: 'שיפור ממוצע' },
  { value: '12+', label: 'נושאים' },
];


export default function LandingScreen() {
  const heroOpacity  = useRef(new Animated.Value(0)).current;
  const heroSlide    = useRef(new Animated.Value(24)).current;
  const heroScale    = useRef(new Animated.Value(0.92)).current;

  const statsOpacity = useRef(new Animated.Value(0)).current;
  const statsSlide   = useRef(new Animated.Value(20)).current;

  const featOpacity  = useRef(new Animated.Value(0)).current;
  const featSlide    = useRef(new Animated.Value(20)).current;

  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity   = useRef(new Animated.Value(0)).current;
  const ctaSlide     = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      // Hero animates first
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(heroSlide,   { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
        Animated.spring(heroScale,   { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
      ]),
      // Stats — short pause
      Animated.parallel([
        Animated.timing(statsOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(statsSlide,   { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
      // Features
      Animated.parallel([
        Animated.timing(featOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(featSlide,   { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
      // Quote + CTA together
      Animated.parallel([
        Animated.timing(quoteOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(ctaOpacity,   { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(ctaSlide,     { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/auth');
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/auth');
  };

  return (
    <View style={styles.root}>
      {/* Ambient orbs */}
      <View style={styles.orbPurple} />
      <View style={styles.orbPink} />
      <View style={styles.orbCyan} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces
        >

          {/* ─── Hero ─── */}
          <Animated.View style={[styles.hero, {
            opacity: heroOpacity,
            transform: [{ translateY: heroSlide }, { scale: heroScale }],
          }]}>
            {/* Badge */}
            <View style={styles.heroBadge}>
              <LinearGradient
                colors={[Colors.primaryLighter, Colors.accentLight]}
                style={styles.heroBadgeGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.heroBadgeText}>✦ AI-Powered · פסיכוטכני</Text>
              </LinearGradient>
            </View>

            {/* Logo */}
            <View style={styles.logoWrap}>
              <LinearGradient
                colors={Colors.gradients.primary}
                style={styles.logoGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Text style={styles.logoEmoji}>🧠</Text>
              </LinearGradient>
              <View style={styles.logoGlow} />
            </View>

            <Text style={styles.appName}>פסיכוטכניPlus</Text>
            <Text style={styles.tagline}>
              הדרך החכמה ביותר להתכונן{'\n'}למבחן הפסיכוטכני ולהצליח
            </Text>
          </Animated.View>

          {/* ─── Stats ─── */}
          <Animated.View style={[styles.statsRow, {
            opacity: statsOpacity,
            transform: [{ translateY: statsSlide }],
          }]}>
            {STATS.map((s, i) => (
              <React.Fragment key={s.label}>
                <View style={styles.statItem}>
                  <LinearGradient
                    colors={Colors.gradients.primary}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.statValue}>{s.value}</Text>
                  </LinearGradient>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
                {i < STATS.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </Animated.View>

          {/* ─── Features ─── */}
          <Animated.View style={[styles.featuresSection, {
            opacity: featOpacity,
            transform: [{ translateY: featSlide }],
          }]}>
            <View style={styles.sectionTag}>
              <Text style={styles.sectionTagText}>מה תקבל</Text>
            </View>
            <Text style={styles.sectionTitle}>כל מה שצריך{'\n'}כדי לעבור</Text>
            <View style={styles.featuresGrid}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.featureCard}>
                  <LinearGradient
                    colors={[f.color + '30', f.color + '10']}
                    style={styles.featureIconWrap}
                  >
                    <Text style={styles.featureIcon}>{f.icon}</Text>
                  </LinearGradient>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ─── Quote / Highlight ─── */}
          <Animated.View style={[styles.highlightCard, { opacity: quoteOpacity }]}>
            <LinearGradient
              colors={['rgba(124,111,247,0.14)', 'rgba(192,132,252,0.07)']}
              style={styles.highlightGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Text style={styles.highlightQuote}>"</Text>
              <Text style={styles.highlightText}>
                המערכת האדפטיבית מזהה בדיוק איפה אתה צריך לחזק — ומתמקדת שם. זה לא עוד בנק שאלות. זה מאמן אישי לפסיכוטכני.
              </Text>
              <View style={styles.highlightFooter}>
                <Text style={styles.highlightStars}>★★★★★</Text>
                <Text style={styles.highlightAuthor}>מנוע ELO אדפטיבי</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ─── CTAs ─── */}
          <Animated.View style={[styles.ctaSection, {
            opacity: ctaOpacity,
            transform: [{ translateY: ctaSlide }],
          }]}>
            <View style={styles.ctaPrimaryWrap}>
              <Pressable onPress={handleStart} style={styles.ctaPrimary}>
                <LinearGradient
                  colors={Colors.gradients.primary}
                  style={styles.ctaPrimaryGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.ctaPrimaryText}>התחל עכשיו — בחינם</Text>
                  <Text style={styles.ctaArrow}>←</Text>
                </LinearGradient>
              </Pressable>
              <View style={styles.ctaGlow} />
            </View>

            <Pressable onPress={handleLogin} style={styles.ctaSecondary}>
              <Text style={styles.ctaSecondaryText}>יש לי חשבון — כניסה</Text>
            </Pressable>
          </Animated.View>

          {/* ─── Footer ─── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              בלחיצה על "התחל" אתה מסכים ל
              <Text style={styles.footerLink} onPress={() => router.push('/terms')}> תנאי השימוש </Text>
              ול
              <Text style={styles.footerLink} onPress={() => router.push('/privacy')}> מדיניות הפרטיות</Text>
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Ambient orbs
  orbPurple: {
    position: 'absolute', width: 340, height: 340,
    borderRadius: 170, backgroundColor: Colors.primaryGlow,
    top: -80, left: -80, opacity: 0.22,
  },
  orbPink: {
    position: 'absolute', width: 260, height: 260,
    borderRadius: 130, backgroundColor: Colors.accentGlow,
    top: 180, right: -100, opacity: 0.14,
  },
  orbCyan: {
    position: 'absolute', width: 200, height: 200,
    borderRadius: 100, backgroundColor: Colors.cyanGlow,
    bottom: 200, left: -60, opacity: 0.09,
  },

  scroll: { paddingBottom: 48 },

  // Hero
  hero: { alignItems: 'center', paddingTop: 36, paddingBottom: 28, paddingHorizontal: 24 },

  heroBadge: { marginBottom: 24, borderRadius: Radius.full, overflow: 'hidden' },
  heroBadgeGrad: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.borderGlow,
  },
  heroBadgeText: {
    fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    color: Colors.primaryLight, letterSpacing: 0.5,
  },

  logoWrap: { marginBottom: 22, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  logoGrad: {
    width: 92, height: 92, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7, shadowRadius: 24, elevation: 18,
  },
  logoEmoji: { fontSize: 46 },
  logoGlow: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: Colors.primaryGlow, opacity: 0.25,
  },

  appName: {
    fontFamily: FontFamily.heading, fontSize: 36, color: Colors.text,
    textAlign: 'center', letterSpacing: -0.8,
  },
  tagline: {
    fontFamily: FontFamily.regular, fontSize: FontSize.base,
    color: Colors.textSecondary, textAlign: 'center',
    marginTop: 10, lineHeight: 24, maxWidth: 280,
  },

  // Stats
  statsRow: {
    flexDirection: 'row-reverse',
    backgroundColor: Colors.surfaceCard,
    marginHorizontal: 20, borderRadius: Radius.xl, padding: 18,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 32,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: FontFamily.bold, fontSize: 22,
    color: Colors.text, backgroundColor: 'transparent',
  },
  statLabel: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, marginTop: 3,
  },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Features
  featuresSection: { paddingHorizontal: 20, marginBottom: 28 },

  sectionTag: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.borderGlow,
    marginBottom: 10,
  },
  sectionTagText: {
    fontFamily: FontFamily.medium, fontSize: 11,
    color: Colors.primaryLight, letterSpacing: 0.5,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold, fontSize: 24, color: Colors.text,
    textAlign: 'right', marginBottom: 18, lineHeight: 32,
  },
  featuresGrid: { gap: 10 },
  featureCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row-reverse', gap: 14, alignItems: 'flex-start',
  },
  featureIconWrap: {
    width: 50, height: 50, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureIcon: { fontSize: 24 },
  featureTextWrap: { flex: 1, alignItems: 'flex-end' },
  featureTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm,
    color: Colors.text, textAlign: 'right', marginBottom: 5,
  },
  featureDesc: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textSecondary, textAlign: 'right', lineHeight: 17,
  },

  // Highlight / Quote
  highlightCard: { marginHorizontal: 20, marginBottom: 28, borderRadius: Radius.xl, overflow: 'hidden' },
  highlightGrad: {
    padding: 22,
    borderWidth: 1, borderColor: Colors.borderGlow,
    borderRadius: Radius.xl,
  },
  highlightQuote: {
    fontFamily: FontFamily.bold, fontSize: 52, color: Colors.primaryLighter,
    textAlign: 'right', lineHeight: 40, marginBottom: 6,
  },
  highlightText: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.78)', textAlign: 'right', lineHeight: 23, marginBottom: 16,
  },
  highlightFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  highlightStars: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.warning },
  highlightAuthor: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textTertiary },

  // CTAs
  ctaSection: { paddingHorizontal: 20, gap: 12, marginBottom: 24 },

  ctaPrimaryWrap: { position: 'relative' },
  ctaPrimary: { borderRadius: Radius.xl, overflow: 'hidden' },
  ctaPrimaryGrad: {
    paddingVertical: 17, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row-reverse', gap: 8,
  },
  ctaPrimaryText: {
    fontFamily: FontFamily.bold, fontSize: FontSize.lg,
    color: '#fff', letterSpacing: 0.2,
  },
  ctaArrow: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: 'rgba(255,255,255,0.8)' },
  ctaGlow: {
    position: 'absolute', bottom: -10, left: '10%', right: '10%', height: 30,
    backgroundColor: Colors.primaryGlow, borderRadius: 20,
    opacity: 0.45,
  },

  ctaSecondary: {
    paddingVertical: 15, paddingHorizontal: 24,
    borderRadius: Radius.xl, alignItems: 'center',
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 4,
  },
  ctaSecondaryText: {
    fontFamily: FontFamily.medium, fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Footer
  footer: { paddingHorizontal: 32, alignItems: 'center' },
  footerText: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, textAlign: 'center', lineHeight: 18,
  },
  footerLink: { color: Colors.primaryLight, fontFamily: FontFamily.medium },
});
