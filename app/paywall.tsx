import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { usePurchaseStore } from '../store/purchaseStore';
import { useUserStore } from '../store/userStore';
import { PurchasePackage } from '../lib/purchases';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

const BENEFITS = [
  { icon: '♾️', title: 'שאלות ללא הגבלה', desc: 'גישה לכל המאגר — מעל 2,000 שאלות' },
  { icon: '🧠', title: 'אלגוריתם ELO אדפטיבי', desc: 'AI שמתאים את השאלות לרמתך בזמן אמת' },
  { icon: '🏆', title: 'כל הסימולציות', desc: 'סימולציות מלאות בתנאי לחץ אמיתיים' },
  { icon: '⚡', title: 'אתגרים יומיים', desc: 'בונוס XP ומשימות מיוחדות מדי יום' },
  { icon: '📊', title: 'אנליטיקס מפורט', desc: 'גרפים, חוזקות, חולשות — הכל גלוי' },
  { icon: '💡', title: 'הסברים מלאים', desc: 'פתרון מפורט לכל שאלה' },
];

const PLAN_META: Record<string, { label: string; badge?: string; period: string; badgeColor: string }> = {
  weekly:   { label: 'שבועי',    period: 'לשבוע',    badgeColor: Colors.cyan,    badge: undefined },
  monthly:  { label: 'חודשי',    period: 'לחודש',    badgeColor: Colors.primary, badge: 'הכי פופולרי' },
  lifetime: { label: 'לצמיתות', period: 'חד-פעמי',  badgeColor: Colors.warning, badge: 'ללא מנוי' },
};

