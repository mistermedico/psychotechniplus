import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '../../utils/haptics';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius } from '../../constants/theme';

const FAQ_STORAGE_KEY = '@psychotechniplus/admin/faqItems';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

const DEFAULT_FAQ: FaqItem[] = [
  {
    id: 'faq_001',
    question: 'איך עובד האלגוריתם האדפטיבי?',
    answer: 'האלגוריתם מבוסס על מערכת ELO המתאימה את רמת השאלות לביצועי המשתמש בזמן אמת. כל תשובה נכונה מעלה את רמת הקושי וכל שגיאה מורידה אותה, כך שהתרגול תמיד מאתגר אך לא מתסכל.',
    category: 'כללי',
    order: 1,
  },
  {
    id: 'faq_002',
    question: 'מה ההבדל בין תרגול חופשי לסימולציה?',
    answer: 'תרגול חופשי מאפשר לבחור נושאים ספציפיים ולתרגל בקצב עצמאי ללא מגבלת זמן. סימולציה מחקה את תנאי הפסיכומטרי האמיתי — זמן מוגבל, שאלות מכל הנושאים, ודירוג סופי.',
    category: 'תרגול',
    order: 2,
  },
  {
    id: 'faq_003',
    question: 'איך מבטלים את המנוי?',
    answer: 'ניתן לבטל דרך ה-App Store (iOS) או Google Play (Android). כנסו להגדרות החשבון, בחרו מנויים ובטלו את PsychotechniPlus. הגישה לפרמיום נשארת עד סוף תקופת החיוב.',
    category: 'פרמיום',
    order: 3,
  },
  {
    id: 'faq_004',
    question: 'האם ניתן לתרגל בלי אינטרנט?',
    answer: 'חלק מהתכונות זמינות ללא חיבור לאינטרנט, כולל שאלות שכבר הורדו. סנכרון התוצאות, עדכון מאגר השאלות ולוח המובילים דורשים חיבור פעיל.',
    category: 'טכני',
    order: 4,
  },
  {
    id: 'faq_005',
    question: 'כמה שאלות יש במאגר?',
    answer: 'המאגר מכיל מעל 2,000 שאלות המכסות את כל פרקי הפסיכומטרי — כמותי, מילולי, ואנגלית. השאלות ממופות לפי נושא, רמת קושי ורמת גישה (חופשי / פרמיום).',
    category: 'כללי',
    order: 5,
  },
];

const ALL_CATEGORIES = ['הכל', 'כללי', 'תרגול', 'פרמיום', 'טכני'];

const CATEGORY_COLORS: Record<string, string> = {
  'כללי':   '#7C6FF7',
  'תרגול':  '#10B981',
  'פרמיום': '#F59E0B',
  'טכני':   '#60A5FA',
};

interface FormState {
  question: string;
  answer: string;
  category: string;
}

const BLANK_FORM: FormState = { question: '', answer: '', category: 'כללי' };

