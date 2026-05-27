import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, TextInput, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, AppConfig, AppControlPreset, APP_CONTROL_PRESETS } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const FEATURE_META: { key: keyof AppConfig['featureFlags']; icon: string; label: string; desc: string }[] = [
  { key: 'speedMode',     icon: '⚡', label: 'מצב מהירות',      desc: 'תרגול תחת לחץ זמן' },
  { key: 'streakMode',    icon: '🔥', label: 'רצפים',            desc: 'מעקב ימי תרגול רצופים' },
  { key: 'simulations',   icon: '🏆', label: 'סימולציות',         desc: 'מבחנים מלאים ומבחנים חכמים' },
  { key: 'leaderboard',   icon: '🏅', label: 'לוח מובילים',       desc: 'דירוג משתמשים ציבורי' },
  { key: 'socialSharing', icon: '📤', label: 'שיתוף חברתי',       desc: 'שיתוף תוצאות ברשתות' },
  { key: 'dailyChallenge',icon: '🎯', label: 'אתגר יומי',         desc: 'שאלת אתגר יומית עם בונוס XP' },
];

const ANNOUNCEMENT_LEVELS: { value: AppConfig['announcementLevel']; label: string; color: string }[] = [
  { value: 'info',     label: 'מידע',   color: Colors.primary },
  { value: 'warning',  label: 'אזהרה',  color: Colors.warning },
  { value: 'critical', label: 'דחוף',   color: Colors.danger },
];

const PRESET_META: Array<{ key: AppControlPreset; icon: string; title: string; desc: string; tone: string }> = [
  { key: 'normal', icon: 'OK', title: 'שגרה', desc: 'כללי שימוש רגילים', tone: Colors.success },
  { key: 'launch', icon: 'GO', title: 'השקה', desc: 'פותח את רוב היכולות', tone: Colors.primary },
  { key: 'contentFreeze', icon: 'QA', title: 'בקרת תוכן', desc: 'מגביל תרגול בזמן בדיקות', tone: Colors.warning },
  { key: 'maintenance', icon: '!', title: 'תחזוקה', desc: 'חוסם כניסה ומכבה פיצ׳רים', tone: Colors.danger },
];

