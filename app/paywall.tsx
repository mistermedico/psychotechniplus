import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, Animated, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { usePurchaseStore } from '../store/purchaseStore';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { useScreenVisit } from '../utils/visitTracker';
import { PurchasePackage } from '../lib/purchases';
import { ThemeColors } from '../constants/colors';
import { useColors } from '../hooks/useColors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

const BENEFITS = [
  { icon: '♾️', title: 'שאלות ללא הגבלה', desc: 'גישה לכל המאגר — מעל 2,000 שאלות', color: '#7C6FF7' },
  { icon: '🧠', title: 'אלגוריתם ELO אדפטיבי', desc: 'AI שמתאים את השאלות לרמתך בזמן אמת', color: '#C084FC' },
  { icon: '🏆', title: 'כל הסימולציות', desc: 'סימולציות מלאות בתנאי לחץ אמיתיים', color: '#FBBF24' },
  { icon: '⚡', title: 'אתגרים יומיים', desc: 'בונוס XP ומשימות מיוחדות מדי יום', color: '#F59E0B' },
  { icon: '📊', title: 'אנליטיקס מפורט', desc: 'גרפים, חוזקות, חולשות — הכל גלוי', color: '#34D399' },
  { icon: '💡', title: 'הסברים מלאים', desc: 'פתרון מפורט לכל שאלה', color: '#22D3EE' },
];

const PLAN_META: Record<string, { label: string; badge?: string; period: string; badgeColor: string; isRecommended?: boolean }> = {
  weekly:   { label: 'שבועי',    period: 'לשבוע',    badgeColor: '#22D3EE',  badge: undefined },
  monthly:  { label: 'חודשי',    period: 'לחודש',    badgeColor: '#7C6FF7',  badge: 'הכי פופולרי' },
  yearly:   { label: 'שנתי',     period: 'לשנה',     badgeColor: '#34D399',  badge: 'מומלץ', isRecommended: true },
  lifetime: { label: 'לצמיתות', period: 'חד-פעמי',  badgeColor: '#FBBF24',  badge: 'ללא מנוי' },
};

const TRUST_BADGES = [
  { icon: '🔒', label: 'תשלום מאובטח' },
  { icon: '↩️', label: 'החזר כספי' },
  { icon: '⭐', label: '10K+ משתמשים' },
];

