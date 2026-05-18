import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, PracticeSessionSettings, ExamSessionSettings } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const ALL_MODES = [
  { id: 'practice', label: 'תרגול' },
  { id: 'speed', label: 'מהירות' },
  { id: 'adaptive', label: 'אדפטיבי' },
  { id: 'review', label: 'חזרה' },
];

export default function SessionSettingsScreen() {
  const { freePracticeLimit, setFreePracticeLimit, practiceSettings, setPracticeSettings, examSettings, setExamSettings } = useAdminStore();

  // Local state for text inputs
  const [freeLimit, setFreeLimit] = useState(String(freePracticeLimit));
  const [freeMaxDiff, setFreeMaxDiff] = useState(String(practiceSettings.freeUserMaxDifficulty));
  const [premiumLimit, setPremiumLimit] = useState(String(practiceSettings.premiumUserQuestionLimit));
  const [speedSecs, setSpeedSecs] = useState(String(practiceSettings.speedModeSecondsPerQuestion));
  const [autoAdvance, setAutoAdvance] = useState(String(practiceSettings.autoAdvanceDelaySeconds));
  const [passingScore, setPassingScore] = useState(String(examSettings.defaultPassingScore));
  const [restTime, setRestTime] = useState(String(examSettings.defaultRestTimeBetweenRules));

  // Local toggle state (start from store)
  const [showExplauto, setShowExplauto] = useState(practiceSettings.showExplanationsAuto);
  const [shuffleOpts, setShuffleOpts] = useState(practiceSettings.shuffleAnswerOptions);
  const [showTimerAlways, setShowTimerAlways] = useState(practiceSettings.showTimerAlways);
  const [allowSkip, setAllowSkip] = useState(examSettings.allowSkipInExam);
  const [showPercentile, setShowPercentile] = useState(examSettings.showPercentileRankInResults);
  const [showDetailed, setShowDetailed] = useState(examSettings.showDetailedScoreBreakdown);
  const [showCorrect, setShowCorrect] = useState(examSettings.showCorrectAnswersAfterExam);
  const [premiumModes, setPremiumModes] = useState<string[]>(practiceSettings.premiumOnlyModes);

  const togglePremiumMode = (modeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPremiumModes(prev =>
      prev.includes(modeId) ? prev.filter(m => m !== modeId) : [...prev, modeId]
    );
  };

  const handleSave = () => {
    const fl = parseInt(freeLimit, 10);
    const ss = parseInt(speedSecs, 10);
    const aa = parseInt(autoAdvance, 10);
    const ps = parseInt(passingScore, 10);
    const rt = parseInt(restTime, 10);

    const fmd = parseInt(freeMaxDiff, 10);
    const pl = parseInt(premiumLimit, 10);
    if (isNaN(fl) || fl < 5 || fl > 200) { Alert.alert('שגיאה', 'מגבלת שאלות חינמי: 5-200'); return; }
    if (isNaN(fmd) || fmd < 1 || fmd > 10) { Alert.alert('שגיאה', 'קושי מקסימלי לחינמי: 1-10'); return; }
    if (isNaN(pl) || pl < 1) { Alert.alert('שגיאה', 'מגבלת שאלות פרמיום חייבת להיות מספר חיובי'); return; }
    if (isNaN(ss) || ss < 10 || ss > 300) { Alert.alert('שגיאה', 'זמן מהירות: 10-300 שניות'); return; }
    if (isNaN(aa) || aa < 0 || aa > 30) { Alert.alert('שגיאה', 'קידום אוטומטי: 0-30 שניות (0 = כבוי)'); return; }
    if (isNaN(ps) || ps < 0 || ps > 100) { Alert.alert('שגיאה', 'ציון עובר: 0-100'); return; }
    if (isNaN(rt) || rt < 0 || rt > 300) { Alert.alert('שגיאה', 'זמן מנוחה: 0-300 שניות'); return; }

    setFreePracticeLimit(fl);
    setPracticeSettings({
      speedModeSecondsPerQuestion: ss,
      showExplanationsAuto: showExplauto,
      autoAdvanceDelaySeconds: aa,
      shuffleAnswerOptions: shuffleOpts,
      showTimerAlways: showTimerAlways,
      premiumOnlyModes: premiumModes,
      freeUserMaxDifficulty: fmd,
      premiumUserQuestionLimit: pl,
    });
    setExamSettings({
      defaultPassingScore: ps,
      allowSkipInExam: allowSkip,
      defaultRestTimeBetweenRules: rt,
      showPercentileRankInResults: showPercentile,
      showDetailedScoreBreakdown: showDetailed,
      showCorrectAnswersAfterExam: showCorrect,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('נשמר', 'הגדרות הסשן עודכנו. כל הסשנים החדשים ישתמשו בהגדרות אלו.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>הגדרות סשן</Text>
        <Text style={styles.headerSub}>שליטה מלאה בתרגול, מבחנים וגישה לתכונות</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Free vs Premium tiers */}
        <SectionHeader title="🆓 משתמשים חינמיים" />
        <View style={styles.card}>
          <RowInput label="מקסימום שאלות לסשן" value={freeLimit} onChange={setFreeLimit} suffix="שאלות" hint="5–200" />
          <Div />
          <RowInput label="רמת קושי מקסימלית" value={freeMaxDiff} onChange={setFreeMaxDiff} suffix="/10" hint="1–10" />
        </View>

        <SectionHeader title="💎 משתמשי פרמיום" />
        <View style={styles.card}>
          <RowInput label="מקסימום שאלות לסשן" value={premiumLimit} onChange={setPremiumLimit} suffix="שאלות" hint="999=ללא הגבלה" />
          <Div />
          <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', lineHeight: 18 }}>
              💡 פרמיום מקבל גישה לכל הנושאים והמצבים שאינם נעולים לחינמיים. הגדר נושאים פרמיום בניהול נושאים.
            </Text>
          </View>
        </View>

        {/* Session speed */}
        <SectionHeader title="⚡ מצב מהירות" />
        <View style={styles.card}>
          <RowInput label="שניות לשאלה" value={speedSecs} onChange={setSpeedSecs} suffix="שניות" hint="10–300" />
        </View>

        {/* Display */}
        <SectionHeader title="הגדרות תצוגה" />
        <View style={styles.card}>
          <SwitchRow label="הצג הסבר אוטומטי אחרי תשובה" value={showExplauto} onChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowExplauto(v); }} />
          <Div />
          <RowInput label="קידום אוטומטי לשאלה הבאה" value={autoAdvance} onChange={setAutoAdvance} suffix="שניות" hint="0=כבוי" />
          <Div />
          <SwitchRow label="ערבב סדר תשובות" value={shuffleOpts} onChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShuffleOpts(v); }} />
          <Div />
          <SwitchRow label="הצג טיימר תמיד (גם בתרגול)" value={showTimerAlways} onChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowTimerAlways(v); }} />
        </View>

        {/* Exams */}
        <SectionHeader title="הגדרות מבחנים חכמים" />
        <View style={styles.card}>
          <RowInput label="ציון עובר ברירת מחדל" value={passingScore} onChange={setPassingScore} suffix="%" hint="0-100" />
          <Div />
          <RowInput label="זמן מנוחה בין חלקים" value={restTime} onChange={setRestTime} suffix="שניות" hint="0=ללא" />
          <Div />
          <SwitchRow label="אפשר דילוג במבחן" value={allowSkip} onChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAllowSkip(v); }} />
          <Div />
          <SwitchRow label="הצג דירוג אחוזון בתוצאות" value={showPercentile} onChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPercentile(v); }} />
          <Div />
          <SwitchRow label="הצג פירוט ניקוד מפורט" value={showDetailed} onChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowDetailed(v); }} />
          <Div />
          <SwitchRow label="הצג תשובות נכונות אחרי מבחן" value={showCorrect} onChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCorrect(v); }} />
        </View>

        {/* Premium gating */}
        <SectionHeader title="נעילת מצבים לפרמיום בלבד" />
        <View style={styles.card}>
          <Text style={styles.gatingDesc}>בחר מצבים שיהיו זמינים לפרמיום בלבד. מצב "תרגול" תמיד יהיה זמין לכולם.</Text>
          <View style={styles.modeChips}>
            {ALL_MODES.filter(m => m.id !== 'practice').map(m => {
              const active = premiumModes.includes(m.id);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => togglePremiumMode(m.id)}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, active && { color: '#fff' }]}>
                    {active ? '🔒 ' : ''}{m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Save */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient colors={Colors.gradients.primary} style={styles.saveBtnGrad}>
            <Text style={styles.saveBtnText}>שמור הכל - הגדרות פעילות מיידית</Text>
          </LinearGradient>
        </Pressable>

        <Text style={styles.syncNote}>
          הגדרות נשמרות מיידית בזיכרון ומופעלות על כל הסשנים החדשים. לסנכרון בין מכשירים חבר מסד נתונים.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={secStyles.title}>{title}</Text>;
}
const secStyles = StyleSheet.create({
  title: { fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right', marginBottom: 10, marginTop: 16 },
});

function Div() {
  return <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 16 }} />;
}

