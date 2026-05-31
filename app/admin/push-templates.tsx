import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '../../utils/haptics';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius } from '../../constants/theme';

const TEMPLATES_STORAGE_KEY = '@psychotechniplus/admin/pushTemplates';

type TemplateCategory = 'reminder' | 'achievement' | 'offer' | 'update';

interface PushTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  icon: string;
  category: TemplateCategory;
}

const CATEGORY_META: Record<TemplateCategory, { label: string; color: string; bg: string; icon: string }> = {
  reminder:    { label: 'תזכורת',  color: '#7C6FF7', bg: 'rgba(124,111,247,0.15)', icon: '⏰' },
  achievement: { label: 'הישג',    color: '#10B981', bg: 'rgba(16,185,129,0.15)',  icon: '🏆' },
  offer:       { label: 'מבצע',    color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  icon: '💎' },
  update:      { label: 'עדכון',   color: '#60A5FA', bg: 'rgba(96,165,250,0.15)',  icon: '🚀' },
};

const DEFAULT_TEMPLATES: PushTemplate[] = [
  {
    id: 'tpl_001',
    name: 'תזכורת יומית',
    title: 'זמן לתרגל! 🧠',
    body: '5 דקות ביום = שיפור מדהים',
    icon: '🧠',
    category: 'reminder',
  },
  {
    id: 'tpl_002',
    name: 'השג נשמר',
    title: 'כל הכבוד! 🏆',
    body: 'השגת תג חדש! בדוק את הפרופיל שלך',
    icon: '🏆',
    category: 'achievement',
  },
  {
    id: 'tpl_003',
    name: 'מבצע פרמיום',
    title: 'הצעה מיוחדת! 💎',
    body: '50% הנחה — היום בלבד',
    icon: '💎',
    category: 'offer',
  },
  {
    id: 'tpl_004',
    name: 'גרסה חדשה',
    title: 'עדכון זמין 🚀',
    body: 'שיפורים ותכונות חדשות מחכים לך',
    icon: '🚀',
    category: 'update',
  },
  {
    id: 'tpl_005',
    name: 'רצף בסכנה',
    title: 'אל תשבר את הרצף! 🔥',
    body: 'עוד יום ופגת הרצף שלך — תרגל עכשיו',
    icon: '🔥',
    category: 'reminder',
  },
];

const ALL_FILTER_CATS: Array<TemplateCategory | 'all'> = ['all', 'reminder', 'achievement', 'offer', 'update'];

interface FormState {
  name: string;
  title: string;
  body: string;
  icon: string;
  category: TemplateCategory;
}

const BLANK_FORM: FormState = {
  name: '', title: '', body: '', icon: '🔔', category: 'reminder',
};