export default function AppControlScreen() {
  const {
    appConfig, setAppConfig, setFeatureFlag,
    applyAppControlPreset, resetAppConfig, getStats, activityLog,
  } = useAdminStore();

  const [announcementDraft, setAnnouncementDraft] = useState(appConfig.announcementText);
  const [freeSessionsInput, setFreeSessionsInput] = useState(String(appConfig.freeSessionsPerDay));
  const [cooldownInput, setCooldownInput] = useState(String(appConfig.sessionCooldownMinutes));
  const [showPreview, setShowPreview] = useState(false);

  const stats = getStats();
  const activeFeatureCount = Object.values(appConfig.featureFlags).filter(Boolean).length;
  const healthItems = [
    { label: 'שאלות מאושרות', value: `${stats.validatedCount}/${stats.totalQuestions}`, color: stats.validatedCount > 0 ? Colors.success : Colors.warning },
    { label: 'ממתינות לאישור', value: String(stats.pendingCount), color: stats.pendingCount > 0 ? Colors.warning : Colors.success },
    { label: 'פיצ׳רים פעילים', value: `${activeFeatureCount}/${FEATURE_META.length}`, color: activeFeatureCount >= 4 ? Colors.success : Colors.warning },
    { label: 'פעולות ביומן', value: String(activityLog.length), color: Colors.primary },
  ];

  const handleSaveAnnouncement = () => {
    setAppConfig({ announcementText: announcementDraft.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✅ נשמר', 'ההכרזה עודכנה');
  };

  const handleSaveLimits = () => {
    const sessions = parseInt(freeSessionsInput, 10);
    const cooldown = parseInt(cooldownInput, 10);
    if (isNaN(sessions) || sessions < 1 || sessions > 100) {
      Alert.alert('שגיאה', 'סשנים ליום: 1–100'); return;
    }
    if (isNaN(cooldown) || cooldown < 0 || cooldown > 120) {
      Alert.alert('שגיאה', 'הפסקה בין סשנים: 0–120 דקות'); return;
    }
    setAppConfig({ freeSessionsPerDay: sessions, sessionCooldownMinutes: cooldown });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✅ נשמר', 'מגבלות עודכנו');
  };

  const handleMaintenanceToggle = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (val) {
      Alert.alert(
        '⚠️ הפעלת מצב תחזוקה',
        'משתמשים לא יוכלו להיכנס לאפליקציה. להמשיך?',
        [
          { text: 'ביטול', style: 'cancel' },
          { text: 'הפעל', style: 'destructive', onPress: () => setAppConfig({ maintenanceMode: true }) },
        ],
      );
    } else {
      setAppConfig({ maintenanceMode: false });
    }
  };

  const handleApplyPreset = (preset: AppControlPreset) => {
    const presetInfo = PRESET_META.find(p => p.key === preset);
    Alert.alert(
      'הפעלת פריסט',
      `להחיל את פריסט "${presetInfo?.title ?? APP_CONTROL_PRESETS[preset].label}" על מרכז השליטה?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הפעל',
          onPress: () => {
            applyAppControlPreset(preset);
            const next = APP_CONTROL_PRESETS[preset].config;
            setAnnouncementDraft(next.announcementText);
            setFreeSessionsInput(String(next.freeSessionsPerDay));
            setCooldownInput(String(next.sessionCooldownMinutes));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  const handleResetConfig = () => {
    Alert.alert(
      'איפוס מרכז השליטה',
      'להחזיר את מצב האפליקציה, ההכרזה, המגבלות ודגלי הפיצ׳רים לברירת מחדל?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אפס',
          style: 'destructive',
          onPress: () => {
            resetAppConfig();
            setAnnouncementDraft('');
            setFreeSessionsInput('10');
            setCooldownInput('0');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  const announcementColor =
    appConfig.announcementLevel === 'critical' ? Colors.danger :
    appConfig.announcementLevel === 'warning' ? Colors.warning : Colors.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎮 מרכז שליטה</Text>
        <Text style={styles.headerSub}>ניהול מלא על מצב האפליקציה</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── App Status ── */}
        <View style={[styles.statusBanner, { backgroundColor: appConfig.maintenanceMode ? Colors.danger + '20' : Colors.success + '15', borderColor: appConfig.maintenanceMode ? Colors.danger + '50' : Colors.success + '40' }]}>
          <View style={styles.statusBannerInner}>
            <Text style={styles.statusIcon}>{appConfig.maintenanceMode ? '🔴' : '🟢'}</Text>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: appConfig.maintenanceMode ? Colors.danger : Colors.success }]}>
                {appConfig.maintenanceMode ? 'אפליקציה במצב תחזוקה' : 'אפליקציה פעילה'}
              </Text>
              <Text style={styles.statusDesc}>
                {appConfig.maintenanceMode
                  ? 'משתמשים רגילים חסומים מהכניסה'
                  : 'כל המשתמשים יכולים להיכנס'}
              </Text>
            </View>
            <Switch
              value={appConfig.maintenanceMode}
              onValueChange={handleMaintenanceToggle}
              trackColor={{ false: '#334155', true: Colors.danger }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── Registration ── */}
        <Text style={styles.sectionTitle}>פריסטים תפעוליים</Text>
        <View style={styles.presetsGrid}>
          {PRESET_META.map(preset => (
            <Pressable
              key={preset.key}
              onPress={() => handleApplyPreset(preset.key)}
              style={({ pressed }) => [
                styles.presetCard,
                { borderColor: preset.tone + '55' },
                pressed && { opacity: 0.82 },
              ]}
            >
              <View style={[styles.presetIconWrap, { backgroundColor: preset.tone + '18' }]}>
                <Text style={[styles.presetIcon, { color: preset.tone }]}>{preset.icon}</Text>
              </View>
              <Text style={styles.presetTitle}>{preset.title}</Text>
              <Text style={styles.presetDesc}>{preset.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>בריאות מערכת</Text>
        <View style={styles.healthGrid}>
          {healthItems.map(item => (
            <View key={item.label} style={styles.healthCard}>
              <Text style={[styles.healthValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.healthLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>🔐 הרשמות</Text>
          </View>
          <View style={styles.switchRowCard}>
            <Switch
              value={appConfig.registrationOpen}
              onValueChange={val => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAppConfig({ registrationOpen: val });
              }}
              trackColor={{ false: '#334155', true: Colors.primary }}
              thumbColor="#fff"
            />
            <View style={styles.switchLabelGroup}>
              <Text style={styles.switchLabelMain}>הרשמת משתמשים חדשים</Text>
              <Text style={styles.switchLabelSub}>
                {appConfig.registrationOpen ? 'פתוחה לכולם' : 'חסומה — משתמשים קיימים בלבד'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Announcements ── */}
        <Text style={styles.sectionTitle}>📢 הכרזות</Text>
        <View style={styles.card}>
          <View style={styles.switchRowCard}>
            <Switch
              value={appConfig.announcementEnabled}
              onValueChange={val => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAppConfig({ announcementEnabled: val });
              }}
              trackColor={{ false: '#334155', true: announcementColor }}
              thumbColor="#fff"
            />
            <Text style={styles.switchLabelMain}>הצג הכרזה למשתמשים</Text>
          </View>

          <View style={styles.divider} />

          {/* Level picker */}
          <View style={styles.levelRow}>
            {ANNOUNCEMENT_LEVELS.map(l => (
              <Pressable
                key={l.value}
                onPress={() => setAppConfig({ announcementLevel: l.value })}
                style={[
                  styles.levelChip,
                  appConfig.announcementLevel === l.value && { backgroundColor: l.color + '25', borderColor: l.color },
                ]}
              >
                <Text style={[styles.levelChipText, appConfig.announcementLevel === l.value && { color: l.color }]}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          <TextInput
            style={styles.announcementInput}
            value={announcementDraft}
            onChangeText={setAnnouncementDraft}
            placeholder="כתוב טקסט הכרזה כאן..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            textAlign="right"
            textAlignVertical="top"
            numberOfLines={3}
          />

          {announcementDraft.trim().length > 0 && (
            <Pressable onPress={() => setShowPreview(true)} style={styles.previewBtn}>
              <Text style={styles.previewBtnText}>👁 תצוגה מקדימה</Text>
            </Pressable>
          )}

          <Pressable onPress={handleSaveAnnouncement} style={styles.saveSmallBtn}>
            <LinearGradient colors={Colors.gradients.primary} style={styles.saveSmallBtnGrad}>
              <Text style={styles.saveSmallBtnText}>שמור הכרזה</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Feature Flags ── */}
        <Text style={styles.sectionTitle}>🚩 דגלי פיצ׳רים</Text>
        <View style={styles.featuresGrid}>
          {FEATURE_META.map(f => {
            const enabled = appConfig.featureFlags[f.key];
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFeatureFlag(f.key, !enabled);
                }}
                style={[styles.featureCard, enabled && styles.featureCardOn]}
              >
                <View style={styles.featureCardTop}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <View style={[styles.featureDot, { backgroundColor: enabled ? Colors.success : Colors.textTertiary }]} />
                </View>
                <Text style={[styles.featureLabel, enabled && { color: Colors.text }]}>{f.label}</Text>
                <Text style={styles.featureDesc} numberOfLines={2}>{f.desc}</Text>
                <Text style={[styles.featureState, { color: enabled ? Colors.success : Colors.danger }]}>
                  {enabled ? 'מופעל' : 'כבוי'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Rate Limits ── */}
        <Text style={styles.sectionTitle}>⏱️ מגבלות סשנים</Text>
        <View style={styles.card}>
          <View style={styles.limitRow}>
            <View style={styles.limitInput}>
              <TextInput
                style={styles.numInput}
                value={freeSessionsInput}
                onChangeText={setFreeSessionsInput}
                keyboardType="numeric"
                textAlign="center"
              />
              <Text style={styles.limitUnit}>סשנים</Text>
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>מקסימום סשנים ליום (חינמי)</Text>
              <Text style={styles.limitDesc}>כמה סשנים משתמש חינמי יכול לבצע ביום</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.limitRow}>
            <View style={styles.limitInput}>
              <TextInput
                style={styles.numInput}
                value={cooldownInput}
                onChangeText={setCooldownInput}
                keyboardType="numeric"
                textAlign="center"
              />
              <Text style={styles.limitUnit}>דקות</Text>
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>הפסקה בין סשנים</Text>
              <Text style={styles.limitDesc}>0 = ללא הגבלה</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.limitRow}>
            <View style={styles.limitInput}>
              <TextInput
                style={styles.numInput}
                value={String(appConfig.leaderboardVisible)}
                editable={false}
                textAlign="center"
              />
            </View>
            <View style={[styles.limitInfo, { flex: 1 }]}>
              <View style={styles.switchRowCard}>
                <Switch
                  value={appConfig.leaderboardVisible}
                  onValueChange={val => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setAppConfig({ leaderboardVisible: val });
                  }}
                  trackColor={{ false: '#334155', true: Colors.primary }}
                  thumbColor="#fff"
                />
                <View style={styles.switchLabelGroup}>
                  <Text style={styles.limitLabel}>לוח מובילים גלוי</Text>
                  <Text style={styles.limitDesc}>האם הדירוג גלוי למשתמשים</Text>
                </View>
              </View>
            </View>
          </View>

          <Pressable onPress={handleSaveLimits} style={[styles.saveSmallBtn, { marginTop: 4 }]}>
            <LinearGradient colors={Colors.gradients.primary} style={styles.saveSmallBtnGrad}>
              <Text style={styles.saveSmallBtnText}>שמור מגבלות</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Current Status Summary ── */}
        <Text style={styles.sectionTitle}>פעולות וסיכום הגדרות</Text>
        <View style={styles.actionsPanel}>
          <Pressable
            onPress={() => handleApplyPreset('maintenance')}
            style={({ pressed }) => [styles.systemActionBtn, { borderColor: Colors.danger + '60' }, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.systemActionTitle, { color: Colors.danger }]}>כניסה מהירה לתחזוקה</Text>
            <Text style={styles.systemActionDesc}>חוסם רישום, מכבה פיצ׳רים ומציג הודעה קריטית.</Text>
          </Pressable>
          <Pressable
            onPress={() => handleApplyPreset('normal')}
            style={({ pressed }) => [styles.systemActionBtn, { borderColor: Colors.success + '60' }, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.systemActionTitle, { color: Colors.success }]}>חזרה לשגרה</Text>
            <Text style={styles.systemActionDesc}>מחזיר זמינות מלאה לפי ברירת המחדל.</Text>
          </Pressable>
          <Pressable
            onPress={handleResetConfig}
            style={({ pressed }) => [styles.resetConfigBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.resetConfigText}>אפס את כל הגדרות מרכז השליטה</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          {[
            { label: 'מצב תחזוקה', value: appConfig.maintenanceMode ? 'פעיל 🔴' : 'כבוי 🟢' },
            { label: 'הרשמות', value: appConfig.registrationOpen ? 'פתוחות ✅' : 'חסומות 🚫' },
            { label: 'הכרזה', value: appConfig.announcementEnabled ? `פעילה — ${appConfig.announcementLevel}` : 'כבויה' },
            { label: 'סשנים/יום (חינמי)', value: String(appConfig.freeSessionsPerDay) },
            { label: 'הפסקה', value: appConfig.sessionCooldownMinutes > 0 ? `${appConfig.sessionCooldownMinutes} דקות` : 'ללא' },
            { label: 'פיצ׳רים פעילים', value: String(Object.values(appConfig.featureFlags).filter(Boolean).length) + '/' + String(FEATURE_META.length) },
          ].map((row, i) => (
            <View key={i} style={[styles.summaryRow, i < 5 && styles.summaryRowBorder]}>
              <Text style={styles.summaryValue}>{row.value}</Text>
              <Text style={styles.summaryLabel}>{row.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Announcement preview modal */}
      <Modal visible={showPreview} transparent animationType="fade" onRequestClose={() => setShowPreview(false)}>
        <Pressable style={styles.previewOverlay} onPress={() => setShowPreview(false)}>
          <View style={[styles.previewBanner, { borderColor: announcementColor, backgroundColor: announcementColor + '15' }]}>
            <Text style={[styles.previewBannerText, { color: announcementColor }]}>
              {appConfig.announcementLevel === 'critical' ? '🚨' : appConfig.announcementLevel === 'warning' ? '⚠️' : 'ℹ️'}
              {'  '}{announcementDraft.trim()}
            </Text>
            <Text style={styles.previewNote}>תצוגה מקדימה — כך זה יראה למשתמשים</Text>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 16, paddingBottom: 20 },
  back: { marginBottom: 10 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 3 },
  content: { padding: 16, paddingBottom: 40, gap: 4 },
  sectionTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize.base, color: Colors.text,
    textAlign: 'right', marginTop: 16, marginBottom: 8,
  },

  statusBanner: {
    borderRadius: Radius.xl, borderWidth: 1.5, padding: 16, marginBottom: 8,
  },
  statusBannerInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  statusIcon: { fontSize: 28 },
  statusInfo: { flex: 1, alignItems: 'flex-end' },
  statusTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
  statusDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  presetsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  presetCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'flex-end',
    gap: 6,
    ...Shadow.sm,
  },
  presetIconWrap: {
    minWidth: 34,
    height: 28,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetIcon: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  presetTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  presetDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', lineHeight: 17 },

  healthGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  healthCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'flex-end',
  },
  healthValue: { fontFamily: FontFamily.heading, fontSize: FontSize.xl },
  healthLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm, overflow: 'hidden',
  },
  cardHeaderRow: { flexDirection: 'row-reverse', alignItems: 'center', padding: 16, paddingBottom: 8 },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },

  switchRowCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  switchLabelGroup: { flex: 1, alignItems: 'flex-end' },
  switchLabelMain: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text },
  switchLabelSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  levelRow: {
    flexDirection: 'row-reverse', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  levelChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
  },
  levelChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  announcementInput: {
    margin: 16, marginTop: 8, backgroundColor: Colors.background, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text,
    minHeight: 80,
  },
  previewBtn: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  previewBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  saveSmallBtn: { margin: 16, marginTop: 8, borderRadius: Radius.lg, overflow: 'hidden' },
  saveSmallBtnGrad: { paddingVertical: 12, alignItems: 'center' },
  saveSmallBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  featuresGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    width: '47%', backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 4, ...Shadow.sm,
  },
  featureCardOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLighter },
  featureCardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  featureIcon: { fontSize: 24 },
  featureDot: { width: 8, height: 8, borderRadius: 4 },
  featureLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  featureDesc: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'right' },
  featureState: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, marginTop: 4 },

  limitRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  limitInput: { alignItems: 'center', gap: 4 },
  numInput: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8,
    fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text,
    minWidth: 60, textAlign: 'center',
  },
  limitUnit: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
  limitInfo: { flex: 1, alignItems: 'flex-end' },
  limitLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  limitDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2, textAlign: 'right' },

  actionsPanel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 10,
    marginBottom: 12,
    ...Shadow.sm,
  },
  systemActionBtn: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    backgroundColor: Colors.background,
    padding: 12,
    alignItems: 'flex-end',
  },
  systemActionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, textAlign: 'right' },
  systemActionDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 3 },
  resetConfigBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
  },
  resetConfigText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingHorizontal: 16 },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },
  summaryValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  previewBanner: {
    width: '100%', borderRadius: Radius.xl, borderWidth: 2,
    padding: 20, gap: 8,
  },
  previewBannerText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, textAlign: 'right', lineHeight: 24 },
  previewNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center' },
});