function RowInput({ label, value, onChange, suffix, hint }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: string }) {
  return (
    <View style={riStyles.row}>
      <View style={riStyles.inputWrap}>
        {suffix && <Text style={riStyles.suffix}>{suffix}</Text>}
        <TextInput
          style={riStyles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          textAlign="center"
          placeholderTextColor="#475569"
          placeholder={hint}
        />
      </View>
      <Text style={riStyles.label}>{label}</Text>
    </View>
  );
}
const riStyles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  label: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  inputWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 6, fontFamily: FontFamily.medium, fontSize: FontSize.base,
    color: Colors.text, minWidth: 64, textAlign: 'center',
  },
  suffix: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
});

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={swStyles.row}>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#334155', true: Colors.primary }} thumbColor="#fff" />
      <Text style={swStyles.label}>{label}</Text>
    </View>
  );
}
const swStyles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  label: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 16, paddingBottom: 24 },
  back: { marginBottom: 12 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', textAlign: 'right', marginTop: 4 },
  content: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, marginBottom: 4, ...Shadow.sm,
  },
  gatingDesc: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary,
    textAlign: 'right', paddingHorizontal: 16, paddingTop: 12, lineHeight: 18,
  },
  modeChips: { flexDirection: 'row-reverse', gap: 8, padding: 16, paddingTop: 10, flexWrap: 'wrap' },
  modeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border,
  },
  modeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  saveBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary, marginTop: 20 },
  saveBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  syncNote: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary,
    textAlign: 'right', marginTop: 12, lineHeight: 18, paddingHorizontal: 4,
  },
});
