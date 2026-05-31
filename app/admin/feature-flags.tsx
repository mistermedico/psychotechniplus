import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, AppConfig } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

// ── Feature flag metadata ────────────────────────────────────────────────────

type FlagKey = keyof AppConfig['featureFlags'];

const FLAG_META: { key: FlagKey; label: string; desc: string }[] = [
  { key: 'speedMode',       label: 'מצב מהירות',      desc: 'תרגול בטיימר עם בונוס XP' },
  { key: 'streakMode',      label: 'מצב רצף',         desc: 'מחרוזת תשובות נכונות ברצף' },
  { key: 'simulations',     label: 'סימולציות',        desc: 'מבחני סימולציה מלאים' },
  { key: 'leaderboard',     label: 'לוח מובילים',      desc: 'טבלת דירוג משתמשים' },
  { key: 'socialSharing',   label: 'שיתוף חברתי',     desc: 'שיתוף תוצאות ברשתות חברתיות' },
  { key: 'dailyChallenge',  label: 'אתגר יומי',        desc: 'שאלה יומית עם XP מיוחד' },
  { key: 'adaptiveLearning',label: 'למידה אדפטיבית',   desc: 'אלגוריתם שמתאים קושי אוטומטית' },
  { key: 'aiHints',         label: 'רמזי AI',          desc: 'רמזים מבוססי בינה מלאכותית' },
  { key: 'referralProgram', label: 'תוכנית הפניות',    desc: 'הפניות חברים עם פרסים' },
];

