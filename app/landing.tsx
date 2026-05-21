import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Animated, Dimensions, Platform,
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
    desc: 'מנוע ELO מתקדם מזהה את רמתך ומתאים את קושי השאלות בזמן אמת',
    color: '#6366F1',
  },
  {
    icon: '📊',
    title: 'מעקב התקדמות מפורט',
    desc: 'גרפים, רצפים, XP ותגים — ראה כיצד אתה משתפר לאורך זמן',
    color: '#A855F7',
  },
  {
    icon: '🎯',
    title: 'מסלול פסיכוטכני כללי',
    desc: 'חשיבה לוגית, כמותית, מילולית ומרחבית — כל מה שצריך למבחן',
    color: '#10B981',
  },
  {
    icon: '⚡',
    title: 'סימולציות מלאות',
    desc: 'מבחנים מדויקים בתנאי לחץ אמיתיים עם ניתוח ביצועים',
    color: '#F59E0B',
  },
  {
    icon: '🏆',
    title: 'מערכת הישגים',
    desc: 'תגים, רמות ולוח מובילים — הפוך את הלמידה למשחק',
    color: '#EF4444',
  },
  {
    icon: '💡',
    title: 'הסברים מעמיקים',
    desc: 'כל שאלה מגיעה עם הסבר מפורט לתשובה הנכונה',
    color: '#06B6D4',
  },
];

const STATS = [
  { value: '2,000+', label: 'שאלות' },
  { value: '95%', label: 'שיפור ממוצע' },
  { value: '10+', label: 'נושאים' },
];

export default function LandingScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const heroScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/auth');
  };

  return (
    <LinearGradient
      colors={['#060912', '#0D1425', '#1A0F2E']}
      style={styles.root}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Hero */}
          <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ scale: heroScale }] }]}>
            <View style={styles.logoWrap}>
              <LinearGradient
                colors={['#6366F1', '#A855F7']}
                style={styles.logoGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Text style={styles.logoEmoji}>🧠</Text>
              </LinearGradient>
            </View>
            <Text style={styles.appName}>פסיכוטכניPlus</Text>
            <Text style={styles.tagline}>הדרך החכמה להצליח במבחן הפסיכוטכני</Text>
          </Animated.View>

          {/* Stats bar */}
          <Animated.View style={[styles.statsRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {STATS.map((s, i) => (
              <React.Fragment key={s.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
                {i < STATS.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </Animated.View>

          {/* Features */}
          <Animated.View style={[styles.featuresSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>מה תמצא אצלנו?</Text>
            <View style={styles.featuresGrid}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.featureCard}>
                  <LinearGradient
                    colors={[f.color + '30', f.color + '10']}
                    style={styles.featureIconWrap}
                  >
                    <Text style={styles.featureIcon}>{f.icon}</Text>
                  </LinearGradient>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Testimonial / highlight */}
          <Animated.View style={[styles.highlightCard, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={['rgba(99,102,241,0.15)', 'rgba(168,85,247,0.08)']}
              style={styles.highlightGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Text style={styles.highlightQuote}>"</Text>
              <Text style={styles.highlightText}>
                המערכת האדפטיבית מזהה בדיוק איפה אתה צריך לחזק — ומתמקדת שם. זה לא עוד בנק שאלות, זה מאמן אישי לפסיכוטכני.
              </Text>
              <View style={styles.highlightFooter}>
                <Text style={styles.highlightStars}>★★★★★</Text>
                <Text style={styles.highlightAuthor}>מערכת אדפטיבית מבוססת ELO</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* CTAs */}
          <Animated.View style={[styles.ctaSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Pressable onPress={handleStart} style={styles.ctaPrimary}>
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                style={styles.ctaPrimaryGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaPrimaryText}>התחל עכשיו — בחינם ←</Text>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={handleStart} style={styles.ctaSecondary}>
              <Text style={styles.ctaSecondaryText}>יש לי חשבון — כניסה</Text>
            </Pressable>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              בלחיצה על "התחל" אתה מסכים ל
              <Text style={styles.footerLink} onPress={() => router.push('/terms' as any)}> תנאי השימוש </Text>
              ול
              <Text style={styles.footerLink} onPress={() => router.push('/privacy' as any)}> מדיניות הפרטיות</Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 40 },

  hero: { alignItems: 'center', paddingTop: 40, paddingBottom: 32, paddingHorizontal: 24 },
  logoWrap: { marginBottom: 20 },
  logoGrad: {
    width: 88, height: 88, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 16,
  },
  logoEmoji: { fontSize: 44 },
  appName: {
    fontFamily: FontFamily.heading, fontSize: 34, color: '#fff',
    textAlign: 'center', letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: FontFamily.regular, fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.6)', textAlign: 'center',
    marginTop: 8, lineHeight: 22, maxWidth: 280,
  },

  statsRow: {
    flexDirection: 'row-reverse', backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20, borderRadius: Radius.xl, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 32,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.bold, fontSize: 22, color: '#fff' },
  statLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 4 },

  featuresSection: { paddingHorizontal: 20, marginBottom: 28 },
  sectionTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: '#fff',
    textAlign: 'right', marginBottom: 16,
  },
  featuresGrid: { gap: 12 },
  featureCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Radius.xl, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row-reverse', gap: 14, alignItems: 'flex-start',
  },
  featureIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureIcon: { fontSize: 24 },
  featureTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm,
    color: '#fff', textAlign: 'right', marginBottom: 4, flex: 1,
  },
  featureDesc: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.55)', textAlign: 'right', lineHeight: 17, flex: 1,
  },

  highlightCard: { marginHorizontal: 20, marginBottom: 28, borderRadius: Radius.xl, overflow: 'hidden' },
  highlightGrad: { padding: 20, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', borderRadius: Radius.xl },
  highlightQuote: {
    fontFamily: FontFamily.bold, fontSize: 48, color: 'rgba(99,102,241,0.4)',
    textAlign: 'right', lineHeight: 40, marginBottom: 4,
  },
  highlightText: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)', textAlign: 'right', lineHeight: 22, marginBottom: 14,
  },
  highlightFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  highlightStars: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#F59E0B' },
  highlightAuthor: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)' },

  ctaSection: { paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  ctaPrimary: { borderRadius: Radius.xl, overflow: 'hidden' },
  ctaPrimaryGrad: { paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center' },
  ctaPrimaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff', letterSpacing: 0.3 },
  ctaSecondary: {
    paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: Radius.xl, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  ctaSecondaryText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: 'rgba(255,255,255,0.75)' },

  footer: { paddingHorizontal: 32, alignItems: 'center' },
  footerText: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 18,
  },
  footerLink: { color: 'rgba(99,102,241,0.8)', fontFamily: FontFamily.medium },
});
