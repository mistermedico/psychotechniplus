import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useUserStore } from '../../store/userStore';
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
}

function SettingRow({ icon, label, value, onPress, danger }: SettingRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
    >
      {/* RTL layout: arrow on the left (LTR coords), icon+label in middle, value on far right */}
      <Text style={[styles.settingArrow, danger && { color: Colors.danger }]}>←</Text>
      <View style={styles.settingLabelWrap}>
        <Text style={[styles.settingLabel, danger && { color: Colors.danger }]}>{label}</Text>
      </View>
      {value ? <Text style={styles.settingValue}>{value}</Text> : null}
      <Text style={styles.settingIcon}>{icon}</Text>
    </Pressable>
  );
}

// Gradient ring avatar: outer gradient view → white padding → inner circle
function AvatarWithRing({ emoji }: { emoji: string }) {
  return (
    <LinearGradient
      colors={['#F59E0B', '#9333EA', '#4F46E5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.avatarRing}
    >
      <View style={styles.avatarRingInner}>
        <Text style={styles.avatarEmoji}>{emoji}</Text>
      </View>
    </LinearGradient>
  );
}

export default function ProfileTab() {
  const {
    name, level, xp, streak, selectedTargetId,
    totalSessions, totalCorrect, totalAnswered,
    getTopicElo, reset,
  } = useUserStore();

  // Secret admin entry: tap version text 5 times within 2 seconds each
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

  const avatarEmoji = ['🧠', '🎯', '🚀', '💎', '🌟'][Math.min(level - 1, 4)];

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
      Alert.alert(
        'איפוס נתונים',
        'האם אתה בטוח? כל ההתקדמות תימחק.',
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'איפוס',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              reset();
              router.replace('/onboarding');
            },
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Profile hero */}
        <LinearGradient
          colors={Colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHero}
        >
          <AvatarWithRing emoji={avatarEmoji} />
          <Text style={styles.profileName}>{name || 'מתאמן'}</Text>
          <Text style={styles.profileLevel}>רמה {level} · {eloToTitle(mainElo)}</Text>
          {/* ELO prominently displayed */}
          <Text style={styles.profileElo}>{mainElo} ELO</Text>

          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <Text style={styles.profileStatVal}>{streak}🔥</Text>
              <Text style={styles.profileStatLbl}>רצף</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatVal}>{totalSessions}</Text>
              <Text style={styles.profileStatLbl}>סשנים</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatVal}>{accuracy}%</Text>
              <Text style={styles.profileStatLbl}>דיוק</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Subscription card */}
        <View style={styles.subCard}>
          <View style={styles.subLeft}>
            <Text style={styles.subPlanLabel}>תוכנית נוכחית</Text>
            <Text style={styles.subPlan}>⭐ חינמי</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('בקרוב!', 'מנוי פרמיום בקרוב 💎');
            }}
          >
            <Text style={styles.upgradeBtnText}>שדרג לפרמיום 💎</Text>
          </Pressable>
        </View>

        {/* Target */}
        <Text style={styles.sectionTitle}>המסלול שלי</Text>
        <View style={styles.targetRow}>
          <Text style={styles.targetIcon}>{target.icon}</Text>
          <View style={styles.targetInfo}>
            <Text style={styles.targetName}>{target.name}</Text>
            <Text style={styles.targetDesc}>{target.description}</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/targets')}>
            <Text style={styles.changeBtn}>שנה</Text>
          </Pressable>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>הגדרות</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            icon="🔔"
            label="התראות"
            value="פעיל"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('התראות', 'ניהול התראות יהיה זמין בקרוב');
            }}
          />
          <SettingRow
            icon="🌙"
            label="מצב לילה"
            value="כבוי"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('מצב לילה', 'מצב לילה יהיה זמין בקרוב');
            }}
          />
          <SettingRow
            icon="📊"
            label="קושי ברירת מחדל"
            value="אוטומטי"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('קושי', 'הקושי מחושב אוטומטית על בסיס ה-ELO שלך');
            }}
          />
          <SettingRow
            icon="🔊"
            label="קול והפטיקה"
            value="פעיל"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('קול והפטיקה', 'ניהול קול יהיה זמין בקרוב');
            }}
          />
        </View>

        <Text style={styles.sectionTitle}>חשבון</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            icon="⭐"
            label="שאלות מועדפות"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('מועדפות', 'אפשרות זו תהיה זמינה בקרוב');
            }}
          />
          <SettingRow
            icon="📝"
            label="ההיסטוריה שלי"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('היסטוריה', 'היסטוריית סשנים תהיה זמינה בקרוב');
            }}
          />
          <SettingRow
            icon="💬"
            label="צור קשר ותמיכה"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('תמיכה', 'שלח אימייל: support@psychotechniplus.com');
            }}
          />
          <SettingRow
            icon="📄"
            label="תנאי שימוש ופרטיות"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('תנאי שימוש', 'תנאי השימוש זמינים באתר שלנו');
            }}
          />
          <SettingRow
            icon="🗑️"
            label="איפוס כל הנתונים"
            onPress={handleReset}
            danger
          />
        </View>

        <Pressable onPress={handleVersionTap}>
          <Text style={styles.version}>PsychoTechniPlus v1.0.0 · Sprint 1</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  profileHero: {
    padding: 24,
    paddingBottom: 28,
    alignItems: 'center',
  },

  // Gradient ring around avatar
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    padding: 3,
  },
  avatarRingInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 40 },

  profileName: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
    marginBottom: 4,
  },
  profileLevel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
  },
  // Prominent ELO number
  profileElo: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['3xl'],
    color: '#fff',
    marginBottom: 18,
    letterSpacing: 1,
  },

  profileStats: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.lg,
    padding: 14,
    width: '100%',
  },
  profileStat: { flex: 1, alignItems: 'center' },
  profileStatVal: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: '#fff' },
  profileStatLbl: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  profileStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },

  subCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subLeft: { alignItems: 'flex-end' },
  subPlanLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  subPlan: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, marginTop: 2 },
  upgradeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...Shadow.primary,
  },
  upgradeBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 8,
  },

  targetRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 12,
    ...Shadow.sm,
    marginBottom: 8,
  },
  targetIcon: { fontSize: 32 },
  targetInfo: { flex: 1, alignItems: 'flex-end' },
  targetName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  targetDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 2,
  },
  changeBtn: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },

  settingsCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // RTL row: arrow (←) on the left end, label in the flex center, value then icon on the right
  settingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  settingIcon: { fontSize: 20 },
  settingLabelWrap: { flex: 1, alignItems: 'flex-end' },
  settingLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  settingValue: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  // The ← chevron sits on the leftmost end of the RTL row
  settingArrow: { color: Colors.textTertiary, fontSize: FontSize.base },

  version: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
});