export default function PaywallScreen() {
  const { packages, isPurchasing, isRestoring, loadError, fetchOfferings, purchase, restore } = usePurchaseStore();
  const { isPremium } = useUserStore();
  const [selected, setSelected] = useState<string>('monthly');

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
    ]).start();

    if (packages.length === 0) {
      fetchOfferings().catch(() => null);
    }
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

  const selectedPkg: PurchasePackage | undefined = packages.find(p => p.identifier === selected);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0F0C24', '#1A1040', '#0E0B2A']}
        style={StyleSheet.absoluteFill}
      />
      {/* Glow orbs */}
      <View style={styles.orbLeft} />
      <View style={styles.orbRight} />

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
            <View style={styles.crownWrap}>
              <LinearGradient
                colors={[Colors.warning, '#F59E0B']}
                style={styles.crownGrad}
              >
                <Text style={styles.crownEmoji}>👑</Text>
              </LinearGradient>
            </View>
            <Text style={styles.heroTitle}>פסיכוטכניPlus</Text>
            <View style={styles.heroPremiumBadge}>
              <Text style={styles.heroPremiumBadgeText}>פרמיום</Text>
            </View>
            <Text style={styles.heroSub}>הכלי החזק ביותר להצלחה בפסיכוטכני</Text>
          </Animated.View>

          {/* Benefits */}
          <Animated.View style={[styles.benefitsCard, { opacity: fadeIn }]}>
            <View style={styles.cardGlow} />
            {BENEFITS.map((b, i) => (
              <View key={b.title} style={[styles.benefitRow, i < BENEFITS.length - 1 && styles.benefitBorder]}>
                <Text style={styles.benefitCheck}>✓</Text>
                <View style={styles.benefitInfo}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
                <Text style={styles.benefitIcon}>{b.icon}</Text>
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
              <ActivityIndicator color={Colors.primaryLight} style={{ marginVertical: 24 }} />
            )}

            {packages.map(pkg => {
              const isSelected = pkg.identifier === selected;
              const meta = PLAN_META[pkg.identifier] ?? PLAN_META.monthly;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => { setSelected(pkg.identifier); Haptics.selectionAsync(); }}
                  style={({ pressed }) => [
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    { opacity: pressed ? 0.88 : 1 },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${meta.label} · ${pkg.priceString} ${meta.period}`}
                >
                  {isSelected && (
                    <LinearGradient
                      colors={['rgba(124,111,247,0.18)', 'rgba(124,111,247,0.06)']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  {meta.badge && (
                    <View style={[styles.planBadge, { backgroundColor: meta.badgeColor }]}>
                      <Text style={styles.planBadgeText}>{meta.badge}</Text>
                    </View>
                  )}
                  <View style={styles.planCardInner}>
                    {/* Radio */}
                    <View style={[styles.radio, isSelected && styles.radioActive]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    {/* Info */}
                    <View style={styles.planInfo}>
                      <Text style={[styles.planName, isSelected && { color: Colors.text }]}>{meta.label}</Text>
                      <Text style={styles.planPeriod}>
                        {pkg.isSubscription ? 'מתחדש אוטומטית' : 'תשלום חד-פעמי · לא מתחדש'}
                      </Text>
                    </View>
                    {/* Price */}
                    <View style={styles.planPriceWrap}>
                      <Text style={[styles.planPrice, isSelected && { color: Colors.primaryLight }]}>
                        {pkg.priceString}
                      </Text>
                      <Text style={styles.planPricePeriod}>{meta.period}</Text>
                    </View>
                  </View>
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
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.purchaseBtnGrad}
            >
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  orbLeft: {
    position: 'absolute', bottom: 80, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: Colors.primary, opacity: 0.12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 80, pointerEvents: 'none',
  },
  orbRight: {
    position: 'absolute', top: 100, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.accent, opacity: 0.10,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 60, pointerEvents: 'none',
  },

  closeBtn: {
    alignSelf: 'flex-start', width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  closeBtnText: { color: Colors.textSecondary, fontSize: 16, fontFamily: FontFamily.bold },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  crownWrap: {
    shadowColor: Colors.warning, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55, shadowRadius: 18, elevation: 12,
  },
  crownGrad: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  crownEmoji: { fontSize: 36 },
  heroTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize['3xl'],
    color: Colors.text, textAlign: 'center', letterSpacing: -0.5,
  },
  heroPremiumBadge: {
    backgroundColor: Colors.warning, borderRadius: Radius.full,
    paddingHorizontal: 20, paddingVertical: 6,
  },
  heroPremiumBadgeText: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#1C1917',
  },
  heroSub: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: Colors.textSecondary, textAlign: 'center',
  },

  // Benefits
  benefitsCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius['2xl'],
    borderWidth: 1, borderColor: 'rgba(124,111,247,0.20)',
    marginBottom: 22, overflow: 'hidden',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 6,
  },
  cardGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(124,111,247,0.03)' },
  benefitRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  benefitBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  benefitIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  benefitInfo: { flex: 1, alignItems: 'flex-end' },
  benefitTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  benefitDesc: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textSecondary, marginTop: 1, textAlign: 'right',
  },
  benefitCheck: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm,
    color: Colors.success, width: 20, textAlign: 'center',
  },

  // Plans
  plansTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize.xl,
    color: Colors.text, textAlign: 'right', marginBottom: 12,
  },
  errorBanner: {
    backgroundColor: Colors.dangerLight, borderRadius: Radius.lg, padding: 14,
    borderWidth: 1, borderColor: Colors.dangerGlow, marginBottom: 12,
    alignItems: 'flex-end', gap: 8,
  },
  errorBannerText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.danger, textAlign: 'right' },
  retryBtn: { backgroundColor: Colors.dangerLight, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 6 },
  retryBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.danger },

  planCard: {
    borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface, marginBottom: 10,
    overflow: 'hidden', position: 'relative',
  },
  planCardSelected: {
    borderColor: Colors.primaryLight,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
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
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioActive: { borderColor: Colors.primaryLight },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryLight },
  planInfo: { flex: 1, alignItems: 'flex-end' },
  planName: {
    fontFamily: FontFamily.bold, fontSize: FontSize.base,
    color: Colors.textSecondary, textAlign: 'right',
  },
  planPeriod: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, marginTop: 2, textAlign: 'right',
  },
  planPriceWrap: { alignItems: 'flex-start', flexShrink: 0 },
  planPrice: {
    fontFamily: FontFamily.bold, fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  planPricePeriod: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, textAlign: 'center',
  },

  // CTA
  purchaseBtn: {
    borderRadius: Radius.xl, overflow: 'hidden', marginTop: 10,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 22, elevation: 14,
  },
  purchaseBtnGrad: {
    paddingVertical: 18, alignItems: 'center', overflow: 'hidden',
  },
  purchaseBtnShimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.08)' },
  purchaseBtnText: {
    fontFamily: FontFamily.bold, fontSize: FontSize.lg,
    color: '#fff', letterSpacing: 0.2,
  },

  restoreBtn: {
    alignItems: 'center', paddingVertical: 16,
    minHeight: 44, justifyContent: 'center',
  },
  restoreBtnText: {
    fontFamily: FontFamily.medium, fontSize: FontSize.sm,
    color: Colors.textTertiary, textDecorationLine: 'underline',
  },

  legal: {
    fontFamily: FontFamily.regular, fontSize: 11,
    color: Colors.textTertiary, textAlign: 'center',
    lineHeight: 17, paddingHorizontal: 8, marginBottom: 12,
  },
  legalLinks: {
    flexDirection: 'row-reverse', justifyContent: 'center',
    alignItems: 'center', marginBottom: 8, gap: 4,
  },
  legalLink: {
    fontFamily: FontFamily.medium, fontSize: 11,
    color: Colors.primaryLight, textDecorationLine: 'underline',
  },
  legalSep: {
    fontFamily: FontFamily.regular, fontSize: 11,
    color: Colors.textTertiary,
  },
});
