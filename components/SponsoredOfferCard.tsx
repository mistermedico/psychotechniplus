import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { logger } from '../utils/logger';

const MEITAV_REFERRAL_URL =
  'https://landing.meitav.co.il/he-IL/landing/trade/tradeleadsfreinds?utm_medium=1628B2AC0ABF54EA6D39EEE4CCE8B212';
const LAST_SHOWN_SESSION_KEY = '@psychotechniplus/sponsoredOffer/meitav/lastShownSession';
const DISMISSED_UNTIL_KEY = '@psychotechniplus/sponsoredOffer/meitav/dismissedUntil';
const SHOW_EVERY_SESSIONS = 3;
const DISMISS_DAYS = 7;

interface SponsoredOfferCardProps {
  isPremium: boolean;
  isAdmin?: boolean;
  completedSessions: number;
}

export function SponsoredOfferCard({
  isPremium,
  isAdmin = false,
  completedSessions,
}: SponsoredOfferCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;

    async function decideVisibility() {
      if (isPremium || isAdmin || completedSessions <= 0 || completedSessions % SHOW_EVERY_SESSIONS !== 0) {
        if (active) setVisible(false);
        return;
      }

      const [lastShownValue, dismissedUntilValue] = await Promise.all([
        AsyncStorage.getItem(LAST_SHOWN_SESSION_KEY),
        AsyncStorage.getItem(DISMISSED_UNTIL_KEY),
      ]);
      const dismissedUntil = Number(dismissedUntilValue ?? 0);
      const lastShownSession = Number(lastShownValue ?? 0);

      if (Date.now() < dismissedUntil || lastShownSession === completedSessions) {
        if (active) setVisible(false);
        return;
      }

      await AsyncStorage.setItem(LAST_SHOWN_SESSION_KEY, String(completedSessions));
      if (active) setVisible(true);
    }

    decideVisibility().catch(error => {
      logger.warn('sponsored-offer', `Could not evaluate offer visibility: ${error?.message ?? 'unknown error'}`);
    });

    return () => {
      active = false;
    };
  }, [completedSessions, isAdmin, isPremium]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    const dismissedUntil = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    AsyncStorage.setItem(DISMISSED_UNTIL_KEY, String(dismissedUntil)).catch(() => null);
  };

  const openOffer = async () => {
    try {
      await WebBrowser.openBrowserAsync(MEITAV_REFERRAL_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });
    } catch (error: any) {
      logger.warn('sponsored-offer', `Could not open Meitav offer: ${error?.message ?? 'unknown error'}`);
    }
  };

  const confirmAndOpenOffer = () => {
    Alert.alert(
      'הצעה למבוגרים בלבד',
      'פתיחת חשבון מסחר מיועדת לבני 18 ומעלה. ההטבה כפופה לתנאי מיטב ואינה המלצת השקעה.',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'אני מעל גיל 18', onPress: () => void openOffer() },
      ],
      { cancelable: true },
    );
  };

  return (
    <View style={styles.wrapper} accessibilityLabel="פרסומת ממומנת למיטב טרייד">
      <LinearGradient colors={['#18243B', '#111827']} style={styles.card}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="סגירת הפרסומת"
            hitSlop={12}
            onPress={dismiss}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.adLabel}>פרסומת · קישור שותפים · 18+</Text>
        </View>

        <View style={styles.contentRow}>
          <View style={styles.copy}>
            <Text style={styles.title}>פותחים חשבון במיטב טרייד</Text>
            <Text style={styles.offer}>ומקבלים 100 ש״ח במתנה</Text>
            <Text style={styles.disclaimer}>
              ההטבה והשירות ניתנים על ידי מיטב ובכפוף לתנאי המבצע. השקעות כרוכות בסיכון.
            </Text>
          </View>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>₪</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="לפרטי ההטבה באתר מיטב טרייד"
          onPress={confirmAndOpenOffer}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Text style={styles.ctaText}>לפרטי ההטבה באתר מיטב</Text>
          <Text style={styles.externalIcon}>↗</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 18,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
    padding: 16,
    overflow: 'hidden',
    ...Shadow.md,
  },
  header: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    color: Colors.textSecondary,
    fontSize: 22,
    lineHeight: 24,
  },
  contentRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  copy: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  offer: {
    marginTop: 3,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: '#60A5FA',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  disclaimer: {
    marginTop: 7,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96,165,250,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.45)',
  },
  icon: {
    fontFamily: FontFamily.bold,
    fontSize: 27,
    color: '#93C5FD',
  },
  cta: {
    height: 46,
    marginTop: 15,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
  },
  ctaText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  externalIcon: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
});
