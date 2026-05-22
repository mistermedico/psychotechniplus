import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActionSheetIOS, Platform, Linking, Switch,
} from 'react-native';
import { Appearance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
import { useAdminStore, ADMIN_EMAIL } from '../../store/adminStore';
import { useSettingsStore, DifficultyOption } from '../../store/settingsStore';
import { TARGETS } from '../../data/mockData';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius } from '../../constants/theme';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  isLast?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  disabled?: boolean;
}

function SettingRow({ icon, label, value, onPress, danger, isLast, toggle, toggleValue, onToggle, disabled }: SettingRowProps) {
  return (
    <Pressable
      onPress={toggle || disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.settingRow,
        isLast && styles.settingRowLast,
        !toggle && !disabled && { opacity: pressed ? 0.72 : 1 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={v => { Haptics.selectionAsync(); onToggle?.(v); }}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: Colors.primary }}
          thumbColor="#fff"
          ios_backgroundColor="rgba(255,255,255,0.15)"
        />
      ) : (
        <Text style={[styles.settingChevron, danger && { color: Colors.danger }]}>‹</Text>
      )}
      <View style={styles.settingLabelWrap}>
        <Text style={[styles.settingLabel, danger && { color: Colors.danger }]}>{label}</Text>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
      </View>
      <View style={[styles.settingIconCircle, danger && styles.settingIconCircleDanger]}>
        <Text style={styles.settingIcon}>{icon}</Text>
      </View>
    </Pressable>
  );
}

const DIFFICULTY_LABELS: Record<string, string> = {
  auto:   'אוטומטי (ELO)',
  easy:   'קל',
  medium: 'בינוני',
  hard:   'קשה',
};

const FONT_SIZE_LABELS: Record<string, string> = {
  small:  'קטן',
  medium: 'בינוני',
  large:  'גדול',
};

