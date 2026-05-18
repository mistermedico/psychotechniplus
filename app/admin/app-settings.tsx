import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

export default function AppSettingsScreen() {
  const { questions, seedToSupabase, loadQuestionsFromSupabase, freePracticeLimit, setFreePracticeLimit } = useAdminStore();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [freeTrialDays, setFreeTrialDays] = useState('7');
  const [maxSessionQuestions, setMaxSessionQuestions] = useState('20');
  const [freeLimitInput, setFreeLimitInput] = useState(String(freePracticeLimit));
  const [aiEnabled, setAiEnabled] = useState(true);
  const [newUserBonusXp, setNewUserBonusXp] = useState('50');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    Alert.alert(
      'זרע מסד נתונים',
      `האם לטעון ${questions.length} שאלות לSupabase? (יחליף נתונים קיימים)`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר',
          style: 'destructive',
          onPress: async () => {
            setSyncing(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            const result = await seedToSupabase();
            setSyncing(false);
            Alert.alert(result.ok ? '✅ הצלחה' : '❌ שגיאה', result.message);
          },
        },
      ],
    );
  };

  const handleLoadFromSupabase = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadQuestionsFromSupabase();
    setLoading(false);
    Alert.alert('✅ עודכן', 'השאלות נטענו מ-Supabase בהצלחה');
  };

  const handleSaveSettings = () => {
    const days = parseInt(freeTrialDays, 10);
    const maxQ = parseInt(maxSessionQuestions, 10);
    const bonusXp = parseInt(newUserBonusXp, 10);

    const freeLimit = parseInt(freeLimitInput, 10);
    if (isNaN(days) || days < 0) { Alert.alert('שגיאה', 'ימי ניסיון חייבים להיות מספר חיובי'); return; }
    if (isNaN(maxQ) || maxQ < 5 || maxQ > 100) { Alert.alert('שגיאה', 'מקסימום שאלות לסשן חייב להיות 5–100'); return; }
    if (isNaN(bonusXp) || bonusXp < 0) { Alert.alert('שגיאה', 'XP בונוס חייב להיות מספר חיובי'); return; }
    if (isNaN(freeLimit) || freeLimit < 5 || freeLimit > 200) { Alert.alert('שגיאה', 'מגבלת תרגול חינמי חייבת להיות 5–200'); return; }

    setFreePracticeLimit(freeLimit);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✅ נשמר', 'ההגדרות נשמרו');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>⚙️ הגדרות אפליקציה</Text>
        <Text style={styles.headerSub}>שליטה גלובלית על האפליקציה</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Danger zone — Maintenance */}
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>⚠️ מצב תחזוקה</Text>
          <Text style={styles.dangerDesc}>
            כשמופעל, משתמשים רגילים יראו מסך "בתחזוקה". מנהלים יכולים להיכנס כרגיל.
          </Text>
          <View style={styles.switchRow}>
            <Switch
              value={maintenanceMode}
              onValueChange={val => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (val) {
                  Alert.alert(
                    'הפעלת מצב תחזוקה',
                    'משתמשים לא יוכלו להיכנס לאפליקציה. להמשיך?',
                    [
                      { text: 'ביטול', style: 'cancel' },
                      { text: 'הפעל', style: 'destructive', onPress: () => setMaintenanceMode(true) },
                    ],
                  );
                } else {
                  setMaintenanceMode(false);
                }
              }}
              trackColor={{ false: '#334155', true: Colors.danger }}
              thumbColor="#fff"
            />
            <Text style={[styles.switchLabel, { color: maintenanceMode ? Colors.danger : Colors.textSecondary }]}>
              {maintenanceMode ? '🔴 מצב תחזוקה פעיל' : '🟢 האפליקציה פעילה'}
            </Text>
          </View>
        </View>

        {/* General settings */}
        <Text style={styles.sectionTitle}>הגדרות כלליות</Text>

        <View style={styles.settingsCard}>
          <SettingInput
            label="ימי ניסיון חינמי"
            value={freeTrialDays}
            onChange={setFreeTrialDays}
            keyboardType="numeric"
            suffix="ימים"
          />
          <View style={styles.divider} />
          <SettingInput
            label="מקסימום שאלות לסשן"
            value={maxSessionQuestions}
            onChange={setMaxSessionQuestions}
            keyboardType="numeric"
            suffix="שאלות"
          />
          <View style={styles.divider} />
          <SettingInput
            label="מגבלת תרגול חינמי"
            value={freeLimitInput}
            onChange={setFreeLimitInput}
            keyboardType="numeric"
            suffix="שאלות"
          />
          <View style={styles.divider} />
          <SettingInput
            label="XP בונוס למשתמש חדש"
            value={newUserBonusXp}
            onChange={setNewUserBonusXp}
            keyboardType="numeric"
            suffix="XP"
          />
          <View style={styles.divider} />
          <View style={styles.switchRowInCard}>
            <Switch
              value={aiEnabled}
              onValueChange={val => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAiEnabled(val);
              }}
              trackColor={{ false: '#334155', true: Colors.primary }}
              thumbColor="#fff"
            />
            <Text style={styles.switchLabelCard}>מחולל AI מופעל</Text>
          </View>
        </View>

        <Pressable
          onPress={handleSaveSettings}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
        >
          <LinearGradient colors={Colors.gradients.primary} style={styles.saveBtnGrad}>
            <Text style={styles.saveBtnText}>שמור הגדרות ←</Text>
          </LinearGradient>
        </Pressable>

        {/* Database operations */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>פעולות מסד נתונים</Text>

        <View style={styles.dbCard}>
          <View style={styles.dbRow}>
            <View style={styles.dbInfo}>
              <Text style={styles.dbLabel}>טעינה מ-Supabase</Text>
              <Text style={styles.dbDesc}>מחליף שאלות מקומיות בנתונים מהשרת</Text>
            </View>
            <Pressable
              onPress={handleLoadFromSupabase}
              disabled={loading}
              style={[styles.dbBtn, { borderColor: Colors.primary }]}
            >
              <Text style={[styles.dbBtnText, { color: Colors.primary }]}>
                {loading ? 'טוען...' : '↓ טעון'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.dbRow}>
            <View style={styles.dbInfo}>
              <Text style={styles.dbLabel}>זרע ל-Supabase</Text>
              <Text style={styles.dbDesc}>{questions.length} שאלות → Supabase (מחליף הכל)</Text>
            </View>
            <Pressable
              onPress={handleSeed}
              disabled={syncing}
              style={[styles.dbBtn, { borderColor: Colors.danger }]}
            >
              <Text style={[styles.dbBtnText, { color: Colors.danger }]}>
                {syncing ? 'מזריע...' : '↑ זרע'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* App info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>מידע על האפליקציה</Text>
          <InfoRow label="גרסה" value="1.0.0" />
          <InfoRow label="סביבה" value="production" />
          <InfoRow label="SDK" value="Expo 52" />
          <InfoRow label="שאלות במאגר" value={`${questions.length}`} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SettingInput({
  label, value, onChange, keyboardType = 'default', suffix,
}: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: 'numeric' | 'default'; suffix?: string;
}) {
  return (
    <View style={siStyles.row}>
      <View style={siStyles.inputWrap}>
        {suffix && <Text style={siStyles.suffix}>{suffix}</Text>}
        <TextInput
          style={siStyles.input}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          textAlign="right"
          placeholderTextColor="#475569"
        />
      </View>
      <Text style={siStyles.label}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoRowStyles.row}>
      <Text style={infoRowStyles.value}>{value}</Text>
      <Text style={infoRowStyles.label}>{label}</Text>
    </View>
  );
}

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

  dangerCard: {
    backgroundColor: Colors.danger + '15', borderRadius: Radius.lg,
    padding: 16, borderWidth: 1.5, borderColor: Colors.danger + '40',
    marginBottom: 20,
  },
  dangerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.danger, textAlign: 'right', marginBottom: 6 },
  dangerDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20, marginBottom: 14 },
  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  switchLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm },

  settingsCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16, ...Shadow.sm,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  switchRowInCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  switchLabelCard: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text, flex: 1, textAlign: 'right' },

  saveBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  dbCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20, ...Shadow.sm,
  },
  dbRow: { flexDirection: 'row-reverse', alignItems: 'center', padding: 16, gap: 12 },
  dbInfo: { flex: 1, alignItems: 'flex-end' },
  dbLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text },
  dbDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  dbBtn: {
    borderWidth: 1.5, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  dbBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },

  infoCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 16, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  infoTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text,
    textAlign: 'right', marginBottom: 12,
  },
});

const siStyles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  label: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  inputWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 6,
    fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text,
    minWidth: 60, textAlign: 'center',
  },
  suffix: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },
});

const infoRowStyles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },
});