export default function PaywallScreen() {
  const { packages, isPurchasing, isRestoring, loadError, fetchOfferings, purchase, restore } = usePurchaseStore();
  const { isPremium, setPremium } = useUserStore();
  const { promoCodes } = useAdminStore();
  useScreenVisit('Paywall — דף תשלום');
  const [selected, setSelected] = useState<string>('monthly');
  const [promoInput, setPromoInput] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(28)).current;
  const heroPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
    ]).start();

    // Pulse animation for diamond hero
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(heroPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    pulse.start();

    if (packages.length === 0) {
      fetchOfferings().catch(() => null);
    }

    return () => pulse.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Already premium — close paywall
  useEffect(() => {
    if (isPremium) router.back();
  }, [isPremium]);

  const handlePurchase = async () => {
    const pkg = packages.find(p => p.identifier === selected);
    if (!pkg) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await purchase(pkg);

    if (result.cancelled) return; // user cancelled — no alert needed

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '🎉 ברוך הבא לפרמיום!',
        'גישה מלאה הופעלה בהצלחה. תודה שהצטרפת!',
        [{ text: 'בוא נתחיל ←', onPress: () => router.back() }],
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('שגיאה ברכישה', result.error ?? 'הרכישה לא הושלמה. נסה שנית.');
    }
  };

  const handleRestore = async () => {
    Haptics.selectionAsync();
    const result = await restore();
    if (result.isPremium) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ שוחזר', 'המנוי שלך שוחזר בהצלחה', [{ text: 'המשך', onPress: () => router.back() }]);
    } else if (result.error) {
      Alert.alert('שגיאה', result.error);
    } else {
      Alert.alert('לא נמצא מנוי', 'לא נמצאו רכישות קודמות לשחזור עבור חשבון זה.');
    }
  };

  const handlePromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) { Alert.alert('שגיאה', 'הזן קוד קופון'); return; }

    const promo = promoCodes.find(c => c.code === code && c.isActive);
    if (!promo) {
      Alert.alert('קוד לא תקין', 'הקוד לא קיים, לא פעיל, או פג תוקפו');
      return;
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      Alert.alert('קוד פג תוקף', 'תוקף הקוד הזה פג');
      return;
    }
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      Alert.alert('קוד מנוצל', 'הקוד הגיע למגבלת השימושים');
      return;
    }

    setPromoApplying(true);
    try {
      if (promo.discountType === 'full_access') {
        setPremium(true);
        setPromoInput('');
        Alert.alert('🎉 גישה מלאה!', 'הקוד אושר — גישה פרמיום הופעלה', [
          { text: 'מצוין ←', onPress: () => router.back() },
        ]);
      } else if (promo.discountType === 'days_free') {
        setPremium(true);
        setPromoInput('');
        Alert.alert('🎉 ניסיון חינמי!', `הקוד אושר — ${promo.discountValue} ימי פרמיום הופעלו`, [
          { text: 'מצוין ←', onPress: () => router.back() },
        ]);
      } else if (promo.discountType === 'percent') {
        setPromoInput('');
        Alert.alert('🎟️ קוד הנחה', `הקוד אושר — ${promo.discountValue}% הנחה\nהחל הנחה זו ברכישה.`);
      }
    } finally {
      setPromoApplying(false);
    }
  };

  const selectedPkg: PurchasePackage | undefined = packages.find(p => p.identifier === selected);

  return (
    <View style={styles.root}>
      {/* Always dark luxurious gradient for paywall hero feel */}
      <LinearGradient
        colors={['#0A071E', '#130F35', '#0D0B28']}
        style={StyleSheet.absoluteFill}
      />
      {/* Glow orbs */}
      <View style={styles.orbLeft} />
      <View style={styles.orbRight} />
      <View style={styles.orbTop} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Close button */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityLabel="סגור"
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>

          {/* Hero */}
          <Animated.View style={[styles.hero, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <Animated.View style={[styles.diamondWrap, { transform: [{ scale: heroPulse }] }]}>
              <LinearGradient
                colors={['#7C6FF7', '#C084FC', '#9E99FA']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.diamondGrad}
              >
                <Text style={styles.diamondEmoji}>💎</Text>
              </LinearGradient>
              {/* Pulse glow ring */}
              <Animated.View style={[styles.diamondGlowRing, { transform: [{ scale: heroPulse }] }]} />
            </Animated.View>
            <Text style={styles.heroTitle}>שדרג לפרמיום</Text>
            <Text style={styles.heroSub}>גישה מלאה לכל התכונות</Text>
          </Animated.View>

          {/* Benefits */}
          <Animated.View style={[styles.benefitsCard, { opacity: fadeIn }]}>
            {BENEFITS.map((b, i) => (
              <View key={b.title} style={[styles.benefitRow, i < BENEFITS.length - 1 && styles.benefitBorder]}>
                {/* Gradient left-border strip (RTL: right side visually) */}
                <View style={[styles.benefitStrip, { backgroundColor: b.color }]} />
                {/* Icon in colored circle */}
                <View style={[styles.benefitIconCircle, { backgroundColor: b.color + '22' }]}>
                  <Text style={styles.benefitIcon}>{b.icon}</Text>
                </View>
                {/* Info */}
                <View style={styles.benefitInfo}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
                {/* Checkmark */}
                <Text style={[styles.benefitCheck, { color: b.color }]}>✓</Text>
              </View>
            ))}
          </Animated.View>

          {/* Plans */}
          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
            <Text style={styles.plansTitle}>בחר תוכנית</Text>

            {loadError && packages.length === 0 && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>שגיאה בטעינת מחירים. בדוק חיבור לאינטרנט.</Text>
                <Pressable onPress={() => fetchOfferings().catch(() => null)} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>נסה שוב</Text>
                </Pressable>
              </View>
            )}

            {packages.length === 0 && !loadError && (
              <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: 24 }} />
            )}

            {packages.map(pkg => {
              const isSelected = pkg.identifier === selected;
              const meta = PLAN_META[pkg.identifier] ?? PLAN_META.monthly;
              const isRecommended = meta.isRecommended;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => { setSelected(pkg.identifier); Haptics.selectionAsync(); }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, marginBottom: 10 }]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${meta.label} · ${pkg.priceString} ${meta.period}`}
                >
                  {/* Gradient border wrapper for selected plan */}
                  {isSelected ? (
                    <LinearGradient
                      colors={['#7C6FF7', '#C084FC']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.planGradBorder}
                    >
                      <View style={styles.planCardInnerWrapper}>
                        {isSelected && (
                          <LinearGradient
                            colors={['rgba(124,111,247,0.20)', 'rgba(124,111,247,0.06)']}
                            style={StyleSheet.absoluteFill}
                          />
                        )}
                        {meta.badge && (
                          <View style={[styles.planBadge, { backgroundColor: isRecommended ? '#34D399' : meta.badgeColor }]}>
                            <Text style={styles.planBadgeText}>{meta.badge}</Text>
                          </View>
                        )}
                        <View style={styles.planCardInner}>
                          <View style={[styles.radio, styles.radioActive]}>
                            <View style={styles.radioDot} />
                          </View>
                          <View style={styles.planInfo}>
                            <Text style={[styles.planName, { color: colors.text }]}>{meta.label}</Text>
                            <Text style={styles.planPeriod}>
                              {pkg.isSubscription ? 'מתחדש אוטומטית' : 'תשלום חד-פעמי · לא מתחדש'}
                            </Text>
                          </View>
                          <View style={styles.planPriceWrap}>
                            <Text style={[styles.planPrice, { color: colors.primaryLight }]}>
                              {pkg.priceString}
                            </Text>
                            <Text style={styles.planPricePeriod}>{meta.period}</Text>
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.planCard}>
                      {meta.badge && (
                        <View style={[styles.planBadge, { backgroundColor: isRecommended ? '#34D399' : meta.badgeColor }]}>
                          <Text style={styles.planBadgeText}>{meta.badge}</Text>
                        </View>
                      )}
                      <View style={styles.planCardInner}>
                        <View style={styles.radio} />
                        <View style={styles.planInfo}>
                          <Text style={styles.planName}>{meta.label}</Text>
                          <Text style={styles.planPeriod}>
                            {pkg.isSubscription ? 'מתחדש אוטומטית' : 'תשלום חד-פעמי · לא מתחדש'}
                          </Text>
                        </View>
                        <View style={styles.planPriceWrap}>
                          <Text style={styles.planPrice}>{pkg.priceString}</Text>
                          <Text style={styles.planPricePeriod}>{meta.period}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Animated.View>

          {/* CTA */}
          <Pressable
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedPkg}
            accessibilityRole="button"
            accessibilityLabel={selectedPkg ? `שדרג עכשיו · ${selectedPkg.priceString}` : 'שדרג עכשיו'}
            accessibilityState={{ disabled: isPurchasing || !selectedPkg }}
            style={({ pressed }) => [
              styles.purchaseBtn,
              { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: !selectedPkg ? 0.6 : 1 },
            ]}
          >
            <LinearGradient
              colors={['#7C6FF7', '#C084FC', '#9E99FA']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.purchaseBtnGrad}
            >
              {/* Shimmer overlay */}
              <View style={styles.purchaseBtnShimmer} />
              {isPurchasing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.purchaseBtnText}>
                    {selectedPkg
                      ? `שדרג עכשיו · ${selectedPkg.priceString} ${PLAN_META[selectedPkg.identifier]?.period ?? ''}`
                      : 'טוען...'}
                  </Text>
              }
            </LinearGradient>
          </Pressable>

          {/* "Cancel anytime" note for subscriptions */}
          {selectedPkg?.isSubscription && (
            <Text style={styles.cancelNote}>✓ ביטול בכל עת — ללא מחויבות</Text>
          )}

          {/* Trust badges */}
          <View style={styles.trustRow}>
            {TRUST_BADGES.map(tb => (
              <View key={tb.label} style={styles.trustBadge}>
                <Text style={styles.trustBadgeIcon}>{tb.icon}</Text>
                <Text style={styles.trustBadgeLabel}>{tb.label}</Text>
              </View>
            ))}
          </View>

          {/* Restore */}
          <Pressable
            onPress={handleRestore}
            disabled={isRestoring}
            accessibilityRole="button"
            accessibilityLabel="שחזר רכישה קודמת"
            accessibilityState={{ disabled: isRestoring }}
            style={[styles.restoreBtn, { opacity: isRestoring ? 0.6 : 1 }]}
          >
            <Text style={styles.restoreBtnText}>
              {isRestoring ? 'משחזר רכישות...' : 'שחזר רכישה קודמת'}
            </Text>
          </Pressable>

          {/* Promo code */}
          <View style={styles.promoSection}>
            <View style={styles.promoRow}>
              <Pressable
                onPress={handlePromoCode}
                disabled={promoApplying}
                style={[styles.promoBtn, promoApplying && { opacity: 0.6 }]}
              >
                <Text style={styles.promoBtnText}>{promoApplying ? '...' : 'החל'}</Text>
              </Pressable>
              <TextInput
                style={styles.promoInput}
                value={promoInput}
                onChangeText={v => setPromoInput(v.toUpperCase())}
                placeholder="קוד קופון"
                placeholderTextColor="rgba(255,255,255,0.25)"
                textAlign="right"
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handlePromoCode}
              />
            </View>
          </View>

          {/* Legal text */}
          {selectedPkg?.isSubscription && (
            <Text style={styles.legal}>
              המנוי יחויב דרך חשבון ה-Apple ID שלך. חידוש אוטומטי יתבצע 24 שעות לפני תום התקופה.
              ניתן לבטל בכל עת דרך הגדרות ← Apple ID ← מנויים.
            </Text>
          )}
          {selectedPkg && !selectedPkg.isSubscription && (
            <Text style={styles.legal}>
              רכישה חד-פעמית · לא מתחדשת · גישה לצמיתות לכל התכנים הנוכחיים.
            </Text>
          )}

          {/* Legal links */}
          <View style={styles.legalLinks}>
            <Pressable onPress={() => router.push('/privacy')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.legalLink}>מדיניות פרטיות</Text>
            </Pressable>
            <Text style={styles.legalSep}> · </Text>
            <Pressable onPress={() => router.push('/terms')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.legalLink}>תנאי שימוש</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 480, alignSelf: 'center', width: '100%' },

    orbLeft: {
      position: 'absolute', bottom: 80, left: -60,
      width: 220, height: 220, borderRadius: 110,
      backgroundColor: colors.primary, opacity: 0.14,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1, shadowRadius: 80, pointerEvents: 'none',
    },
    orbRight: {
      position: 'absolute', top: 100, right: -60,
      width: 180, height: 180, borderRadius: 90,
      backgroundColor: colors.accent, opacity: 0.10,
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1, shadowRadius: 60, pointerEvents: 'none',
    },
    orbTop: {
      position: 'absolute', top: -40, left: '30%',
      width: 200, height: 200, borderRadius: 100,
      backgroundColor: '#C084FC', opacity: 0.07,
      shadowColor: '#C084FC', shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1, shadowRadius: 60, pointerEvents: 'none',
    },

    closeBtn: {
      alignSelf: 'flex-start', width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center',
      marginTop: 12, marginBottom: 4,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    closeBtnText: { color: 'rgba(240,244,255,0.60)', fontSize: 16, fontFamily: FontFamily.bold },

    // Hero
    hero: { alignItems: 'center', paddingVertical: 24, gap: 12 },
    diamondWrap: {
      alignItems: 'center', justifyContent: 'center',
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.70, shadowRadius: 28, elevation: 18,
    },
    diamondGrad: {
      width: 88, height: 88, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center',
    },
    diamondEmoji: { fontSize: 44 },
    diamondGlowRing: {
      position: 'absolute',
      width: 110, height: 110, borderRadius: 40,
      borderWidth: 2, borderColor: 'rgba(124,111,247,0.30)',
      backgroundColor: 'transparent',
    },
    heroTitle: {
      fontFamily: FontFamily.heading, fontSize: FontSize['3xl'],
      color: '#F0F4FF', textAlign: 'center', letterSpacing: -0.5,
    },
    heroSub: {
      fontFamily: FontFamily.regular, fontSize: FontSize.base,
      color: 'rgba(240,244,255,0.60)', textAlign: 'center',
    },

    // Benefits
    benefitsCard: {
      backgroundColor: colors.surfaceCard, borderRadius: Radius['2xl'],
      borderWidth: 1, borderColor: 'rgba(124,111,247,0.20)',
      marginBottom: 22, overflow: 'hidden',
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18, shadowRadius: 16, elevation: 6,
    },
    benefitRow: {
      flexDirection: 'row-reverse', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
      position: 'relative',
    },
    benefitBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
    benefitStrip: {
      position: 'absolute', right: 0, top: 0, bottom: 0,
      width: 3, borderRadius: 2,
    },
    benefitIconCircle: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    benefitIcon: { fontSize: 20 },
    benefitInfo: { flex: 1, alignItems: 'flex-end' },
    benefitTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#F0F4FF', textAlign: 'right' },
    benefitDesc: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: 'rgba(240,244,255,0.55)', marginTop: 2, textAlign: 'right',
    },
    benefitCheck: {
      fontFamily: FontFamily.bold, fontSize: FontSize.sm,
      width: 20, textAlign: 'center', flexShrink: 0,
    },

    // Plans
    plansTitle: {
      fontFamily: FontFamily.heading, fontSize: FontSize.xl,
      color: '#F0F4FF', textAlign: 'right', marginBottom: 12,
    },
    errorBanner: {
      backgroundColor: colors.dangerLight, borderRadius: Radius.lg, padding: 14,
      borderWidth: 1, borderColor: colors.dangerGlow, marginBottom: 12,
      alignItems: 'flex-end', gap: 8,
    },
    errorBannerText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: colors.danger, textAlign: 'right' },
    retryBtn: { backgroundColor: colors.dangerLight, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 6 },
    retryBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: colors.danger },

    // Unselected plan card
    planCard: {
      borderRadius: Radius.xl, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
      backgroundColor: 'rgba(255,255,255,0.05)',
      overflow: 'hidden', position: 'relative',
    },
    // Selected: gradient border wrapper
    planGradBorder: {
      borderRadius: Radius.xl + 1.5,
      padding: 1.5,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45, shadowRadius: 14, elevation: 8,
    },
    planCardInnerWrapper: {
      borderRadius: Radius.xl,
      backgroundColor: '#1A1545',
      overflow: 'hidden', position: 'relative',
    },
    planBadge: {
      position: 'absolute', top: -1, right: 16, zIndex: 10,
      borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4,
      borderTopLeftRadius: 0, borderTopRightRadius: 0,
    },
    planBadgeText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
    planCardInner: {
      flexDirection: 'row-reverse', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 16, gap: 12,
    },
    radio: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 2, borderColor: 'rgba(255,255,255,0.20)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    radioActive: { borderColor: colors.primaryLight },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryLight },
    planInfo: { flex: 1, alignItems: 'flex-end' },
    planName: {
      fontFamily: FontFamily.bold, fontSize: FontSize.base,
      color: 'rgba(240,244,255,0.65)', textAlign: 'right',
    },
    planPeriod: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: 'rgba(240,244,255,0.35)', marginTop: 2, textAlign: 'right',
    },
    planPriceWrap: { alignItems: 'flex-start', flexShrink: 0 },
    planPrice: {
      fontFamily: FontFamily.bold, fontSize: FontSize.xl,
      color: 'rgba(240,244,255,0.65)',
    },
    planPricePeriod: {
      fontFamily: FontFamily.regular, fontSize: FontSize.xs,
      color: 'rgba(240,244,255,0.35)', textAlign: 'center',
    },

    // CTA
    purchaseBtn: {
      borderRadius: Radius.xl, overflow: 'hidden', marginTop: 10,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.65, shadowRadius: 24, elevation: 16,
    },
    purchaseBtnGrad: {
      paddingVertical: 20, alignItems: 'center', overflow: 'hidden',
    },
    purchaseBtnShimmer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    purchaseBtnText: {
      fontFamily: FontFamily.bold, fontSize: FontSize.lg,
      color: '#fff', letterSpacing: 0.3,
    },

    // Cancel note
    cancelNote: {
      fontFamily: FontFamily.medium, fontSize: FontSize.xs,
      color: colors.success, textAlign: 'center',
      marginTop: 10, marginBottom: 2,
    },

    // Trust badges
    trustRow: {
      flexDirection: 'row-reverse', justifyContent: 'center',
      alignItems: 'center', gap: 0,
      marginTop: 14, marginBottom: 4,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius: Radius.xl, paddingVertical: 12, paddingHorizontal: 8,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    },
    trustBadge: {
      flex: 1, alignItems: 'center', gap: 4,
    },
    trustBadgeIcon: { fontSize: 18 },
    trustBadgeLabel: {
      fontFamily: FontFamily.medium, fontSize: 10,
      color: 'rgba(240,244,255,0.50)', textAlign: 'center',
    },

    restoreBtn: {
      alignItems: 'center', paddingVertical: 16,
      minHeight: 44, justifyContent: 'center',
    },
    restoreBtnText: {
      fontFamily: FontFamily.medium, fontSize: FontSize.sm,
      color: 'rgba(240,244,255,0.35)', textDecorationLine: 'underline',
    },

    legal: {
      fontFamily: FontFamily.regular, fontSize: 11,
      color: 'rgba(240,244,255,0.30)', textAlign: 'center',
      lineHeight: 17, paddingHorizontal: 8, marginBottom: 12,
    },
    legalLinks: {
      flexDirection: 'row-reverse', justifyContent: 'center',
      alignItems: 'center', marginBottom: 8, gap: 4,
    },
    legalLink: {
      fontFamily: FontFamily.medium, fontSize: 11,
      color: colors.primaryLight, textDecorationLine: 'underline',
    },
    legalSep: {
      fontFamily: FontFamily.regular, fontSize: 11,
      color: 'rgba(240,244,255,0.30)',
    },

    promoSection: { marginBottom: 8 },
    promoRow: { flexDirection: 'row-reverse', gap: 8 },
    promoInput: {
      flex: 1, height: 44, borderRadius: Radius.lg,
      borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
      backgroundColor: 'rgba(255,255,255,0.06)',
      paddingHorizontal: 14,
      fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#F0F4FF',
    },
    promoBtn: {
      height: 44, paddingHorizontal: 20, borderRadius: Radius.lg,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    promoBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  });
}