export default function PushTemplatesScreen() {
  const [templates, setTemplates] = useState<PushTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<TemplateCategory | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TEMPLATES_STORAGE_KEY);
        if (raw) {
          setTemplates(JSON.parse(raw));
        } else {
          setTemplates(DEFAULT_TEMPLATES);
          await AsyncStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
        }
      } catch {
        setTemplates(DEFAULT_TEMPLATES);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: PushTemplate[]) => {
    setTemplates(next);
    try {
      await AsyncStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לשמור תבניות');
    }
  }, []);

  const handleSend = (tpl: PushTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/admin/notifications',
      params: {
        prefillTitle: tpl.title,
        prefillBody: tpl.body,
      },
    });
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.title.trim() || !form.body.trim()) {
      Alert.alert('שגיאה', 'יש למלא שם, כותרת וגוף הודעה');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newTpl: PushTemplate = {
      id: `tpl_${Date.now()}`,
      name: form.name.trim(),
      title: form.title.trim(),
      body: form.body.trim(),
      icon: form.icon.trim() || '🔔',
      category: form.category,
    };
    await persist([...templates, newTpl]);
    setForm(BLANK_FORM);
    setShowForm(false);
  };

  const handleUpdate = async () => {
    if (!form.name.trim() || !form.title.trim() || !form.body.trim()) {
      Alert.alert('שגיאה', 'יש למלא שם, כותרת וגוף הודעה');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = templates.map(t =>
      t.id === editingId
        ? { ...t, name: form.name.trim(), title: form.title.trim(), body: form.body.trim(), icon: form.icon.trim() || t.icon, category: form.category }
        : t,
    );
    await persist(next);
    setForm(BLANK_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('מחיקת תבנית', 'האם אתה בטוח?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await persist(templates.filter(t => t.id !== id));
        },
      },
    ]);
  };

  const startEdit = (tpl: PushTemplate) => {
    setForm({ name: tpl.name, title: tpl.title, body: tpl.body, icon: tpl.icon, category: tpl.category });
    setEditingId(tpl.id);
    setShowForm(true);
    Haptics.selectionAsync();
  };

  const cancelForm = () => {
    setForm(BLANK_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const visible = templates.filter(t => activeFilter === 'all' || t.category === activeFilter);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Category filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}>
          {ALL_FILTER_CATS.map(cat => {
            const meta = cat === 'all' ? null : CATEGORY_META[cat];
            const isActive = activeFilter === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => { setActiveFilter(cat); Haptics.selectionAsync(); }}
                style={[
                  styles.chip,
                  isActive && meta && { backgroundColor: meta.bg, borderColor: meta.color },
                  isActive && !meta && { backgroundColor: 'rgba(124,111,247,0.15)', borderColor: '#7C6FF7' },
                ]}
              >
                {meta && <Text style={styles.chipIcon}>{meta.icon}</Text>}
                <Text style={[
                  styles.chipText,
                  isActive && meta && { color: meta.color },
                  isActive && !meta && { color: '#9E99FA' },
                ]}>
                  {cat === 'all' ? 'הכל' : meta!.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Add / Edit form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? '✏️ עריכת תבנית' : '➕ תבנית חדשה'}</Text>

            <Text style={styles.fieldLabel}>שם תבנית</Text>
            <TextInput
              value={form.name}
              onChangeText={t => setForm(f => ({ ...f, name: t }))}
              placeholder="שם תבנית..."
              placeholderTextColor={Colors.textTertiary}
              style={styles.textInput}
              textAlign="right"
            />

            <View style={styles.rowInputs}>
              <View style={{ flex: 3 }}>
                <Text style={styles.fieldLabel}>כותרת הודעה</Text>
                <TextInput
                  value={form.title}
                  onChangeText={t => setForm(f => ({ ...f, title: t }))}
                  placeholder="כותרת..."
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.textInput}
                  textAlign="right"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>אייקון</Text>
                <TextInput
                  value={form.icon}
                  onChangeText={t => setForm(f => ({ ...f, icon: t }))}
                  placeholder="🔔"
                  placeholderTextColor={Colors.textTertiary}
                  style={[styles.textInput, styles.iconInput]}
                  textAlign="center"
                  maxLength={4}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>גוף ההודעה</Text>
            <TextInput
              value={form.body}
              onChangeText={t => setForm(f => ({ ...f, body: t }))}
              placeholder="תוכן ההודעה..."
              placeholderTextColor={Colors.textTertiary}
              style={[styles.textInput, styles.bodyInput]}
              textAlign="right"
              multiline
            />

            <Text style={styles.fieldLabel}>קטגוריה</Text>
            <View style={styles.catRow}>
              {(Object.keys(CATEGORY_META) as TemplateCategory[]).map(cat => {
                const meta = CATEGORY_META[cat];
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setForm(f => ({ ...f, category: cat }))}
                    style={[
                      styles.catChip,
                      form.category === cat && { backgroundColor: meta.bg, borderColor: meta.color },
                    ]}
                  >
                    <Text style={styles.catChipIcon}>{meta.icon}</Text>
                    <Text style={[
                      styles.catChipText,
                      form.category === cat && { color: meta.color },
                    ]}>
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.formActions}>
              <Pressable onPress={cancelForm} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </Pressable>
              <Pressable
                onPress={editingId ? handleUpdate : handleAdd}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}
              >
                <LinearGradient colors={['#5A52D5', '#7C6FF7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>{editingId ? '💾 עדכן' : '➕ הוסף'}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}

        {/* List header */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>תבניות ({visible.length})</Text>
          {!showForm && (
            <Pressable
              onPress={() => { setShowForm(true); setEditingId(null); setForm(BLANK_FORM); Haptics.selectionAsync(); }}
              style={styles.addBtn}
            >
              <Text style={styles.addBtnText}>+ הוסף תבנית</Text>
            </Pressable>
          )}
        </View>

        {visible.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>אין תבניות בקטגוריה זו</Text>
          </View>
        )}

        {visible.map(tpl => {
          const meta = CATEGORY_META[tpl.category];
          return (
            <View key={tpl.id} style={styles.tplCard}>
              {/* Top */}
              <View style={styles.tplTop}>
                <View style={[styles.catBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                  <Text style={styles.catBadgeIcon}>{meta.icon}</Text>
                  <Text style={[styles.catBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.tplName}>{tpl.name}</Text>
              </View>

              {/* Preview */}
              <View style={styles.tplPreview}>
                <View style={styles.tplIconBox}>
                  <Text style={styles.tplIcon}>{tpl.icon}</Text>
                </View>
                <View style={styles.tplTextWrap}>
                  <Text style={styles.tplTitle}>{tpl.title}</Text>
                  <Text style={styles.tplBody} numberOfLines={2}>{tpl.body}</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.tplActions}>
                <Pressable onPress={() => handleDelete(tpl.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </Pressable>
                <Pressable onPress={() => startEdit(tpl)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>✏️ ערוך</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSend(tpl)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, flex: 1 }]}
                >
                  <LinearGradient colors={['#5A52D5', '#7C6FF7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendBtn}>
                    <Text style={styles.sendBtnText}>שלח עכשיו 🔔</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  chipScroll: { marginBottom: 16 },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipIcon: { fontSize: 13 },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.4)',
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  formTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 4,
  },
  fieldLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 4,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    writingDirection: 'rtl',
  },
  rowInputs: { flexDirection: 'row-reverse', gap: 8 },
  iconInput: { textAlign: 'center', fontSize: 20 },
  bodyInput: { minHeight: 70, textAlignVertical: 'top' },
  catRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  catChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  catChipIcon: { fontSize: 13 },
  catChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  formActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  saveBtn: { borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  listHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  addBtn: {
    backgroundColor: 'rgba(124,111,247,0.15)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.4)',
  },
  addBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: '#9E99FA',
  },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },

  tplCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  tplTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 10,
  },
  tplName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  catBadgeIcon: { fontSize: 11 },
  catBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
  },

  tplPreview: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  tplIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tplIcon: { fontSize: 22 },
  tplTextWrap: { flex: 1 },
  tplTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 3,
  },
  tplBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 18,
  },

  tplActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  deleteBtn: {
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  deleteBtnText: { fontSize: 16 },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(124,111,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.3)',
  },
  editBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#9E99FA' },
  sendBtn: { borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  sendBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: '#fff' },
});
