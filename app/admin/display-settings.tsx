import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSettingsStore, FontSizeOption, AutoAdvanceOption, DisplaySettings } from '../../store/settingsStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';

export default function DisplaySettingsScreen() {
  const storeState = useSettingsStore();
  const { updateSetting, resetSettings } = storeState;
  const settings: DisplaySettings = storeState;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→ חזרה</Text>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>הגדרות תצוגת שאלות</Text>
          <Text style={styles.headerSub}>שליטה בממשק השאלות</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: תצוגת שאלה */}
        <SectionHeader title="תצוגת שאלה" icon="📋" />

        <SettingRow
          label="תג רמת קושי"
          description="הצג תגית עם רמת הקושי על השאלה"
          control={
            <Switch
              value={settings.showDifficultyBadge}
              onValueChange={(v) => updateSetting('showDifficultyBadge', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          }
        />

        <SettingRow
          label="ציון ELO"
          description="הצג את ציון ה-ELO של השאלה"
          control={
            <Switch
              value={settings.showEloOnQuestion}
              onValueChange={(v) => updateSetting('showEloOnQuestion', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          }
        />

        <SettingRow
          label="ערבוב אפשרויות"
          description="ערבב את סדר תשובות האפשריות בכל שאלה"
          control={
            <Switch
              value={settings.shuffleOptions}
              onValueChange={(v) => updateSetting('shuffleOptions', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          }
        />

        <SettingRow
          label="כיווץ קטע קריאה"
          description="הצג קטע קריאה מכווץ עם כפתור להרחבה"
          control={
            <Switch
              value={settings.collapseReadingPassage}
              onValueChange={(v) => updateSetting('collapseReadingPassage', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          }
        />

        <SettingRow
          label="הדגשת תשובה נכונה"
          description="לאחר תשובה שגויה, הדגש את הנכונה בירוק"
          control={
            <Switch
              value={settings.highlightCorrectAfterWrong}
              onValueChange={(v) => updateSetting('highlightCorrectAfterWrong', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          }
        />

        {/* Font size picker */}
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingLabel}>גודל טקסט שאלה</Text>
            <Text style={styles.settingDesc}>גדל טקסט השאלה המוצגת</Text>
          </View>
          <View style={styles.chipRow}>
            {([
              { key: 'small', label: 'קטן' },
              { key: 'medium', label: 'בינוני' },
              { key: 'large', label: 'גדול' },
            ] as { key: FontSizeOption; label: string }[]).map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => updateSetting('questionFontSize', key)}
                style={[
                  styles.chip,
                  settings.questionFontSize === key && styles.chipActive,
                ]}
              >
                <Text style={[
                  styles.chipText,
                  settings.questionFontSize === key && styles.chipTextActive,
                ]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Section: ניווט ואינטראקציה */}
        <SectionHeader title="ניווט ואינטראקציה" icon="🎮" />

        <SettingRow
          label="טיימר בתרגול"
          description="הצג טיימר גם בסשן תרגול רגיל (לא רק מצב מהירות)"
          control={
            <Switch
              value={settings.showTimerInPractice}
              onValueChange={(v) => updateSetting('showTimerInPractice', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          }
        />

        <SettingRow
          label="הסבר אוטומטי"
          description="הצג הסבר אוטומטית לאחר מענה (כבה לכפתור ידני)"
          control={
            <Switch
              value={settings.showExplanationAuto}
              onValueChange={(v) => updateSetting('showExplanationAuto', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          }
        />

        {/* Auto-advance delay picker */}
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingLabel}>מעבר אוטומטי לשאלה הבאה</Text>
            <Text style={styles.settingDesc}>עיכוב לפני מעבר אוטומטי אחרי מענה</Text>
          </View>
          <View style={styles.chipRow}>
            {([
              { key: 0, label: 'כבוי' },
              { key: 2, label: '2 שניות' },
              { key: 3, label: '3 שניות' },
              { key: 5, label: '5 שניות' },
            ] as { key: AutoAdvanceOption; label: string }[]).map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => updateSetting('autoAdvanceDelay', key)}
                style={[
                  styles.chip,
                  settings.autoAdvanceDelay === key && styles.chipActive,
                ]}
              >
                <Text style={[
                  styles.chipText,
                  settings.autoAdvanceDelay === key && styles.chipTextActive,
                ]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Section: נגישות */}
        <SectionHeader title="נגישות" icon="♿" />

        <View style={[styles.settingRow, styles.settingRowLast]}>
          <View style={styles.settingText}>
            <Text style={styles.settingLabel}>תצוגה מקדימה לדוגמה</Text>
            <Text style={styles.settingDesc}>כך תיראה שאלה עם ההגדרות הנוכחיות</Text>
          </View>
        </View>

        {/* Live Preview */}
        <PreviewCard settings={settings} />

        {/* Reset button */}
        <Pressable
          onPress={resetSettings}
          style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.resetText}>איפוס לברירת מחדל</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{icon} {title}</Text>
    </View>
  );
}

function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <View style={styles.settingControl}>{control}</View>
    </View>
  );
}

function PreviewCard({ settings }: { settings: DisplaySettings }) {
  const [passageExpanded, setPassageExpanded] = useState(false);

  const fontSizeMap: Record<FontSizeOption, number> = {
    small: FontSize.base,
    medium: FontSize.lg,
    large: FontSize.xl,
  };
  const questionFontSize = fontSizeMap[settings.questionFontSize];

  return (
    <View style={styles.previewCard}>
      {/* Simulated reading passage */}
      {settings.collapseReadingPassage ? (
        <View style={styles.previewPassage}>
          <View style={styles.previewPassageHeader}>
            <Text style={styles.previewPassageLabel}>📖 קטע לקריאה</Text>
            <Pressable onPress={() => setPassageExpanded(v => !v)} style={styles.previewToggleBtn}>
              <Text style={styles.previewToggleText}>{passageExpanded ? 'הסתר קטע' : 'הצג קטע'}</Text>
            </Pressable>
          </View>
          {passageExpanded && (
            <Text style={styles.previewPassageText}>
              זהו קטע לדוגמה שניתן לכווץ ולהרחיב. לחץ על "הסתר קטע" להסתרתו.
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.previewPassage}>
          <Text style={styles.previewPassageLabel}>📖 קטע לקריאה</Text>
          <Text style={styles.previewPassageText}>זהו קטע לדוגמה הנמצא תמיד גלוי.</Text>
        </View>
      )}

      {/* Simulated question box */}
      <View style={styles.previewQuestionBox}>
        {/* Difficulty badge */}
        {settings.showDifficultyBadge && (
          <View style={styles.previewBadgeRow}>
            <View style={styles.previewDiffBadge}>
              <Text style={styles.previewDiffText}>רמה 4</Text>
            </View>
            {settings.showEloOnQuestion && (
              <View style={styles.previewEloBadge}>
                <Text style={styles.previewEloText}>ELO 1230</Text>
              </View>
            )}
          </View>
        )}
        {!settings.showDifficultyBadge && settings.showEloOnQuestion && (
          <View style={styles.previewBadgeRow}>
            <View style={styles.previewEloBadge}>
              <Text style={styles.previewEloText}>ELO 1230</Text>
            </View>
          </View>
        )}

        <Text style={[styles.previewQuestionText, { fontSize: questionFontSize }]}>
          מה הם 20% מ-350?
        </Text>
      </View>

      {/* Simulated options */}
      <View style={styles.previewOptions}>
        {['60', '70', '75', '80'].map((opt, i) => (
          <View
            key={i}
            style={[
              styles.previewOption,
              i === 1 && styles.previewOptionCorrect,
            ]}
          >
            <Text style={[
              styles.previewOptionText,
              i === 1 && styles.previewOptionTextCorrect,
            ]}>
              {i === 1 ? '✓' : '○'} {opt}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.previewNote}>תצוגה מקדימה — הגדרות בזמן אמת</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  backText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#fff',
  },
  headerTextWrap: { flex: 1, alignItems: 'flex-end' },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
    textAlign: 'right',
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 2,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  sectionHeader: {
    backgroundColor: Colors.surfaceTertiary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  sectionHeaderText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
  },

  settingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingText: { flex: 1 },
  settingLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  settingDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 2,
  },
  settingControl: { alignItems: 'flex-end' },

  chipRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
  },
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryLighter,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.primary,
  },

  // Preview card
  previewCard: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewPassage: {
    backgroundColor: Colors.surfaceSecondary,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderRightWidth: 3,
    borderRightColor: Colors.primary,
  },
  previewPassageHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewPassageLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    textAlign: 'right',
  },
  previewToggleBtn: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  previewToggleText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  previewPassageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 18,
  },
  previewQuestionBox: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  previewBadgeRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginBottom: 8,
  },
  previewDiffBadge: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  previewDiffText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  previewEloBadge: {
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  previewEloText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
  },
  previewQuestionText: {
    fontFamily: FontFamily.semiBold,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 26,
  },
  previewOptions: {
    padding: 12,
    gap: 6,
  },
  previewOption: {
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  previewOptionCorrect: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  previewOptionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
  },
  previewOptionTextCorrect: {
    color: Colors.success,
  },
  previewNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingBottom: 12,
  },

  resetBtn: {
    margin: 16,
    marginTop: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  resetText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.danger,
  },
});
