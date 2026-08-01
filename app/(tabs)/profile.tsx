import React, { useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Appearance,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
import { ADMIN_EMAIL, useAdminStore } from '../../store/adminStore';
import { DifficultyOption, useSettingsStore } from '../../store/settingsStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius } from '../../constants/theme';
import { AdBanner } from '../../components/AdBanner';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  isLast?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
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
          onValueChange={value => { Haptics.selectionAsync(); onToggle?.(value); }}
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
  auto: 'אוטומטי (ELO)',
  easy: 'קל',
  medium: 'בינוני',
  hard: 'קשה',
};

const FONT_SIZE_LABELS: Record<string, string> = {
  small: 'קטן',
  medium: 'בינוני',
  large: 'גדול',
};

const ACHIEVEMENT_BADGE_DEFS = [
  { icon: '🌱', label: 'סשן ראשון', type: 'first_session' },
  { icon: '🔥', label: '7 ימים', type: 'streak_7' },
  { icon: '🌟', label: '30 ימים', type: 'streak_30' },
  { icon: '💯', label: 'ניקוד מושלם', type: 'perfect_score' },
  { icon: '⚡', label: 'מהירות', type: 'speed_master' },
  { icon: '🏆', label: 'נושא הושלם', type: 'topic_complete' },
];

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const {
    name, level, streak, selectedTargetId,
    totalSessions, totalCorrect, totalAnswered, badges,
    getTopicLevelLabel, reset, signOut, deleteAccount, isPremium,
  } = useUserStore();
  const email = useUserStore(state => state.email);
  const { hapticsEnabled, theme, defaultDifficulty, questionFontSize, updateSetting } = useSettingsStore();
  const { isAdmin, setIsAdmin, targets } = useAdminStore();
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (email.toLowerCase() === ADMIN_EMAIL && !isAdmin) setIsAdmin(true);
  }, [email, isAdmin, setIsAdmin]);

  const showAdmin = isAdmin || email.toLowerCase() === ADMIN_EMAIL;
  const target = targets.find(item => item.id === selectedTargetId) ?? targets[0] ?? null;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const mainLevelLabel = getTopicLevelLabel('topic_quantitative');
  const earnedBadgeTypes = new Set(badges.map(badge => badge.badgeType));
  const achievementBadges = ACHIEVEMENT_BADGE_DEFS.map(badge => ({ ...badge, earned: earnedBadgeTypes.has(badge.type as any) }));
  const avatarEmoji = ['🧠', '🎯', '🚀', '💎', '🌟'][Math.min(Math.max(level - 1, 0), 4)];

  const webConfirm = (message: string) => Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm(message);
  const webAlert = (message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message);
      return true;
    }
    return false;
  };

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

  const handleSignOut = () => {
    if (signingOut) return;
    const performSignOut = async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setSigningOut(true);
      await signOut().catch(() => null);
      router.replace('/landing');
      setSigningOut(false);
    };
    if (Platform.OS === 'web') {
      if (webConfirm('האם אתה בטוח שברצונך לצאת מהחשבון?')) performSignOut();
      return;
    }
    Alert.alert('יציאה מהחשבון', 'האם אתה בטוח שברצונך לצאת?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'יציאה', style: 'destructive', onPress: performSignOut },
    ]);
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) return;
    const performDelete = async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setDeletingAccount(true);
      const result = await deleteAccount().catch(() => ({ success: false, error: 'אירעה שגיאה. נסה שנית.' }));
      if (result.success) {
        router.replace('/landing');
        return;
      }
      setDeletingAccount(false);
      const message = result.error ?? 'לא ניתן היה למחוק את החשבון. נסה שנית או פנה לתמיכה.';
      if (!webAlert(message)) Alert.alert('שגיאה', message);
    };
    const message = 'פעולה זו תמחק את כל הנתונים שלך לצמיתות ולא ניתן לבטלה. האם אתה בטוח?';
    if (Platform.OS === 'web') {
      if (webConfirm(message)) performDelete();
      return;
    }
    Alert.alert('מחיקת חשבון לצמיתות', message, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק חשבון', style: 'destructive', onPress: performDelete },
    ]);
  };

  const handleReset = () => {
    const performReset = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      reset();
      router.replace('/onboarding');
    };
    const message = 'האם אתה בטוח? כל ההתקדמות תימחק.';
    if (Platform.OS === 'web') {
      if (webConfirm(message)) performReset();
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'איפוס כל הנתונים', message, options: ['ביטול', 'איפוס'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        index => { if (index === 1) performReset(); }
      );
      return;
    }
    Alert.alert('איפוס נתונים', message, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'איפוס', style: 'destructive', onPress: performReset },
    ]);
  };

  const handleContact = () => {
    Haptics.selectionAsync();
    router.push('/support' as any);
  };

  const handleNotifications = () => {
    Haptics.selectionAsync();
    if (Platform.OS !== 'web') {
      Linking.openSettings().catch(() => null);
      return;
    }
    Alert.alert('התראות', 'לניהול התראות פתח את הגדרות הדפדפן שלך.');
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
        index => {
          if (index === 0) return;
          updateSetting('defaultDifficulty', values[index]);
        }
      );
      return;
    }
    Alert.alert('רמת קושי', 'בחר רמת קושי ברירת מחדל:', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'אוטומטי (ELO)', onPress: () => updateSetting('defaultDifficulty', 'auto') },
      { text: 'קל', onPress: () => updateSetting('defaultDifficulty', 'easy') },
      { text: 'בינוני', onPress: () => updateSetting('defaultDifficulty', 'medium') },
      { text: 'קשה', onPress: () => updateSetting('defaultDifficulty', 'hard') },
    ]);
  };

  const handleFontSize = () => {
    Haptics.selectionAsync();
    const options = ['ביטול', 'קטן', 'בינוני', 'גדול'];
    const values = ['small', 'medium', 'large'] as const;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'גודל טקסט שאלות', options, cancelButtonIndex: 0 },
        index => {
          if (index === 0) return;
          updateSetting('questionFontSize', values[index - 1]);
        }
      );
      return;
    }
    Alert.alert('גודל טקסט', 'בחר גודל טקסט:', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'קטן', onPress: () => updateSetting('questionFontSize', 'small') },
      { text: 'בינוני', onPress: () => updateSetting('questionFontSize', 'medium') },
      { text: 'גדול', onPress: () => updateSetting('questionFontSize', 'large') },
    ]);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#080A12', '#0D1020', '#14102A']} style={StyleSheet.absoluteFill} />
      <View style={styles.orbTop} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHero}>
            <View style={styles.avatarWrap}>
              <LinearGradient colors={[Colors.primary, Colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarGradient}>
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
              <LinearGradient colors={['#D97706', '#FBBF24', '#FDE68A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.premiumPill}>
                <Text style={styles.premiumPillText}>💎 פרימיום</Text>
              </LinearGradient>
            ) : (
              <View style={styles.freePill}>
                <Text style={styles.freePillText}>⭐ חינמי</Text>
              </View>
            )}

            <Pressable onPress={handleSignOut} disabled={signingOut} style={({ pressed }) => [styles.heroSignOutBtn, pressed && !signingOut && { opacity: 0.78 }, signingOut && { opacity: 0.5 }]}>
              <Text style={styles.heroSignOutText}>{signingOut ? 'יוצא...' : 'יציאה מהחשבון'}</Text>
            </Pressable>

            <View style={styles.heroStats}>
              {[
                { val: String(totalAnswered), lbl: 'שאלות' },
                { val: `${accuracy}%`, lbl: 'דיוק' },
                { val: `${streak}🔥`, lbl: 'רצף' },
                { val: String(totalSessions), lbl: 'סשנים' },
              ].map((stat, index, arr) => (
                <React.Fragment key={stat.lbl}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatVal}>{stat.val}</Text>
                    <Text style={styles.heroStatLbl}>{stat.lbl}</Text>
                  </View>
                  {index < arr.length - 1 && <View style={styles.heroStatDivider} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {showAdmin && (
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/admin'); }} style={({ pressed }) => [styles.adminCard, { opacity: pressed ? 0.82 : 1 }]}>
              <LinearGradient colors={[Colors.primaryLighter, 'rgba(124,111,247,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.adminCardGrad}>
                <Text style={styles.adminChevron}>‹</Text>
                <View style={styles.adminCardText}>
                  <Text style={styles.adminCardTitle}>פאנל ניהול</Text>
                  <Text style={styles.adminCardSub}>גישה מלאה לניהול המערכת</Text>
                </View>
                <View style={styles.adminBadgeWrap}>
                  <Text style={styles.adminBadge}>מנהל</Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}

          <SectionTitle tag="ACHIEVEMENTS" title="הישגים" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll} directionalLockEnabled style={styles.badgesScrollOuter}>
            {achievementBadges.map((badge, index) => (
              <View key={`${badge.type}-${index}`} style={styles.achievementBadge}>
                <View style={[styles.achievementIconWrap, badge.earned ? styles.achievementIconEarned : styles.achievementIconLocked]}>
                  <Text style={[styles.achievementIcon, !badge.earned && { opacity: 0.4 }]}>{badge.icon}</Text>
                </View>
                <Text style={[styles.achievementLabel, !badge.earned && { color: Colors.textTertiary }]}>{badge.label}</Text>
                {!badge.earned && <Text style={styles.achievementLock}>🔒</Text>}
              </View>
            ))}
          </ScrollView>

          <SectionTitle tag="TRACK" title="המסלול שלי" />
          <Pressable style={({ pressed }) => [styles.targetRow, { opacity: pressed ? 0.78 : 1 }]} onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/targets'); }}>
            <Text style={styles.settingChevron}>‹</Text>
            <View style={styles.targetInfo}>
              <Text style={styles.targetName}>{target?.name ?? 'לא נבחר מסלול'}</Text>
              <Text style={styles.targetDesc} numberOfLines={1}>{target?.description ?? 'בחר מסלול כדי להתאים את התרגול'}</Text>
            </View>
            <View style={styles.targetIconCircle}>
              <Text style={styles.targetIcon}>{target?.icon ?? '🎯'}</Text>
            </View>
          </Pressable>

          <SectionTitle tag="SETTINGS" title="הגדרות" />
          <View style={styles.settingsCard}>
            <SettingRow icon="🔔" label="התראות" value="הגדרות מכשיר" onPress={handleNotifications} />
            <SettingRow icon={theme === 'dark' ? '🌙' : '☀️'} label="מצב תצוגה" value={theme === 'dark' ? 'כהה' : 'בהיר'} toggle toggleValue={theme === 'dark'} onToggle={handleThemeToggle} />
            <SettingRow icon="📊" label="קושי ברירת מחדל" value={DIFFICULTY_LABELS[defaultDifficulty]} onPress={handleDifficulty} />
            <SettingRow icon="🔡" label="גודל טקסט שאלות" value={FONT_SIZE_LABELS[questionFontSize]} onPress={handleFontSize} />
            <SettingRow icon="🔊" label="רטט והפטיקה" toggle toggleValue={hapticsEnabled} onToggle={value => updateSetting('hapticsEnabled', value)} isLast={!showAdmin} />
            {showAdmin && (
              <SettingRow icon="🖥️" label="הגדרות תצוגה מתקדמות" onPress={() => { Haptics.selectionAsync(); router.push('/admin/display-settings'); }} isLast />
            )}
          </View>

          <SectionTitle tag="ACCOUNT" title="חשבון" />
          <View style={styles.settingsCard}>
            <SettingRow icon="📈" label="ההיסטוריה שלי" onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/progress'); }} />
            <SettingRow icon="💬" label="צור קשר ותמיכה" onPress={handleContact} />
            <SettingRow icon="🔒" label="מדיניות פרטיות" onPress={() => { Haptics.selectionAsync(); router.push('/privacy'); }} />
            <SettingRow icon="📄" label="תנאי שימוש" onPress={() => { Haptics.selectionAsync(); router.push('/terms'); }} isLast />
          </View>

          <SectionTitle tag="DANGER ZONE" title="פעולות חשבון" danger />
          <View style={styles.settingsCard}>
            <SettingRow icon="🚪" label={signingOut ? 'יוצא...' : 'יציאה מהחשבון'} onPress={handleSignOut} danger disabled={signingOut} />
            <SettingRow icon="🧹" label="איפוס כל הנתונים" onPress={handleReset} danger />
            <SettingRow icon="⛔" label={deletingAccount ? 'מוחק חשבון...' : 'מחיקת חשבון לצמיתות'} onPress={handleDeleteAccount} danger disabled={deletingAccount} isLast />
          </View>

          {!isPremium && (
            <Pressable style={({ pressed }) => [styles.premiumBanner, { opacity: pressed ? 0.82 : 1 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/paywall'); }}>
              <LinearGradient colors={['#92400E', '#D97706', '#FBBF24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.premiumBannerGrad}>
                <Text style={styles.premiumBannerChevron}>‹</Text>
                <View style={styles.premiumBannerText}>
                  <Text style={styles.premiumBannerTitle}>שדרג לפרימיום 💎</Text>
                  <Text style={styles.premiumBannerSub}>תרגול ללא הגבלה, כל הנושאים וסימולציות מלאות</Text>
                </View>
                <Text style={styles.premiumBannerEmoji}>👑</Text>
              </LinearGradient>
            </Pressable>
          )}

          <AdBanner isPremium={isPremium} isAdmin={showAdmin} placement="profile" />

          <Pressable onPress={handleVersionTap} style={styles.versionWrap}>
            <Text style={styles.version}>PsychoTechniPlus v1.0.3</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SectionTitle({ tag, title, danger }: { tag: string; title: string; danger?: boolean }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTag}>{tag}</Text>
      <Text style={[styles.sectionTitle, danger && { color: Colors.danger }]}>{title}</Text>
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
    top: -60,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primary,
    opacity: 0.08,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    pointerEvents: 'none',
  },
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
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(124,111,247,0.40)',
  },
  avatarEmoji: { fontSize: 40 },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  levelBadgeText: { fontFamily: FontFamily.bold, color: '#fff', fontSize: FontSize.xs },
  profileName: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: Colors.text, textAlign: 'center' },
  profileEloTitle: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary, textAlign: 'center', marginTop: 4 },
  profileEmail: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', marginTop: 3 },
  premiumPill: { borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7, marginTop: 12 },
  premiumPillText: { fontFamily: FontFamily.bold, color: '#111827', fontSize: FontSize.sm },
  freePill: {
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  freePillText: { fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: FontSize.sm },
  heroSignOutBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.surfaceSecondary },
  heroSignOutText: { fontFamily: FontFamily.medium, color: Colors.textSecondary, fontSize: FontSize.sm },
  heroStats: {
    marginTop: 18,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    width: '100%',
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.text },
  heroStatLbl: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  heroStatDivider: { width: 1, height: 34, backgroundColor: Colors.border },
  adminCard: { marginHorizontal: 16, marginTop: 14, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.primary + '40' },
  adminCardGrad: { minHeight: 70, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  adminChevron: { fontSize: 28, color: Colors.primary },
  adminCardText: { flex: 1, alignItems: 'flex-end' },
  adminCardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  adminCardSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 3 },
  adminBadgeWrap: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  adminBadge: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },
  sectionHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
  sectionTag: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.textTertiary, letterSpacing: 0 },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right' },
  badgesScrollOuter: { flexGrow: 0 },
  badgesScroll: { flexDirection: 'row-reverse', gap: 12, paddingHorizontal: 16 },
  achievementBadge: {
    width: 94,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    minHeight: 118,
  },
  achievementIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  achievementIconEarned: { backgroundColor: Colors.primaryLighter },
  achievementIconLocked: { backgroundColor: Colors.surfaceSecondary },
  achievementIcon: { fontSize: 24 },
  achievementLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text, textAlign: 'center' },
  achievementLock: { fontSize: 13, marginTop: 4, opacity: 0.6 },
  targetRow: {
    marginHorizontal: 16,
    minHeight: 78,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  targetInfo: { flex: 1, alignItems: 'flex-end' },
  targetName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  targetDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 3 },
  targetIconCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primaryLighter, alignItems: 'center', justifyContent: 'center' },
  targetIcon: { fontSize: 24 },
  settingsCard: {
    marginHorizontal: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingChevron: { fontSize: 25, color: Colors.textTertiary },
  settingLabelWrap: { flex: 1, alignItems: 'flex-end' },
  settingLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  settingValue: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
  settingIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSecondary },
  settingIconCircleDanger: { backgroundColor: Colors.danger + '18' },
  settingIcon: { fontSize: 19 },
  premiumBanner: { marginHorizontal: 16, marginTop: 22, borderRadius: Radius.xl, overflow: 'hidden' },
  premiumBannerGrad: { minHeight: 82, padding: 15, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  premiumBannerChevron: { fontSize: 28, color: '#fff' },
  premiumBannerText: { flex: 1, alignItems: 'flex-end' },
  premiumBannerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff', textAlign: 'right' },
  premiumBannerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.84)', textAlign: 'right', marginTop: 3 },
  premiumBannerEmoji: { fontSize: 30 },
  versionWrap: { alignItems: 'center', paddingVertical: 22 },
  version: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
});