const ACHIEVEMENT_BADGES = [
  { icon: '🌱', label: 'סשן ראשון', earned: true },
  { icon: '🔥', label: '7 ימים', earned: false },
  { icon: '🌟', label: '30 ימים', earned: false },
  { icon: '💯', label: 'ניקוד מושלם', earned: false },
  { icon: '⚡', label: 'מהירות', earned: false },
  { icon: '🏆', label: 'נושא הושלם', earned: false },
];

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const {
    name, level, xp: _xp, streak, selectedTargetId,
    totalSessions, totalCorrect, totalAnswered,
    getTopicLevelLabel, reset, signOut, deleteAccount, isPremium,
  } = useUserStore();
  const { hapticsEnabled, theme, defaultDifficulty, questionFontSize, updateSetting } = useSettingsStore();
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleVersionTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/admin');
    } else {
      tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
    }
  };

  const target = TARGETS.find(t => t.id === selectedTargetId) ?? TARGETS[0];
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const mainLevelLabel = getTopicLevelLabel('topic_quantitative');

  const { isAdmin, setIsAdmin } = useAdminStore();
  const email = useUserStore(s => s.email);
  React.useEffect(() => {
    if (email.toLowerCase() === ADMIN_EMAIL && !isAdmin) setIsAdmin(true);
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps
  const showAdmin = isAdmin || email.toLowerCase() === ADMIN_EMAIL;

  const avatarEmoji = ['🧠', '🎯', '🚀', '💎', '🌟'][Math.min(level - 1, 4)];

  const handleSignOut = () => {
    if (signingOut) return;
    Alert.alert('יציאה מהחשבון', 'האם אתה בטוח שברצונך לצאת?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'יציאה', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setSigningOut(true);
          try {
            await signOut();
          } catch (e) {
            // signOut clears local state regardless — continue
          } finally {
            setSigningOut(false);
          }
          router.replace('/landing');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) return;
    Alert.alert(
      'מחיקת חשבון לצמיתות',
      'פעולה זו תמחק את כל הנתונים שלך לצמיתות ולא ניתן לבטלה. האם אתה בטוח?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק חשבון', style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setDeletingAccount(true);
            try {
              const result = await deleteAccount();
              if (result.success) {
                router.replace('/landing');
              } else {
                Alert.alert('שגיאה', result.error ?? 'לא ניתן היה למחוק את החשבון. נסה שנית או פנה לתמיכה.');
              }
            } catch {
              Alert.alert('שגיאה', 'אירעה שגיאה. נסה שנית.');
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleReset = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'איפוס כל הנתונים',
          message: 'האם אתה בטוח? כל ההתקדמות תימחק לצמיתות.',
          options: ['ביטול', 'איפוס'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            reset();
            router.replace('/onboarding');
          }
        }
      );
    } else {
      Alert.alert('איפוס נתונים', 'האם אתה בטוח? כל ההתקדמות תימחק.', [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'איפוס', style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            reset();
            router.replace('/onboarding');
          },
        },
      ]);
    }
  };

  const handleContact = () => {
    Haptics.selectionAsync();
    const url = 'mailto:support@psychotechniplus.com';
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          Linking.openURL(url).catch(() => {
            Alert.alert('צור קשר', 'שלח מייל לכתובת:\nsupport@psychotechniplus.com');
          });
        } else {
          Alert.alert('צור קשר', 'שלח מייל לכתובת:\nsupport@psychotechniplus.com');
        }
      })
      .catch(() => {
        Alert.alert('צור קשר', 'שלח מייל לכתובת:\nsupport@psychotechniplus.com');
      });
  };

  const handleNotifications = () => {
    Haptics.selectionAsync();
    if (Platform.OS !== 'web') {
      Linking.openSettings().catch(() => null);
    } else {
      Alert.alert('התראות', 'לניהול התראות — פתח את הגדרות הדפדפן שלך.');
    }
  };

  const handleThemeToggle = (isDark: boolean) => {
    Haptics.selectionAsync();
    const next: 'dark' | 'light' = isDark ? 'dark' : 'light';
    updateSetting('theme', next);
    if (Platform.OS !== 'web') {
      try { Appearance.setColorScheme(next); } catch {}
    }
  };

  const handleDifficulty = () => {
    Haptics.selectionAsync();
    const options = ['ביטול', 'אוטומטי (ELO)', 'קל', 'בינוני', 'קשה'];
    const values: DifficultyOption[] = ['auto', 'auto', 'easy', 'medium', 'hard'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'רמת קושי ברירת מחדל', options, cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 0) return;
          updateSetting('defaultDifficulty', values[idx]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      );
    } else {
      Alert.alert('רמת קושי', 'בחר רמת קושי ברירת מחדל:', [
        { text: 'ביטול', style: 'cancel' },
        { text: 'אוטומטי (ELO)', onPress: () => updateSetting('defaultDifficulty', 'auto') },
        { text: 'קל', onPress: () => updateSetting('defaultDifficulty', 'easy') },
        { text: 'בינוני', onPress: () => updateSetting('defaultDifficulty', 'medium') },
        { text: 'קשה', onPress: () => updateSetting('defaultDifficulty', 'hard') },
      ]);
    }
  };

  const handleFontSize = () => {
    Haptics.selectionAsync();
    const options = ['ביטול', 'קטן', 'בינוני', 'גדול'];
    const values = ['small', 'medium', 'large'] as const;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'גודל טקסט שאלות', options, cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 0) return;
          updateSetting('questionFontSize', values[idx - 1]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      );
    } else {
      Alert.alert('גודל טקסט', 'בחר גודל טקסט:', [
        { text: 'ביטול', style: 'cancel' },
        { text: 'קטן', onPress: () => updateSetting('questionFontSize', 'small') },
        { text: 'בינוני', onPress: () => updateSetting('questionFontSize', 'medium') },
        { text: 'גדול', onPress: () => updateSetting('questionFontSize', 'large') },
      ]);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#080A12', '#0D1020', '#14102A']}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient orb */}
      <View style={styles.orbTop} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile Hero ── */}
          <View style={styles.profileHero}>
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={[Colors.primary, Colors.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
              </LinearGradient>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{level}</Text>
              </View>
            </View>

            <Text style={styles.profileName}>{name || 'מתאמן'}</Text>
            <Text style={styles.profileEloTitle}>{mainLevelLabel}</Text>
            <Text style={styles.profileEmail}>{email}</Text>

            {isPremium ? (
              <LinearGradient
                colors={['#D97706', '#FBBF24', '#FDE68A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.premiumPill}
              >
                <Text style={styles.premiumPillText}>💎 פרמיום</Text>
              </LinearGradient>
            ) : (
              <View style={styles.freePill}>
                <Text style={styles.freePillText}>⭐ חינמי</Text>
              </View>
            )}

            <View style={styles.heroStats}>
              {[
                { val: String(totalAnswered), lbl: 'שאלות' },
                { val: `${accuracy}%`, lbl: 'דיוק' },
                { val: `${streak}🔥`, lbl: 'רצף' },
                { val: String(totalSessions), lbl: 'סשנים' },
              ].map((s, i, arr) => (
                <React.Fragment key={s.lbl}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatVal}>{s.val}</Text>
                    <Text style={styles.heroStatLbl}>{s.lbl}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.heroStatDivider} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* ── Admin shortcut ── */}
          {showAdmin && (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/admin'); }}
              style={({ pressed }) => [styles.adminCard, { opacity: pressed ? 0.82 : 1 }]}
            >
              <LinearGradient
                colors={[Colors.primaryLighter, 'rgba(124,111,247,0.08)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.adminCardGrad}
              >
                <Text style={styles.adminChevron}>‹</Text>
                <View style={styles.adminCardText}>
                  <Text style={styles.adminCardTitle}>🛠️ פאנל ניהול</Text>
                  <Text style={styles.adminCardSub}>גישה מלאה לניהול המערכת</Text>
                </View>
                <View style={styles.adminBadgeWrap}>
                  <Text style={styles.adminBadge}>מנהל</Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}

          {/* ── Achievements ── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTag}>ACHIEVEMENTS</Text>
            <Text style={styles.sectionTitle}>הישגים</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesScroll}
            directionalLockEnabled
            style={styles.badgesScrollOuter}
          >
            {ACHIEVEMENT_BADGES.map((badge, i) => (
              <View key={i} style={styles.achievementBadge}>
                <View style={[styles.achievementIconWrap, badge.earned ? styles.achievementIconEarned : styles.achievementIconLocked]}>
                  <Text style={[styles.achievementIcon, !badge.earned && { opacity: 0.4 }]}>{badge.icon}</Text>
                </View>
                <Text style={[styles.achievementLabel, !badge.earned && { color: Colors.textTertiary }]}>
                  {badge.label}
                </Text>
                {!badge.earned && <Text style={styles.achievementLock}>🔒</Text>}
              </View>
            ))}
          </ScrollView>

          {/* ── Current Target ── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTag}>TRACK</Text>
            <Text style={styles.sectionTitle}>המסלול שלי</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.targetRow, { opacity: pressed ? 0.78 : 1 }]}
            onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/targets'); }}
          >
            <Text style={styles.settingChevron}>‹</Text>
            <View style={styles.targetInfo}>
              <Text style={styles.targetName}>{target.name}</Text>
              <Text style={styles.targetDesc} numberOfLines={1}>{target.description}</Text>
            </View>
            <View style={styles.targetIconCircle}>
              <Text style={styles.targetIcon}>{target.icon}</Text>
            </View>
          </Pressable>

          {/* ── Settings ── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTag}>SETTINGS</Text>
            <Text style={styles.sectionTitle}>הגדרות</Text>
          </View>

          <View style={styles.settingsCard}>
            <SettingRow
              icon="🔔"
              label="התראות"
              value="הגדרות מכשיר"
              onPress={handleNotifications}
            />
            <SettingRow
              icon={theme === 'dark' ? '🌙' : '☀️'}
              label="מצב תצוגה"
              value={theme === 'dark' ? 'כהה' : 'בהיר'}
              toggle
              toggleValue={theme === 'dark'}
              onToggle={handleThemeToggle}
            />
            <SettingRow
              icon="📊"
              label="קושי ברירת מחדל"
              value={DIFFICULTY_LABELS[defaultDifficulty]}
              onPress={handleDifficulty}
            />
            <SettingRow
              icon="🔡"
              label="גודל טקסט שאלות"
              value={FONT_SIZE_LABELS[questionFontSize]}
              onPress={handleFontSize}
            />
            <SettingRow
              icon="🔊"
              label="רטט והפטיקה"
              toggle
              toggleValue={hapticsEnabled}
              onToggle={v => updateSetting('hapticsEnabled', v)}
              isLast={!showAdmin}
            />
            {showAdmin && (
              <SettingRow
                icon="🖥️"
                label="הגדרות תצוגה מתקדמות"
                onPress={() => { Haptics.selectionAsync(); router.push('/admin/display-settings'); }}
                isLast
              />
            )}
          </View>

          {/* ── Account ── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTag}>ACCOUNT</Text>
            <Text style={styles.sectionTitle}>חשבון</Text>
          </View>

          <View style={styles.settingsCard}>
            <SettingRow
              icon="⭐"
              label="שאלות מועדפות"
              value="בקרוב"
              onPress={() => {
                Haptics.selectionAsync();
                Alert.alert('שאלות מועדפות 🌟', 'פיצ\'ר זה בפיתוח.\n\nבקרוב תוכל לסמן שאלות כמועדפות ולתרגל אותן בנפרד.');
              }}
            />
            <SettingRow
              icon="📝"
              label="ההיסטוריה שלי"
              onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/progress'); }}
            />
            <SettingRow
              icon="💬"
              label="צור קשר ותמיכה"
              onPress={handleContact}
            />
            <SettingRow
              icon="🔒"
              label="מדיניות פרטיות"
              onPress={() => { Haptics.selectionAsync(); router.push('/privacy'); }}
            />
            <SettingRow
              icon="📄"
              label="תנאי שימוש"
              onPress={() => { Haptics.selectionAsync(); router.push('/terms'); }}
              isLast
            />
          </View>

          {/* ── Danger Zone ── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTag}>DANGER ZONE</Text>
            <Text style={[styles.sectionTitle, { color: Colors.danger }]}>פעולות חשבון</Text>
          </View>

          <View style={styles.settingsCard}>
            <SettingRow
              icon="🚪"
              label={signingOut ? 'יוצא...' : 'יציאה מהחשבון'}
              onPress={handleSignOut}
              danger
              disabled={signingOut}
            />
            <SettingRow
              icon="🗑️"
              label="איפוס כל הנתונים"
              onPress={handleReset}
              danger
            />
            <SettingRow
              icon="⛔"
              label={deletingAccount ? 'מוחק חשבון...' : 'מחיקת חשבון לצמיתות'}
              onPress={handleDeleteAccount}
              danger
              disabled={deletingAccount}
              isLast
            />
          </View>

          {/* ── Premium banner ── */}
          {!isPremium && (
            <Pressable
              style={({ pressed }) => [styles.premiumBanner, { opacity: pressed ? 0.82 : 1 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/paywall'); }}
            >
              <LinearGradient
                colors={['#92400E', '#D97706', '#FBBF24']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.premiumBannerGrad}
              >
                <Text style={styles.premiumBannerChevron}>‹</Text>
                <View style={styles.premiumBannerText}>
                  <Text style={styles.premiumBannerTitle}>שדרג לפרמיום 💎</Text>
                  <Text style={styles.premiumBannerSub}>תרגול ללא הגבלה, כל הנושאים, סימולציות</Text>
                </View>
                <Text style={styles.premiumBannerEmoji}>👑</Text>
              </LinearGradient>
            </Pressable>
          )}

          <Pressable onPress={handleVersionTap} style={styles.versionWrap}>
            <Text style={styles.version}>PsychoTechniPlus v1.0.0</Text>
            <Text style={styles.versionSub}>לחץ 5 פעמים לגישת מנהל</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {},

  orbTop: {
    position: 'absolute',
    top: -60, right: -40,
    width: 240, height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primary,
    opacity: 0.08,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    pointerEvents: 'none',
  },

  // Hero
  profileHero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarGradient: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(124,111,247,0.40)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 18, elevation: 12,
  },
  avatarEmoji: { fontSize: 38 },
  levelBadge: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: Colors.warning,
    borderRadius: Radius.full,
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#080A12',
  },
  levelBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },

  profileName: {
    fontFamily: FontFamily.heading, fontSize: FontSize['2xl'],
    color: Colors.text, marginBottom: 3, textAlign: 'center',
  },
  profileEloTitle: {
    fontFamily: FontFamily.medium, fontSize: FontSize.sm,
    color: Colors.primaryLight, marginBottom: 3, textAlign: 'center',
  },
  profileEmail: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, marginBottom: 14, textAlign: 'center',
  },

  premiumPill: { borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 7, marginBottom: 18 },
  premiumPillText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#1C1917' },
  freePill: {
    borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 7, marginBottom: 18,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  freePillText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  heroStats: {
    flexDirection: 'row-reverse',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl, padding: 16,
    width: '100%', borderWidth: 1, borderColor: Colors.border,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text },
  heroStatLbl: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  heroStatDivider: { width: 1, backgroundColor: Colors.border },

  // Section headers
  sectionHeaderRow: { paddingHorizontal: 20, marginTop: 26, marginBottom: 10, alignItems: 'flex-end' },
  sectionTag: {
    fontFamily: FontFamily.semiBold, fontSize: FontSize.xs,
    color: Colors.primaryLight, letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize.xl,
    color: Colors.text, textAlign: 'right',
  },

  // Admin card
  adminCard: {
    marginHorizontal: 20, marginTop: 14,
    borderRadius: Radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(124,111,247,0.30)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  adminCardGrad: { flexDirection: 'row-reverse', alignItems: 'center', padding: 16, gap: 12 },
  adminChevron: { fontFamily: FontFamily.bold, fontSize: 22, color: Colors.textTertiary },
  adminCardText: { flex: 1, alignItems: 'flex-end' },
  adminCardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  adminCardSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  adminBadgeWrap: {
    backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
  },
  adminBadge: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.warning },

  // Achievements
  badgesScrollOuter: { marginHorizontal: -20 },
  badgesScroll: { paddingHorizontal: 20, flexDirection: 'row-reverse', gap: 14, paddingBottom: 4 },
  achievementBadge: { alignItems: 'center', gap: 8, position: 'relative' },
  achievementIconWrap: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  achievementIconEarned: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 2, borderColor: 'rgba(251,191,36,0.50)',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8,
  },
  achievementIconLocked: {
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border,
  },
  achievementIcon: { fontSize: 26 },
  achievementLabel: {
    fontFamily: FontFamily.medium, fontSize: 10,
    color: Colors.textSecondary, textAlign: 'center', maxWidth: 62,
  },
  achievementLock: { fontSize: 11, position: 'absolute', bottom: 24, right: -3 },

  // Target row
  targetRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    backgroundColor: Colors.surface, marginHorizontal: 20,
    borderRadius: Radius.xl, padding: 16, gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  targetIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surfaceStrong, alignItems: 'center', justifyContent: 'center',
  },
  targetIcon: { fontSize: 24 },
  targetInfo: { flex: 1, alignItems: 'flex-end' },
  targetName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  targetDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },

  // Settings cards
  settingsCard: {
    backgroundColor: Colors.surface, marginHorizontal: 20,
    borderRadius: Radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  settingRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12, minHeight: 52,
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceStrong, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  settingIconCircleDanger: { backgroundColor: Colors.dangerLight },
  settingIcon: { fontSize: 17 },
  settingLabelWrap: { flex: 1, alignItems: 'flex-end' },
  settingLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  settingValue: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textTertiary, textAlign: 'right', marginTop: 1,
  },
  settingChevron: { color: Colors.textTertiary, fontSize: 22, fontWeight: '300' },

  // Premium banner
  premiumBanner: { marginHorizontal: 20, marginTop: 26, borderRadius: Radius.xl, overflow: 'hidden',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  premiumBannerGrad: { flexDirection: 'row-reverse', alignItems: 'center', padding: 18, gap: 14 },
  premiumBannerEmoji: { fontSize: 34 },
  premiumBannerText: { flex: 1, alignItems: 'flex-end' },
  premiumBannerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#1C1917', textAlign: 'right' },
  premiumBannerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#44403C', textAlign: 'right', marginTop: 2, lineHeight: 18 },
  premiumBannerChevron: { fontFamily: FontFamily.bold, fontSize: 22, color: 'rgba(28,25,23,0.5)' },

  versionWrap: { alignItems: 'center', marginTop: 24, marginBottom: 8, padding: 12 },
  version: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center' },
  versionSub: { fontFamily: FontFamily.regular, fontSize: 10, color: 'rgba(255,255,255,0.15)', marginTop: 2 },
});