export default function FeatureFlagsScreen() {
  const { appConfig, setAppConfig, setFeatureFlag } = useAdminStore();

  const [minVersion, setMinVersion]             = useState(appConfig.minAppVersion ?? '1.0.0');
  const [maxFreeTotal, setMaxFreeTotal]         = useState(String(appConfig.maxFreeQuestionsTotal ?? 500));
  const [freeSessionsDay, setFreeSessionsDay]   = useState(String(appConfig.freeSessionsPerDay));
  const [cooldown, setCooldown]                 = useState(String(appConfig.sessionCooldownMinutes));
  const [supportEmail, setSupportEmail]         = useState(appConfig.supportEmail ?? 'support@psychotechniplus.com');
  const [regMessage, setRegMessage]             = useState(appConfig.registrationMessage ?? '');

  const handleSave = () => {
    const parsedMaxFree = parseInt(maxFreeTotal, 10);
    const parsedSessions = parseInt(freeSessionsDay, 10);
    const parsedCooldown = parseInt(cooldown, 10);

    if (!minVersion.trim()) { Alert.alert('שגיאה', 'גרסה מינימלית לא יכולה להיות ריקה'); return; }
    if (isNaN(parsedMaxFree) || parsedMaxFree < 1) { Alert.alert('שגיאה', 'מקסימום שאלות חינמי חייב להיות מספר חיובי'); return; }
    if (isNaN(parsedSessions) || parsedSessions < 0) { Alert.alert('שגיאה', 'סשנים ביום חייב להיות 0 ומעלה'); return; }
    if (isNaN(parsedCooldown) || parsedCooldown < 0) { Alert.alert('שגיאה', 'זמן קירור חייב להיות 0 ומעלה'); return; }
    if (!supportEmail.includes('@')) { Alert.alert('שגיאה', 'כתובת מייל תמיכה אינה תקינה'); return; }

    setAppConfig({
      minAppVersion: minVersion.trim(),
      maxFreeQuestionsTotal: parsedMaxFree,
      freeSessionsPerDay: parsedSessions,
      sessionCooldownMinutes: parsedCooldown,
      supportEmail: supportEmail.trim(),
      registrationMessage: regMessage.trim(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✅ נשמר', 'ההגדרות עודכנו בהצלחה');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🚩 דגלי פיצ׳ר</Text>
        <Text style={styles.headerSub}>הפעלה/כיבוי של פיצ׳רים ומגבלות גישה</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Feature flags */}
        <Text style={styles.sectionTitle}>דגלי פיצ׳ר</Text>
        <View style={styles.card}>
          {FLAG_META.map((flag, index) => (
            <React.Fragment key={flag.key}>
              <FlagRow
                label={flag.label}
                desc={flag.desc}
                value={appConfig.featureFlags[flag.key]}
                onToggle={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFeatureFlag(flag.key, val);
                }}
              />
              {index < FLAG_META.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Limits & access */}
        <Text style={styles.sectionTitle}>מגבלות וגישה</Text>
        <View style={styles.card}>
          <SettingInput
            label="גרסת אפליקציה מינימלית"
            value={minVersion}
            onChange={setMinVersion}
            placeholder="1.0.0"
          />
          <View style={styles.divider} />
          <SettingInput
            label="מקסימום שאלות חינמיות (סה״כ)"
            value={maxFreeTotal}
            onChange={setMaxFreeTotal}
            keyboardType="numeric"
            suffix="שאלות"
          />
          <View style={styles.divider} />
          <SettingInput
            label="סשנים חינמיים ביום"
            value={freeSessionsDay}
            onChange={setFreeSessionsDay}
            keyboardType="numeric"
            suffix="סשנים"
          />
          <View style={styles.divider} />
          <SettingInput
            label="זמן קירור בין סשנים"
            value={cooldown}
            onChange={setCooldown}
            keyboardType="numeric"
            suffix="דקות"
          />
        </View>

        {/* Support & registration */}
        <Text style={styles.sectionTitle}>תמיכה ורישום</Text>
        <View style={styles.card}>
          <SettingInput
            label="מייל תמיכה"
            value={supportEmail}
            onChange={setSupportEmail}
            keyboardType="email-address"
            placeholder="support@example.com"
          />
          <View style={styles.divider} />
          <SettingInput
            label="הודעת רישום (מסך הרשמה)"
            value={regMessage}
            onChange={setRegMessage}
            placeholder="הודעה לאפליקציה..."
            multiline
          />
          <View style={styles.divider} />
          <View style={styles.flagRow}>
            <Switch
              value={appConfig.registrationOpen}
              onValueChange={val => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setAppConfig({ registrationOpen: val });
              }}
              trackColor={{ false: '#334155', true: Colors.success }}
              thumbColor="#fff"
            />
            <View style={styles.flagTexts}>
              <Text style={styles.flagLabel}>רישום פתוח</Text>
              <Text style={styles.flagDesc}>האם ניתן להירשם לאפליקציה</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
        >
          <LinearGradient colors={Colors.gradients.primary} style={styles.saveBtnGrad}>
            <Text style={styles.saveBtnText}>שמור שינויים ←</Text>
          </LinearGradient>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FlagRow({
  label, desc, value, onToggle,
}: {
  label: string; desc: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.flagRow}>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#334155', true: Colors.primary }}
        thumbColor="#fff"
      />
      <View style={styles.flagTexts}>
        <Text style={styles.flagLabel}>{label}</Text>
        <Text style={styles.flagDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function SettingInput({
  label, value, onChange, keyboardType = 'default', suffix, placeholder, multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: 'numeric' | 'default' | 'email-address';
  suffix?: string; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={siStyles.row}>
      <View style={siStyles.inputWrap}>
        {suffix && <Text style={siStyles.suffix}>{suffix}</Text>}
        <TextInput
          style={[siStyles.input, multiline && siStyles.inputMulti]}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#475569"
          textAlign="right"
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      </View>
      <Text style={siStyles.label}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 16, paddingBottom: 24 },
  back: { marginBottom: 12 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', textAlign: 'right', marginTop: 4 },
  content: { padding: 16, paddingBottom: 40 },

  sectionTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.text,
    textAlign: 'right', marginBottom: 10, marginTop: 8,
  },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16, ...Shadow.sm,
  },

  flagRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  flagTexts: { flex: 1, alignItems: 'flex-end' },
  flagLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text },
  flagDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  saveBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary, marginTop: 8 },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
});

const siStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  label: {
    flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.base,
    color: Colors.text, textAlign: 'right',
  },
  inputWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 6,
    fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text,
    minWidth: 120, textAlign: 'right',
  },
  inputMulti: {
    minWidth: 160, minHeight: 64, textAlignVertical: 'top',
  },
  suffix: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },
});