export default function FaqManagerScreen() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('הכל');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAQ_STORAGE_KEY);
        if (raw) {
          setItems(JSON.parse(raw));
        } else {
          setItems(DEFAULT_FAQ);
          await AsyncStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(DEFAULT_FAQ));
        }
      } catch {
        setItems(DEFAULT_FAQ);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(async (next: FaqItem[]) => {
    setItems(next);
    try {
      await AsyncStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(next));
    } catch {
      Alert.alert('שגיאה', 'לא ניתן היה לשמור');
    }
  }, []);

  const handleAdd = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      Alert.alert('שגיאה', 'יש להזין שאלה ותשובה');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const maxOrder = items.reduce((m, it) => Math.max(m, it.order), 0);
    const newItem: FaqItem = {
      id: `faq_${Date.now()}`,
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category,
      order: maxOrder + 1,
    };
    await save([...items, newItem]);
    setForm(BLANK_FORM);
    setShowForm(false);
  };

  const handleUpdate = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      Alert.alert('שגיאה', 'יש להזין שאלה ותשובה');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = items.map(it =>
      it.id === editingId
        ? { ...it, question: form.question.trim(), answer: form.answer.trim(), category: form.category }
        : it,
    );
    await save(next);
    setForm(BLANK_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('מחיקת שאלה', 'האם אתה בטוח?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const next = items.filter(it => it.id !== id);
          // Re-order
          const reordered = next.map((it, i) => ({ ...it, order: i + 1 }));
          await save(reordered);
        },
      },
    ]);
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    Haptics.selectionAsync();
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(it => it.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const next = [...sorted];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const reordered = next.map((it, i) => ({ ...it, order: i + 1 }));
    await save(reordered);
  };

  const startEdit = (item: FaqItem) => {
    setForm({ question: item.question, answer: item.answer, category: item.category });
    setEditingId(item.id);
    setShowForm(true);
    Haptics.selectionAsync();
  };

  const cancelForm = () => {
    setForm(BLANK_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const sortedItems = items.slice().sort((a, b) => a.order - b.order);
  const visibleItems = activeCategory === 'הכל'
    ? sortedItems
    : sortedItems.filter(it => it.category === activeCategory);

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
          {ALL_CATEGORIES.map(cat => (
            <Pressable
              key={cat}
              onPress={() => { setActiveCategory(cat); Haptics.selectionAsync(); }}
              style={[
                styles.chip,
                activeCategory === cat && {
                  backgroundColor: CATEGORY_COLORS[cat] ?? 'rgba(124,111,247,0.2)',
                  borderColor: CATEGORY_COLORS[cat] ?? '#7C6FF7',
                },
              ]}
            >
              <Text style={[
                styles.chipText,
                activeCategory === cat && { color: CATEGORY_COLORS[cat] ?? '#7C6FF7' },
              ]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Add / Edit form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? '✏️ עריכת שאלה' : '➕ שאלה חדשה'}</Text>

            <Text style={styles.fieldLabel}>שאלה</Text>
            <TextInput
              value={form.question}
              onChangeText={t => setForm(f => ({ ...f, question: t }))}
              placeholder="הזן שאלה..."
              placeholderTextColor={Colors.textTertiary}
              style={styles.textInput}
              textAlign="right"
              multiline
            />

            <Text style={styles.fieldLabel}>תשובה</Text>
            <TextInput
              value={form.answer}
              onChangeText={t => setForm(f => ({ ...f, answer: t }))}
              placeholder="הזן תשובה..."
              placeholderTextColor={Colors.textTertiary}
              style={[styles.textInput, styles.answerInput]}
              textAlign="right"
              multiline
            />

            <Text style={styles.fieldLabel}>קטגוריה</Text>
            <View style={styles.catRow}>
              {ALL_CATEGORIES.filter(c => c !== 'הכל').map(cat => (
                <Pressable
                  key={cat}
                  onPress={() => setForm(f => ({ ...f, category: cat }))}
                  style={[
                    styles.catChip,
                    form.category === cat && {
                      backgroundColor: CATEGORY_COLORS[cat] + '30',
                      borderColor: CATEGORY_COLORS[cat],
                    },
                  ]}
                >
                  <Text style={[
                    styles.catChipText,
                    form.category === cat && { color: CATEGORY_COLORS[cat] },
                  ]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
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

        {/* FAQ list */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>
            שאלות ({visibleItems.length})
          </Text>
          {!showForm && (
            <Pressable
              onPress={() => { setShowForm(true); setEditingId(null); setForm(BLANK_FORM); Haptics.selectionAsync(); }}
              style={styles.addBtn}
            >
              <Text style={styles.addBtnText}>+ הוסף שאלה</Text>
            </Pressable>
          )}
        </View>

        {visibleItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>❓</Text>
            <Text style={styles.emptyText}>אין שאלות בקטגוריה זו</Text>
          </View>
        )}

        {visibleItems.map((item) => {
          const isExpanded = expandedId === item.id;
          const catColor = CATEGORY_COLORS[item.category] ?? '#7C6FF7';
          const fullIdx = sortedItems.findIndex(it => it.id === item.id);
          return (
            <View key={item.id} style={styles.faqCard}>
              {/* Header */}
              <Pressable
                onPress={() => { setExpandedId(isExpanded ? null : item.id); Haptics.selectionAsync(); }}
                style={styles.faqHeader}
              >
                <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                <View style={styles.faqHeaderCenter}>
                  <Text style={styles.faqQuestion} numberOfLines={isExpanded ? undefined : 2}>
                    {item.question}
                  </Text>
                  <View style={[styles.catBadge, { backgroundColor: catColor + '22', borderColor: catColor }]}>
                    <Text style={[styles.catBadgeText, { color: catColor }]}>{item.category}</Text>
                  </View>
                </View>
              </Pressable>

              {/* Answer (expanded) */}
              {isExpanded && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{item.answer}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.faqActions}>
                <View style={styles.faqReorder}>
                  <Pressable
                    onPress={() => handleMove(item.id, 'up')}
                    disabled={fullIdx === 0}
                    style={[styles.reorderBtn, fullIdx === 0 && { opacity: 0.3 }]}
                  >
                    <Text style={styles.reorderText}>▲</Text>
                  </Pressable>
                  <Text style={styles.orderNum}>{item.order}</Text>
                  <Pressable
                    onPress={() => handleMove(item.id, 'down')}
                    disabled={fullIdx === sortedItems.length - 1}
                    style={[styles.reorderBtn, fullIdx === sortedItems.length - 1 && { opacity: 0.3 }]}
                  >
                    <Text style={styles.reorderText}>▼</Text>
                  </Pressable>
                </View>
                <View style={styles.faqBtns}>
                  <Pressable onPress={() => startEdit(item)} style={styles.editBtn}>
                    <Text style={styles.editBtnText}>✏️ ערוך</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>🗑 מחק</Text>
                  </Pressable>
                </View>
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
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
    textAlignVertical: 'top',
    writingDirection: 'rtl',
    minHeight: 44,
  },
  answerInput: { minHeight: 80 },
  catRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
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

  faqCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  expandIcon: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  faqHeaderCenter: { flex: 1, gap: 6 },
  faqQuestion: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 20,
  },
  catBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  catBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },

  faqAnswer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  faqAnswerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 22,
  },

  faqActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  faqReorder: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  reorderBtn: {
    padding: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reorderText: { fontFamily: FontFamily.bold, fontSize: 11, color: Colors.textSecondary },
  orderNum: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    minWidth: 20,
    textAlign: 'center',
  },
  faqBtns: { flexDirection: 'row-reverse', gap: 8 },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(124,111,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.3)',
  },
  editBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#9E99FA' },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  deleteBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#EF4444' },
});
