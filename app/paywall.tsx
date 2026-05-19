import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { getOfferings, purchasePackage, restorePurchases, PurchasePackage } from '../lib/purchases';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

const BENEFITS = [
  { icon: '♾️', title: 'שאלות ללא הגבלה', desc: 'גישה לכל המאגר — מעל 500 שאלות' },
  { icon: '🧠', title: 'אלגוריתם אדפטיבי', desc: 'מערכת AI שמתאימה את השאלות לרמתך' },
  { icon: '🏆', title: 'כל הסימולציות', desc: 'סימולציות מלאות לכל מסלול' },
  { icon: '⚡', title: 'מצב מהירות', desc: 'תרגול תחת לחץ זמן אמיתי' },
  { icon: '📊', title: 'אנליטיקס מפורט', desc: 'מעקב מלא אחרי ההתקדמות שלך' },
  { icon: '🎯', title: 'אתגרים יומיים', desc: 'בונוס XP מדי יום' },
];

export default function PaywallScreen() {
  const [packages, setPackages] = useState<PurchasePackage[]>([]);
  const [selected, setSelected] = useState<string>('annual');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { setPremium } = useUserStore();
  const { appConfig } = useAdminStore();

  useEffect(() => {
    getOfferings().then(setPackages);
  }, []);

  const handlePurchase = async () => {
    const pkg = packages.find(p => p.identifier === selected);
    if (!pkg) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await purchasePackage(pkg);
      if (result.success) {
        setPremium(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('🎉 ברוך הבא לפרמיום!', 'גישה מלאה הופעלה בהצלחה.', [
          { text: 'המשך', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('שגיאה', result.error ?? 'הרכישה נכשלה. נסה שנית.');
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e.message ?? 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const { isPremium } = await restorePurchases();
    setRestoring(false);
    if (isPremium) {
      setPremium(true);
      Alert.alert('✅ שוחזר', 'המנוי שלך שוחזר בהצלחה', [{ text: 'המשך', onPress: () => router.back() }]);
    } else {
      Alert.alert('לא נמצא מנוי', 'לא נמצאו רכישות קודמות לשחזור');
    }
  };

  const selectedPkg = packages.find(p => p.identifier === selected);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#1E1B4B', '#312E81', '#4C1D95']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Close */}
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.crownIcon}>👑</Text>
          <Text style={styles.heroTitle}>PsychoTechniPlus</Text>
          <Text style={styles.heroBadge}>פרמיום</Text>
          <Text style={styles.heroSub}>הכלי החזק ביותר להכנה לפסיכוטכני</Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={[styles.benefitRow, i < BENEFITS.length - 1 && styles.benefitBorder]}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <View style={styles.benefitInfo}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
              <Text style={styles.benefitCheck}>✓</Text>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <Text style={styles.pricingTitle}>בחר תוכנית</Text>
        {packages.map(pkg => {
          const isSelected = pkg.identifier === selected;
          const isBest = pkg.identifier === 'annual';
          return (
            <Pressable
              key={pkg.identifier}
              onPress={() => { setSelected(pkg.identifier); Haptics.selectionAsync(); }}
              style={[styles.priceCard, isSelected && styles.priceCardSelected]}
            >
              {isBest && (
                <View style={styles.bestBadge}>
                  <Text style={styles.bestBadgeText}>הכי שווה</Text>
                </View>
              )}
              <View style={styles.priceCardInner}>
                <View style={[styles.radioCircle, isSelected && styles.radioCircleFilled]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <View style={styles.priceInfo}>
                  <Text style={styles.priceDesc}>{pkg.description}</Text>
                </View>
                <Text style={[styles.priceAmount, isSelected && { color: '#fff' }]}>{pkg.priceString}</Text>
              </View>
            </Pressable>
          );
        })}

        {/* CTA */}
        <Pressable
          onPress={handlePurchase}
          disabled={loading || !selectedPkg}
          style={({ pressed }) => [styles.purchaseBtn, pressed && { opacity: 0.9 }]}
        >
          <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.purchaseBtnGrad}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.purchaseBtnText}>
                  שדרג עכשיו — {selectedPkg?.priceString ?? '...'}
                </Text>
            }
          </LinearGradient>
        </Pressable>

        {/* Legal */}
        <Pressable onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
          <Text style={styles.restoreBtnText}>
            {restoring ? 'משחזר...' : 'שחזר רכישות קודמות'}
          </Text>
        </Pressable>

        <Text style={styles.legal}>
          המנוי יחויב דרך ה-Apple ID שלך. חידוש אוטומטי יתבצע 24 שעות לפני תום התקופה אלא אם בוטל.
          ניתן לבטל בכל עת דרך הגדרות → Apple ID → מנויים.
        </Text>

        <View style={styles.legalLinks}>
          <Pressable onPress={() => Linking.openURL('https://psychotechniplus.com/privacy')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.legalLink}>מדיניות פרטיות</Text>
          </Pressable>
          <Text style={styles.legalSep}> · </Text>
          <Pressable onPress={() => Linking.openURL('https://psychotechniplus.com/terms')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.legalLink}>תנאי שימוש</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  closeBtn: {
    alignSelf: 'flex-start', width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Heebo_700Bold' },

  hero: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  crownIcon: { fontSize: 56 },
  heroTitle: { fontFamily: 'SuezOne_400Regular', fontSize: 28, color: '#fff' },
  heroBadge: {
    backgroundColor: '#F59E0B', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 6,
    fontFamily: 'Heebo_700Bold', fontSize: 14, color: '#fff',
  },
  heroSub: { fontFamily: 'Heebo_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },

  benefitsCard: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 24,
  },
  benefitRow: { flexDirection: 'row-reverse', alignItems: 'center', padding: 14, gap: 12 },
  benefitBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  benefitIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  benefitInfo: { flex: 1, alignItems: 'flex-end' },
  benefitTitle: { fontFamily: 'Heebo_700Bold', fontSize: 14, color: '#fff' },
  benefitDesc: { fontFamily: 'Heebo_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  benefitCheck: { color: '#10B981', fontFamily: 'Heebo_700Bold', fontSize: 16 },

  pricingTitle: {
    fontFamily: 'Heebo_700Bold', fontSize: 18, color: '#fff',
    textAlign: 'right', marginBottom: 12,
  },
  priceCard: {
    borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 10,
    position: 'relative', overflow: 'visible',
  },
  priceCardSelected: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)' },
  bestBadge: {
    position: 'absolute', top: -10, right: 16, zIndex: 10,
    backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  bestBadgeText: { fontFamily: 'Heebo_700Bold', fontSize: 11, color: '#fff' },
  priceCardInner: { flexDirection: 'row-reverse', alignItems: 'center', padding: 16, gap: 12 },
  radioCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleFilled: { borderColor: '#F59E0B' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B' },
  priceInfo: { flex: 1, alignItems: 'flex-end' },
  priceDesc: { fontFamily: 'Heebo_600SemiBold', fontSize: 15, color: '#fff' },
  priceAmount: { fontFamily: 'Heebo_700Bold', fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  purchaseBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  purchaseBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  purchaseBtnText: { fontFamily: 'Heebo_700Bold', fontSize: 18, color: '#fff' },

  restoreBtn: { alignItems: 'center', paddingVertical: 16 },
  restoreBtnText: { fontFamily: 'Heebo_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  legal: {
    fontFamily: 'Heebo_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', lineHeight: 16, paddingHorizontal: 8,
  },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  legalLink: { fontFamily: 'Heebo_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.5)', textDecorationLine: 'underline' },
  legalSep: { fontFamily: 'Heebo_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.3)' },
});
