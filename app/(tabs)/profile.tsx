import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActionSheetIOS, Platform, Linking, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
import { useAdminStore, ADMIN_EMAIL } from '../../store/adminStore';
import { useSettingsStore } from '../../store/settingsStore';
import { TARGETS } from '../../data/mockData';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { eloToTitle } from '../../utils/elo';

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
}

function SettingRow({ icon, label, value, onPress, danger, isLast, toggle, toggleValue, onToggle }: SettingRowProps) {
  return (
    <Pressable
      onPress={toggle ? undefined : onPress}
      style={({ pressed }) => [
        styles.settingRow,
        isLast && styles.settingRowLast,
        !toggle && { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={v => { Haptics.selectionAsync(); onToggle?.(v); }}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: Colors.primary }}
          thumbColor="#fff"
        />
      ) : (
        <Text style={[styles.settingChevron, danger && { color: Colors.danger }]}>←</Text>
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
    getTopicElo, reset, signOut, deleteAccount, isPremium,
  } = useUserStore();
  const { hapticsEnabled, updateSetting } = useSettingsStore();

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
  const mainElo = getTopicElo('topic_quantitative');

  const { isAdmin, setIsAdmin } = useAdminStore();
  const email = useUserStore(s => s.email);
  React.useEffect(() => {
    if (email.toLowerCase() === ADMIN_EMAIL && !isAdmin) setIsAdmin(true);
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps
  const showAdmin = isAdmin || email.toLowerCase() === ADMIN_EMAIL;

  const avatarEmoji = ['🧠', '🎯', '🚀', '💎', '🌟'][Math.min(level - 1, 4)];

  const handleSignOut = () => {
    Alert.alert('יציאה מהחשבון', 'האם אתה בטוח שברצונך לצאת?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'יציאה', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'מחיקת חשבון לצמיתות',
      'פעולה זו תמחק את כל הנתונים שלך לצמיתות ולא ניתן לבטלה. האם אתה בטוח?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק חשבון', style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const result = await deleteAccount();
            if (result.success) {
              router.replace('/auth');
            } else {
              Alert.alert('שגיאה', 'לא ניתן היה למחוק את החשבון. נסה שנית או פנה לתמיכה.');
            }
          },
        },
      ]
    );
  };

  const handleReset = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'איפוס כל הנתונים', message: 'האם אתה בטוח? כל ההתקדמות תימחק לצמיתות.', options: ['ביטול', 'איפוס'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
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
        { text: 'איפוס', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); reset(); router.replace('/onboarding'); } },
      ]);
    }
  };

  return (
    <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={{ flex: 1 }}>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ── Profile Hero ── */}
        <View style={styles.profileHero}>
          <View style={styles.avatarWrap}>
            <LinearGradient colors={['#6366F1', '#A855F7']} style={styles.avatarGradient}>
              <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
            </LinearGradient>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{level}</Text>
            </View>
          </View>

          <Text style={styles.profileName}>{name || 'מתאמן'}</Text>
          <Text style={styles.profileElo}>{eloToTitle(mainElo)}</Text>

          {isPremium ? (
            <LinearGradient
              colors={['#D97706', '#F59E0B', '#FCD34D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
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
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{totalAnswered}</Text>
              <Text style={styles.heroStatLbl}>שאלות</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{accuracy}%</Text>
              <Text style={styles.heroStatLbl}>דיוק</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{streak}🔥</Text>
              <Text style={styles.heroStatLbl}>רצף</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{totalSessions}</Text>
              <Text style={styles.heroStatLbl}>סשנים</Text>
            </View>
          </View>
        </View>

        {/* ── Admin shortcut ── */}
        {showAdmin && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/admin'); }}
            style={({ pressed }) => [styles.adminCard, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient colors={['rgba(99,102,241,0.25)', 'rgba(168,85,247,0.15)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.adminCardGrad}>
              <Text style={styles.adminCardArrow}>←</Text>
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
          <Text style={styles.sectionTitle}>הישגים</Text>
          <Text style={styles.sectionSub}>ACHIEVEMENTS</Text>
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
              <Text style={[styles.achievementLabel, !badge.earned && { color: 'rgba(255,255,255,0.35)' }]}>
                {badge.label}
              </Text>
              {!badge.earned && <Text style={styles.achievementLock}>🔒</Text>}
            </View>
          ))}
        </ScrollView>

        {/* ── Target ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>המסלול שלי</Text>
          <Text style={styles.sectionSub}>TRACK</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.targetRow, { opacity: pressed ? 0.8 : 1 }]}
          onPress={() => router.push('/(tabs)/targets')}
        >
          <Text style={styles.settingChevron}>←</Text>
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
          <Text style={styles.sectionTitle}>הגדרות</Text>
          <Text style={styles.sectionSub}>SETTINGS</Text>
        </View>

        <View style={styles.settingsCard}>
          <SettingRow
            icon="🔔"
            label="התראות"
            value="הגדרות מכשיר"
            onPress={() => { Haptics.selectionAsync(); Linking.openSettings(); }}
          />
          <SettingRow
            icon="🌙"
            label="מצב כהה"
            value="פעיל תמיד"
            onPress={() => { Haptics.selectionAsync(); Alert.alert('מצב כהה', 'האפליקציה פועלת במצב כהה בלבד לחוויה אופטימלית.'); }}
          />
          <SettingRow
            icon="📊"
            label="קושי ברירת מחדל"
            value="אוטומטי (ELO)"
            onPress={() => { Haptics.selectionAsync(); if (showAdmin) router.push('/admin/display-settings'); else Alert.alert('קושי אדפטיבי', 'הקושי מחושב אוטומטית לפי ה-ELO שלך ומשתנה בזמן אמת.'); }}
          />
          <SettingRow
            icon="🔊"
            label="רטט והפטיקה"
            toggle
            toggleValue={hapticsEnabled}
            onToggle={v => updateSetting('hapticsEnabled', v)}
          />
          {showAdmin && (
            <SettingRow icon="🖥️" label="הגדרות תצוגה" onPress={() => { Haptics.selectionAsync(); router.push('/admin/display-settings'); }} isLast />
          )}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>חשבון</Text>
          <Text style={styles.sectionSub}>ACCOUNT</Text>
        </View>

        <View style={styles.settingsCard}>
          <SettingRow
            icon="⭐"
            label="שאלות מועדפות"
            value="בקרוב"
            onPress={() => { Haptics.selectionAsync(); Alert.alert('שאלות מועדפות', 'סמן שאלות כמועדפות ותרגל אותן בנפרד — בקרוב!'); }}
          />
          <SettingRow icon="📝" label="ההיסטוריה שלי" onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/progress'); }} />
          <SettingRow icon="💬" label="צור קשר ותמיכה" onPress={() => { Haptics.selectionAsync(); Linking.openURL('mailto:support@psychotechniplus.com'); }} />
          <SettingRow icon="🔒" label="מדיניות פרטיות" onPress={() => { Haptics.selectionAsync(); router.push('/privacy'); }} />
          <SettingRow icon="📄" label="תנאי שימוש" onPress={() => { Haptics.selectionAsync(); router.push('/terms'); }} />
          <SettingRow icon="🚪" label="יציאה מהחשבון" onPress={handleSignOut} danger />
          <SettingRow icon="🗑️" label="איפוס כל הנתונים" onPress={handleReset} danger />
          <SettingRow icon="⛔" label="מחיקת חשבון לצמיתות" onPress={handleDeleteAccount} danger isLast />
        </View>

        {/* ── Premium upgrade banner ── */}
        {!isPremium && (
          <Pressable
            style={({ pressed }) => [styles.premiumBanner, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/paywall'); }}
          >
            <LinearGradient colors={['#D97706', '#F59E0B', '#FCD34D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.premiumBannerGrad}>
              <Text style={styles.premiumBannerArrow}>←</Text>
              <View style={styles.premiumBannerText}>
                <Text style={styles.premiumBannerTitle}>שדרג לפרמיום 💎</Text>
                <Text style={styles.premiumBannerSub}>תרגול ללא הגבלה, כל הנושאים, סימולציות</Text>
              </View>
              <Text style={styles.premiumBannerEmoji}>👑</Text>
            </LinearGradient>
          </Pressable>
        )}

        <Pressable onPress={handleVersionTap}>
          <Text style={styles.version}>PsychoTechniPlus v1.0.0 · Sprint 1</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: {},

  profileHero: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 28,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    marginBottom: 4,
  },

  avatarWrap: { position: 'relative', marginBottom: 16 },
  avatarGradient: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarEmoji: { fontSize: 38 },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.warning,
    borderRadius: Radius.full,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(6,9,18,0.9)',
  },
  levelBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },

  profileName: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#F1F5F9', marginBottom: 4 },
  profileElo: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginBottom: 14 },

  premiumPill: { borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 7, marginBottom: 20 },
  premiumPillText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#1C1917' },
  freePill: {
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    paddingVertical: 7,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  freePillText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },

  heroStats: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.xl,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#F1F5F9' },
  heroStatLbl: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  sectionHeaderRow: { paddingHorizontal: 20, marginTop: 28, marginBottom: 12, alignItems: 'flex-end' },
  sectionSub: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#818CF8',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  sectionTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: '#F1F5F9', textAlign: 'right' },

  adminCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  adminCardGrad: { flexDirection: 'row-reverse', alignItems: 'center', padding: 18, gap: 12 },
  adminCardArrow: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: 'rgba(255,255,255,0.4)' },
  adminCardText: { flex: 1, alignItems: 'flex-end' },
  adminCardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#F1F5F9' },
  adminCardSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  adminBadgeWrap: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  adminBadge: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#F59E0B' },

  badgesScrollOuter: { marginHorizontal: -20 },
  badgesScroll: { paddingHorizontal: 20, flexDirection: 'row-reverse', gap: 12, paddingBottom: 4 },
  achievementBadge: { alignItems: 'center', gap: 8, position: 'relative' },
  achievementIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  achievementIconEarned: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.5)',
  },
  achievementIconLocked: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  achievementIcon: { fontSize: 26 },
  achievementLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    maxWidth: 60,
  },
  achievementLock: { fontSize: 12, position: 'absolute', bottom: 22, right: -2 },

  targetRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  targetIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetIcon: { fontSize: 24 },
  targetInfo: { flex: 1, alignItems: 'flex-end' },
  targetName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#F1F5F9', textAlign: 'right' },
  targetDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'right',
    marginTop: 2,
  },

  settingsCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  settingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconCircleDanger: { backgroundColor: Colors.dangerLight },
  settingIcon: { fontSize: 17 },
  settingLabelWrap: { flex: 1, alignItems: 'flex-end' },
  settingLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: '#F1F5F9', textAlign: 'right' },
  settingValue: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'right',
    marginTop: 1,
  },
  settingChevron: { color: 'rgba(255,255,255,0.4)', fontSize: FontSize.base },

  premiumBanner: { marginHorizontal: 20, marginTop: 28, borderRadius: Radius.xl, overflow: 'hidden' },
  premiumBannerGrad: { flexDirection: 'row-reverse', alignItems: 'center', padding: 20, gap: 14 },
  premiumBannerEmoji: { fontSize: 36 },
  premiumBannerText: { flex: 1, alignItems: 'flex-end' },
  premiumBannerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#1C1917', textAlign: 'right' },
  premiumBannerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#44403C',
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 18,
  },
  premiumBannerArrow: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: '#1C1917' },

  version: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
});
