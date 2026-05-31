import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

type Level = 'info' | 'warning' | 'critical';

const LEVEL_META: Record<Level, { label: string; color: string; bg: string; icon: string }> = {
  info:     { label: 'מידע',    color: '#9E99FA', bg: 'rgba(124,111,247,0.15)', icon: 'ℹ️' },
  warning:  { label: 'אזהרה',  color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  icon: '⚠️' },
  critical: { label: 'קריטי',  color: '#EF4444', bg: 'rgba(239,68,68,0.15)',   icon: '🚨' },
};

const QUICK_TEMPLATES = [
  { text: 'המערכת תהיה בתחזוקה ביום שישי בין 22:00–00:00. נסיונות תרגול שמורים.', level: 'warning' as Level },
  { text: 'גרסה חדשה זמינה! עדכנו את האפליקציה לחוויה משופרת.', level: 'info' as Level },
  { text: 'מבצע מיוחד — שדרוג לפרמיום ב-50% הנחה היום בלבד! 🎉', level: 'info' as Level },
  { text: 'תקלה טכנית ידועה בסינכרון נתונים. אנו עובדים על פתרון.', level: 'critical' as Level },
  { text: 'תכונות חדשות: מצב אדפטיבי ואתגר שבועי זמינים עכשיו!', level: 'info' as Level },
];

export default function AnnouncementsScreen() {
  const { appConfig, setAppConfig } = useAdminStore();

  const [text, setText] = useState(appConfig.announcementText);
  const [level, setLevel] = useState<Level>(appConfig.announcementLevel);
  const [enabled, setEnabled] = useState(appConfig.announcementEnabled);

  const handleSave = () => {
    if (enabled && !text.trim()) {
      Alert.alert('שגיאה', 'נא להזין טקסט להכרזה לפני הפעלתה');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAppConfig({ announcementText: text.trim(), announcementLevel: level, announcementEnabled: enabled });
    Alert.alert('✅ נשמר', enabled ? 'ההכרזה פעילה ותופיע לכל המשתמשים' : 'ההכרזה כבויה');
  };

  const handleDisable = () => {
    setEnabled(false);
    setAppConfig({ announcementEnabled: false });
    Haptics.selectionAsync();
  };

  const applyTemplate = (t: typeof QUICK_TEMPLATES[0]) => {
    setText(t.text);
    setLevel(t.level);
    Haptics.selectionAsync();
  };

  const currentMeta = LEVEL_META[level];

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>תצוגה מקדימה</Text>
          <View style={[styles.previewBanner, { backgroundColor: currentMeta.bg, borderColor: currentMeta.color }]}>
            <Text style={[styles.previewText, { color: currentMeta.color }]}>
              {currentMeta.icon}  {text.trim() || 'טקסט ההכרזה יופיע כאן...'}
            </Text>
          </View>
        </View>

        {/* Enable toggle */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.row}>
              <Switch
                value={enabled}
                onValueChange={v => { setEnabled(v); Haptics.selectionAsync(); }}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
              <View style={styles.rowLabel}>
                <Text style={styles.rowTitle}>הכרזה פעילה</Text>
                <Text style={styles.rowSub}>{enabled ? 'מוצגת לכל המשתמשים' : 'מוסתרת'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Level selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>רמת חשיבות</Text>
          <View style={styles.levelRow}>
            {(Object.keys(LEVEL_META) as Level[]).map(l => {
              const meta = LEVEL_META[l];
              const active = level === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => { setLevel(l); Haptics.selectionAsync(); }}
                  style={[
                    styles.levelChip,
                    active && { backgroundColor: meta.bg, borderColor: meta.color },
                  ]}
                >
                  <Text style={styles.levelIcon}>{meta.icon}</Text>
                  <Text style={[styles.levelLabel, { color: active ? meta.color : Colors.textSecondary }]}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Text input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>טקסט ההכרזה</Text>
          <View style={styles.card}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="הזן את טקסט ההכרזה..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
              style={styles.textInput}
              textAlign="right"
            />
            <Text style={styles.charCount}>{text.length} / 160</Text>
          </View>
        </View>

        {/* Quick templates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>תבניות מהירות</Text>
          {QUICK_TEMPLATES.map((tpl, i) => (
            <Pressable
              key={i}
              onPress={() => applyTemplate(tpl)}
              style={({ pressed }) => [styles.templateItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.templateLevel}>{LEVEL_META[tpl.level].icon}</Text>
              <Text style={styles.templateText} numberOfLines={2}>{tpl.text}</Text>
            </Pressable>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <LinearGradient colors={['#7C6FF7', '#9E99FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>💾 שמור והפעל</Text>
            </LinearGradient>
          </Pressable>
          {enabled && (
            <Pressable onPress={handleDisable} style={[styles.disableBtn, { opacity: 0.9 }]}>
              <Text style={styles.disableBtnText}>🔕 כבה הכרזה</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1, alignItems: 'flex-end' },
  rowTitle: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  rowSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },

  previewBanner: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  previewText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, textAlign: 'right' },

  levelRow: { flexDirection: 'row-reverse', gap: 10 },
  levelChip: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  levelIcon: { fontSize: 16 },
  levelLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm },

  textInput: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    writingDirection: 'rtl',
  },
  charCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'left',
    marginTop: 6,
  },

  templateItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateLevel: { fontSize: 18, marginTop: 1 },
  templateText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },

  actions: { gap: 12, marginTop: 8 },
  saveBtn: { borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  disableBtn: {
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disableBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
});
