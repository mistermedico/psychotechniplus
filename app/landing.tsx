import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { DEFAULT_PURCHASE_PACKAGES } from '../lib/purchases';
import { usePurchaseStore } from '../store/purchaseStore';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

const { width: W } = Dimensions.get('window');

const FEATURES = [
  {
    icon: '🎯',
    title: 'מותאם אישית',
    desc: 'מנוע אדפטיבי מזהה את רמתך ומתאים שאלות בזמן אמת',
    color: Colors.primary,
  },
  {
    icon: '📊',
    title: 'מעקב מתקדם',
    desc: 'גרפים, רצפים ותגים — ראה בדיוק כיצד אתה משתפר',
    color: Colors.accent,
  },
  {
    icon: '⚡',
    title: 'סימולציות מלאות',
    desc: 'מבחנים מדויקים בתנאי לחץ עם ניתוח ביצועים',
    color: Colors.warning,
  },
  {
    icon: '🏆',
    title: 'מערכת הישגים',
    desc: 'תגים, רמות ולוח מובילים — הפוך את הלמידה למשחק',
    color: Colors.success,
  },
  {
    icon: '💡',
    title: 'הסברים מעמיקים',
    desc: 'כל שאלה עם הסבר מפורט — למד מהטעויות',
    color: Colors.cyan,
  },
  {
    icon: '🎓',
    title: 'כל תחומי הפסיכוטכני',
    desc: 'חשיבה לוגית, כמותית, מילולית ומרחבית',
    color: Colors.primary,
  },
];

const STATS = [
  { value: '10,000+', label: 'משתמשים' },
  { value: '95%', label: 'שיפור ממוצע' },
  { value: '3,000+', label: 'שאלות' },
];

const HOW_STEPS = [
  { icon: '📋', title: 'הירשם', desc: 'הרשמה מהירה ב-30 שניות' },
  { icon: '🧠', title: 'תרגל', desc: 'שאלות מותאמות לרמתך' },
  { icon: '🚀', title: 'תצליח', desc: 'הגע לציון הרצוי' },
];

const TESTIMONIALS = [
  {
    stars: '⭐⭐⭐⭐⭐',
    text: 'עלה לי 30 נקודות תוך חודש! האפליקציה מרגישה כמו מאמן אישי. ממליץ בחום!',
    author: '— דנה ג., ציון 134',
  },
  {
    stars: '⭐⭐⭐⭐⭐',
    text: 'הסימולציות חיקו בדיוק את המבחן האמיתי. הגעתי מוכן לחלוטין.',
    author: '— יואב מ., ציון 141',
  },
];

export default function LandingScreen() {
  const { packages, loadError, fetchOfferings } = usePurchaseStore();

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
  const visiblePackages = packages.length > 0 ? packages : DEFAULT_PURCHASE_PACKAGES;

  useEffect(() => {
    if (packages.length === 0) {
      fetchOfferings().catch(() => null);
    }

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
  }, []); // eslint-disable-line

  const getPlanPeriod = (identifier: string) => {
    if (identifier === 'weekly') return 'לשבוע';
    if (identifier === 'monthly') return 'לחודש';
    return 'חד-פעמי';
  };

  const getPlanBadge = (identifier: string) => {
    if (identifier === 'monthly') return 'הכי פופולרי';
    if (identifier === 'lifetime') return 'ללא מנוי מתחדש';
    return 'גמיש';
  };

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

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#050816', '#0B1024', '#111827']} style={StyleSheet.absoluteFill} />
      <View style={styles.meshGrid} />
      <View style={styles.orbPurple} />
      <View style={styles.orbPink} />
      <View style={styles.orbCyan} />
      <View style={styles.orbGold} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* ─── Nav Bar ─── */}
        <Animated.View style={[styles.navShell, { opacity: navOpacity }]}>
          <BlurView intensity={26} tint="dark" style={styles.navBar}>
            <Pressable onPress={handleLogin} style={styles.navLogin}>
              <Text style={styles.navLoginText}>כניסה</Text>
            </Pressable>
            <View style={styles.navBrand}>
              <Text style={styles.navBrandMark}>PT+</Text>
              <Text style={styles.navAppName}>PsychoTechniPlus</Text>
            </View>
          </BlurView>
        </Animated.View>

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
            {/* Animated badge */}
            <View style={styles.heroBadgeWrap}>
              <LinearGradient
                colors={[Colors.primaryLighter, Colors.accentLight]}
                style={styles.heroBadgeGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.heroBadgeText}>מערכת הכנה חכמה לפסיכוטכני</Text>
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
            <Text style={styles.tagline}>הדרך החכמה להגיע לציון שרצית, עם אימון שנראה ומרגיש כמו מוצר פרימיום.</Text>
            <Text style={styles.subTagline}>מנוע אדפטיבי · תרגול חכם · סימולציות מלאות</Text>

            <View style={styles.heroPreview}>
              <BlurView intensity={28} tint="dark" style={styles.heroPreviewBlur}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewPill}>LIVE ELO</Text>
                  <Text style={styles.previewTitle}>דיוק אימון בזמן אמת</Text>
                </View>
                <View style={styles.previewScoreRow}>
                  <Text style={styles.previewScore}>87%</Text>
                  <View style={styles.previewGraph}>
                    {[42, 58, 49, 76, 64, 88].map((h, i) => (
                      <View key={i} style={[styles.previewBar, { height: h }]} />
                    ))}
                  </View>
                </View>
                <View style={styles.previewFooter}>
                  <Text style={styles.previewFooterText}>חולשה מזוהה: סדרות כמותיות</Text>
                  <Text style={styles.previewFooterBadge}>תוכנית חדשה נבנתה</Text>
                </View>
              </BlurView>
            </View>

            {/* Primary CTA */}
            <Animated.View style={[styles.ctaPrimaryWrap, { transform: [{ scale: ctaPressScale }] }]}>
              <Pressable
                onPress={handleStart}
                onPressIn={onCtaPressIn}
                onPressOut={onCtaPressOut}
                style={styles.ctaPrimary}
              >
                <LinearGradient
                  colors={Colors.gradients.primary}
                  style={styles.ctaPrimaryGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.ctaPrimaryText}>התחל בחינם — ללא כרטיס אשראי ←</Text>
                </LinearGradient>
              </Pressable>
              <View style={styles.ctaGlow} />
            </Animated.View>

            {/* Secondary CTA */}
            <Pressable onPress={handleLogin} style={styles.ctaSecondary}>
              <Text style={styles.ctaSecondaryText}>יש לי חשבון</Text>
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
                  <Text style={styles.statValue}>{s.value}</Text>
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
                <View key={step.title} style={styles.howStep}>
                  <LinearGradient
                    colors={[Colors.primaryLighter, 'rgba(192,132,252,0.10)']}
                    style={styles.howIconWrap}
                  >
                    <Text style={styles.howIcon}>{step.icon}</Text>
                  </LinearGradient>
                  <Text style={styles.howStepNum}>שלב {i + 1}</Text>
                  <Text style={styles.howStepTitle}>{step.title}</Text>
                  <Text style={styles.howStepDesc}>{step.desc}</Text>
                </View>
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

          {/* ─── Testimonials ─── */}
          <Animated.View style={[styles.testimonialsSection, {
            opacity: testOpacity,
            transform: [{ translateY: testSlide }],
          }]}>
            <View style={styles.sectionHeader}>
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
                    colors={['rgba(124,111,247,0.12)', 'rgba(192,132,252,0.06)']}
                    style={styles.testimonialGrad}
                  >
                    <Text style={styles.testimonialStars}>{t.stars}</Text>
                    <Text style={styles.testimonialText}>{t.text}</Text>
                    <Text style={styles.testimonialAuthor}>{t.author}</Text>
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
            {loadError && packages.length === 0 && (
              <Text style={styles.pricingSyncNote}>
                מוצגים מחירי ברירת המחדל עד שהחנות נטענת.
              </Text>
            )}
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

              {visiblePackages.map(pkg => (
                <View key={pkg.identifier} style={[styles.pricingCard, styles.pricingCardPremium]}>
                  <LinearGradient
                    colors={Colors.gradients.primary}
                    style={styles.pricingPremiumHeader}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.pricingPremiumName}>{pkg.description}</Text>
                    <Text style={styles.pricingPremiumPrice}>{pkg.priceString} {getPlanPeriod(pkg.identifier)}</Text>
                    <Text style={styles.pricingBadge}>{getPlanBadge(pkg.identifier)}</Text>
                  </LinearGradient>
                  <View style={styles.pricingFeatures}>
                    {['כל הנושאים', 'סימולציות מלאות', 'אנליטיקס מלא', pkg.isSubscription ? 'מנוי מתחדש' : 'תשלום חד פעמי'].map(f => (
                      <View key={f} style={styles.pricingFeatureRow}>
                        <Text style={[styles.pricingFeatureDot, { color: Colors.primary }]}>✓</Text>
                        <Text style={[styles.pricingFeatureText, { color: Colors.text }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ─── Final CTA Banner ─── */}
          <Animated.View style={[styles.finalCtaSection, {
            opacity: ctaOpacity,
            transform: [{ translateY: ctaSlide }],
          }]}>
            <LinearGradient
              colors={['rgba(124,111,247,0.18)', 'rgba(192,132,252,0.10)']}
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
                    colors={Colors.gradients.primary}
                    style={styles.finalCtaBtnGrad}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.finalCtaBtnText}>התחל עכשיו — בחינם ←</Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </LinearGradient>
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
  root: { flex: 1, backgroundColor: '#050816' },
  meshGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.22,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  // Ambient orbs
  orbPurple: {
    position: 'absolute', width: 360, height: 360,
    borderRadius: 180, backgroundColor: Colors.primary,
    top: -90, left: -90, opacity: 0.22,
  },
  orbPink: {
    position: 'absolute', width: 280, height: 280,
    borderRadius: 140, backgroundColor: Colors.accent,
    top: 220, right: -110, opacity: 0.15,
  },
  orbCyan: {
    position: 'absolute', width: 220, height: 220,
    borderRadius: 110, backgroundColor: Colors.cyan,
    bottom: 300, left: -70, opacity: 0.13,
  },
  orbGold: {
    position: 'absolute', width: 190, height: 190,
    borderRadius: 95, backgroundColor: Colors.warning,
    bottom: 70, right: -80, opacity: 0.10,
  },

  // Nav Bar
  navShell: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  navBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(8,10,18,0.42)',
  },
  navBrand: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  navBrandMark: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#fff',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  navAppName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  navLogin: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(124,111,247,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  navLoginText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
  },

  scroll: { paddingBottom: 48 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 34,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },

  heroBadgeWrap: { marginBottom: 26, borderRadius: Radius.full, overflow: 'hidden' },
  heroBadgeGrad: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroBadgeText: {
    fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    color: Colors.primaryLight, letterSpacing: 0.5,
  },

  logoWrap: { marginBottom: 22, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  logoGrad: {
    width: 92, height: 92, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.primary,
  },
  logoEmoji: { fontSize: 46 },
  logoGlow: {
    position: 'absolute', width: 136, height: 136, borderRadius: 68,
    backgroundColor: Colors.primaryGlow, opacity: 0.22,
  },

  appName: {
    fontFamily: FontFamily.heading, fontSize: 40, color: Colors.text,
    textAlign: 'center', letterSpacing: -1,
    marginBottom: 10,
  },
  tagline: {
    fontFamily: FontFamily.regular, fontSize: FontSize.base,
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 25, maxWidth: 330,
    marginBottom: 6,
  },
  subTagline: {
    fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    color: Colors.textTertiary, textAlign: 'center',
    letterSpacing: 0.3, marginBottom: 22,
  },

  heroPreview: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 22,
    ...Shadow.primary,
  },
  heroPreviewBlur: {
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.42)',
  },
  previewHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  previewTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#F8FAFC', textAlign: 'right' },
  previewPill: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.cyan,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  previewScoreRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 16 },
  previewScore: { fontFamily: FontFamily.heading, fontSize: 46, color: Colors.success },
  previewGraph: { flex: 1, flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 7, height: 96 },
  previewBar: {
    flex: 1,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(124,111,247,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  previewFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14 },
  previewFooterText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#CBD5E1', textAlign: 'right' },
  previewFooterBadge: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#111827',
    backgroundColor: Colors.warning,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: 'hidden',
  },

  // CTA in hero
  ctaPrimaryWrap: { width: '100%', marginBottom: 12, position: 'relative' },
  ctaPrimary: { borderRadius: Radius.xl, overflow: 'hidden' },
  ctaPrimaryGrad: {
    paddingVertical: 17, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaPrimaryText: {
    fontFamily: FontFamily.bold, fontSize: FontSize.base,
    color: '#fff', letterSpacing: 0.1,
  },
  ctaGlow: {
    position: 'absolute', bottom: -10, left: '10%', right: '10%', height: 28,
    backgroundColor: Colors.primaryGlow, borderRadius: 20, opacity: 0.45,
  },
  ctaSecondary: {
    paddingVertical: 13, paddingHorizontal: 24,
    borderRadius: Radius.xl, alignItems: 'center',
    width: '100%',
  },
  ctaSecondaryText: {
    fontFamily: FontFamily.medium, fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Stats
  statsCard: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(15,23,42,0.64)',
    marginHorizontal: 20, borderRadius: Radius.xl, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 36,
    ...Shadow.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: FontFamily.bold, fontSize: 22,
    color: Colors.primaryLight,
  },
  statLabel: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, marginTop: 3,
  },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Section header reusable
  sectionHeader: { marginBottom: 18, alignItems: 'flex-end' },
  sectionTag: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(124,111,247,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    marginBottom: 8,
  },
  sectionTagText: {
    fontFamily: FontFamily.medium, fontSize: 11,
    color: Colors.primaryLight, letterSpacing: 0.5,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize['2xl'],
    color: Colors.text, textAlign: 'right', lineHeight: 30,
  },

  // How It Works
  howSection: { paddingHorizontal: 20, marginBottom: 36 },
  howSteps: { flexDirection: 'row-reverse', gap: 10 },
  howStep: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.66)',
    borderRadius: Radius.xl, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
    alignItems: 'flex-end',
  },
  howIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  howIcon: { fontSize: 22 },
  howStepNum: {
    fontFamily: FontFamily.regular, fontSize: 10,
    color: Colors.textTertiary, letterSpacing: 0.4,
    marginBottom: 2, textAlign: 'right',
  },
  howStepTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm,
    color: Colors.text, textAlign: 'right', marginBottom: 4,
  },
  howStepDesc: {
    fontFamily: FontFamily.regular, fontSize: 10,
    color: Colors.textSecondary, textAlign: 'right', lineHeight: 14,
  },

  // Features
  featuresSection: { paddingHorizontal: 20, marginBottom: 36 },
  featuresGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    width: (W - 50) / 2,
    backgroundColor: 'rgba(15,23,42,0.66)',
    borderRadius: Radius.xl, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
    alignItems: 'flex-end',
  },
  featureIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, flexShrink: 0,
  },
  featureIcon: { fontSize: 22 },
  featureTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm,
    color: Colors.text, textAlign: 'right', marginBottom: 6,
  },
  featureDesc: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textSecondary, textAlign: 'right', lineHeight: 16,
  },

  // Testimonials
  testimonialsSection: { marginBottom: 36 },
  testimonialsRow: { paddingHorizontal: 20, gap: 12, flexDirection: 'row-reverse' },
  testimonialCard: {
    width: W * 0.78,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
  },
  testimonialGrad: { padding: 20 },
  testimonialStars: {
    fontSize: 14, marginBottom: 10, textAlign: 'right',
  },
  testimonialText: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: Colors.text, textAlign: 'right', lineHeight: 22,
    marginBottom: 12,
  },
  testimonialAuthor: {
    fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    color: Colors.primaryLight, textAlign: 'right',
  },

  // Pricing
  pricingSection: { paddingHorizontal: 20, marginBottom: 36 },
  pricingRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  pricingCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: 'rgba(15,23,42,0.70)',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  pricingCardPremium: {
    borderColor: 'rgba(124,111,247,0.55)',
    ...Shadow.primary,
  },
  pricingHeader: {
    padding: 16, alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pricingPlanName: {
    fontFamily: FontFamily.bold, fontSize: FontSize.base,
    color: Colors.text, textAlign: 'right',
  },
  pricingPrice: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, textAlign: 'right', marginTop: 2,
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
  pricingBadge: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#fff',
    textAlign: 'right',
    marginTop: 5,
    opacity: 0.9,
  },
  pricingSyncNote: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
    textAlign: 'right',
    marginBottom: 10,
  },
  pricingFeatures: { padding: 14, gap: 8, alignItems: 'flex-end' },
  pricingFeatureRow: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
  pricingFeatureDot: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm,
    color: Colors.textTertiary, width: 14,
  },
  pricingFeatureText: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textSecondary, textAlign: 'right',
  },

  // Final CTA
  finalCtaSection: { paddingHorizontal: 20, marginBottom: 28 },
  finalCtaBanner: {
    borderRadius: Radius['2xl'], padding: 28,
    borderWidth: 1, borderColor: Colors.borderGlow,
    alignItems: 'center', overflow: 'hidden',
  },
  finalCtaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124,111,247,0.04)',
  },
  finalCtaTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize['2xl'],
    color: Colors.text, textAlign: 'center', marginBottom: 10,
  },
  finalCtaSub: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 24, maxWidth: 280,
  },
  finalCtaBtn: { borderRadius: Radius.xl, overflow: 'hidden' },
  finalCtaBtnGrad: {
    paddingVertical: 16, paddingHorizontal: 32,
    alignItems: 'center',
  },
  finalCtaBtnText: {
    fontFamily: FontFamily.bold, fontSize: FontSize.lg,
    color: '#fff', letterSpacing: 0.2,
  },

  // Footer
  footer: { paddingHorizontal: 32, alignItems: 'center' },
  footerText: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, textAlign: 'center', lineHeight: 18,
  },
  footerLink: { color: Colors.primaryLight, fontFamily: FontFamily.medium },
});
