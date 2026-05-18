import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, DailyChallenge } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHe(dateStr: string) {
  try {
    const [y, m, day] = dateStr.split('-').map(Number);
    return `${day}/${m}/${y}`;
  } catch { return dateStr; }
}

export default function DailyChallengeScreen() {
  const { dailyChallenges, questions, topics, addDailyChallenge, updateDailyChallenge, removeDailyChallenge } = useAdminStore();

  const today = todayStr();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<DailyChallenge | null>(null);
  const [dateInput, setDateInput] = useState(today);
  const [titleInput, setTitleInput] = useState('');
  const [bonusXpInput, setBonusXpInput] = useState('50');
  const [qSearch, setQSearch] = useState('');
  const [selectedQId, setSelectedQId] = useState('');
  const [showQPicker, setShowQPicker] = useState(false);

  const sortedChallenges = useMemo(() =>
    [...dailyChallenges].sort((a, b) => a.date.localeCompare(b.date)),
    [dailyChallenges]
  );

  const todayChallenge = dailyChallenges.find(c => c.date === today);

  const filteredQuestions = useMemo(() => {
    const q = qSearch.toLowerCase();
    return questions
      .filter(q2 => q2.validationStatus === 'validated')
      .filter(q2 => !q || q2.questionText.toLowerCase().includes(q) || q2.id.includes(q))
      .slice(0, 30);
  }, [questions, qSearch]);

  const openAdd = () => {
    setEditTarget(null);
    setDateInput(today);
    setTitleInput('');
    setBonusXpInput('50');
    setSelectedQId('');
    setShowModal(true);
  };

  const openEdit = (c: DailyChallenge) => {
    setEditTarget(c);
    setDateInput(c.date);
    setTitleInput(c.title);
    setBonusXpInput(String(c.bonusXp));
    setSelectedQId(c.questionId);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('שגיאה', 'פורמט תאריך: YYYY-MM-DD'); return;
    }
    if (!selectedQId) {
      Alert.alert('שגיאה', 'בחר שאלה לאתגר'); return;
    }
    const bonus = parseInt(bonusXpInput, 10);
    if (isNaN(bonus) || bonus < 0 || bonus > 1000) {
      Alert.alert('שגיאה', 'בונוס XP: 0–1000'); return;
    }
    const title = titleInput.trim() || 'אתגר יומי';

    if (editTarget) {
      updateDailyChallenge(editTarget.id, { date: dateInput, questionId: selectedQId, title, bonusXp: bonus });
    } else {
      const exists = dailyChallenges.find(c => c.date === dateInput);
      if (exists) {
        Alert.alert('שגיאה', 'כבר קיים אתגר לתאריך זה'); return;
      }
      addDailyChallenge({ date: dateInput, questionId: selectedQId, title, bonusXp: bonus });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
  };

  const handleDelete = (c: DailyChallenge) => {
    Alert.alert('מחיקת אתגר', `למחוק את האתגר של ${formatDateHe(c.date)}?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => {
        removeDailyChallenge(c.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }},
    ]);
  };

  const getQuestion = (id: string) => questions.find(q => q.id === id);
  const getTopic = (topicId: string) => topics.find(t => t.id === topicId);
  const selectedQ = questions.find(q => q.id === selectedQId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎯 אתגרים יומיים</Text>
        <Text style={styles.headerSub}>{dailyChallenges.length} אתגרים מוגדרים</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Today card */}
        <View style={[styles.todayCard, !todayChallenge && { borderStyle: 'dashed' }]}>
          {todayChallenge ? (
            <>
              <View style={styles.todayTop}>
                <Pressable onPress={() => openEdit(todayChallenge)} style={styles.editTodayBtn}>
                  <Text style={styles.editTodayBtnText}>עריכה</Text>
                </Pressable>
                <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>היום</Text></View>
              </View>
              <Text style={styles.todayTitle}>{todayChallenge.title}</Text>
              <Text style={styles.todayDate}>{formatDateHe(todayChallenge.date)}</Text>
              <View style={styles.todayMeta}>
                {(() => {
                  const q = getQuestion(todayChallenge.questionId);
                  const topic = q ? getTopic(q.topicId) : null;
                  return q ? (
                    <>
                      <Text style={styles.todayQText} numberOfLines={2}>{q.questionText}</Text>
                      <View style={styles.todayQMeta}>
                        {topic && <Text style={styles.todayChip}>{topic.icon} {topic.name}</Text>}
                        <Text style={styles.todayChip}>קושי {q.difficulty}</Text>
                        <Text style={[styles.todayChip, { backgroundColor: Colors.warning + '25', color: Colors.warning }]}>+{todayChallenge.bonusXp} XP</Text>
                      </View>
                    </>
                  ) : <Text style={styles.todayQText}>שאלה לא נמצאה (ID: {todayChallenge.questionId})</Text>;
                })()}
              </View>
            </>
          ) : (
            <Pressable onPress={openAdd} style={styles.addTodayBtn}>
              <Text style={styles.addTodayIcon}>+</Text>
              <Text style={styles.addTodayText}>הגדר אתגר יומי להיום</Text>
            </Pressable>
          )}
        </View>

        {/* List */}
        <View style={styles.listHeader}>
          <Pressable onPress={openAdd} style={styles.addBtn}>
            <LinearGradient colors={Colors.gradients.primary} style={styles.addBtnGrad}>
              <Text style={styles.addBtnText}>+ הוסף אתגר</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.listTitle}>כל האתגרים</Text>
        </View>

        {sortedChallenges.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>אין אתגרים עדיין. הוסף אתגר ראשון!</Text>
          </View>
        )}

        {sortedChallenges.map(c => {
          const q = getQuestion(c.questionId);
          const topic = q ? getTopic(q.topicId) : null;
          const isToday = c.date === today;
          const isPast = c.date < today;

          return (
            <View key={c.id} style={[styles.challengeCard, isToday && styles.challengeCardToday, isPast && styles.challengeCardPast]}>
              <View style={styles.challengeLeft}>
                <Text style={[styles.challengeDate, isPast && { color: Colors.textTertiary }]}>
                  {formatDateHe(c.date)}
                  {isToday && <Text style={{ color: Colors.primary }}> (היום)</Text>}
                  {isPast && <Text style={{ color: Colors.textTertiary }}> (עבר)</Text>}
                </Text>
                <Text style={styles.challengeTitle}>{c.title}</Text>
                {q ? (
                  <Text style={styles.challengeQText} numberOfLines={1}>{q.questionText}</Text>
                ) : (
                  <Text style={[styles.challengeQText, { color: Colors.danger }]}>⚠️ שאלה חסרה</Text>
                )}
                <View style={styles.challengeMeta}>
                  {topic && <Text style={styles.challengeChip}>{topic.icon} {topic.name}</Text>}
                  <Text style={[styles.challengeChip, { color: Colors.warning }]}>+{c.bonusXp} XP</Text>
                </View>
              </View>
              <View style={styles.challengeActions}>
                <Pressable onPress={() => openEdit(c)} style={styles.chalBtn}>
                  <Text style={styles.chalBtnText}>✏️</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(c)} style={[styles.chalBtn, { backgroundColor: Colors.dangerLight }]}>
                  <Text style={styles.chalBtnText}>🗑️</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editTarget ? 'עריכת אתגר' : 'הוסף אתגר יומי'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>תאריך (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="2025-01-15"
                placeholderTextColor={Colors.textTertiary}
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>כותרת האתגר</Text>
              <TextInput
                style={styles.input}
                value={titleInput}
                onChangeText={setTitleInput}
                placeholder="אתגר יומי"
                placeholderTextColor={Colors.textTertiary}
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>בונוס XP</Text>
              <TextInput
                style={styles.input}
                value={bonusXpInput}
                onChangeText={setBonusXpInput}
                keyboardType="numeric"
                textAlign="center"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>שאלה נבחרת</Text>
              <Pressable onPress={() => setShowQPicker(true)} style={styles.qPickerBtn}>
                {selectedQ ? (
                  <Text style={styles.qPickerSelected} numberOfLines={2}>{selectedQ.questionText}</Text>
                ) : (
                  <Text style={styles.qPickerPlaceholder}>לחץ לבחירת שאלה...</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.confirmBtn}>
                <LinearGradient colors={Colors.gradients.primary} style={styles.confirmBtnGrad}>
                  <Text style={styles.confirmBtnText}>{editTarget ? 'עדכן ←' : 'הוסף ←'}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Question Picker Modal */}
      <Modal visible={showQPicker} transparent animationType="slide" onRequestClose={() => setShowQPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>בחר שאלה</Text>
            <TextInput
              style={styles.qSearch}
              placeholder="חפש שאלה..."
              placeholderTextColor={Colors.textTertiary}
              value={qSearch}
              onChangeText={setQSearch}
              textAlign="right"
            />
            <FlatList
              data={filteredQuestions}
              keyExtractor={item => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const topic = getTopic(item.topicId);
                return (
                  <Pressable
                    onPress={() => { setSelectedQId(item.id); setShowQPicker(false); }}
                    style={[styles.qItem, selectedQId === item.id && { backgroundColor: Colors.primaryLighter }]}
                  >
                    <View style={styles.qItemMeta}>
                      <Text style={styles.qItemTopic}>{topic?.icon} {topic?.name ?? item.topicId}</Text>
                      <Text style={styles.qItemDiff}>קושי {item.difficulty}</Text>
                    </View>
                    <Text style={styles.qItemText} numberOfLines={2}>{item.questionText}</Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty2}>לא נמצאו שאלות מאושרות</Text>}
            />
            <Pressable onPress={() => setShowQPicker(false)} style={[styles.cancelBtn, { margin: 0, marginTop: 12 }]}>
              <Text style={styles.cancelBtnText}>סגור</Text>
            </Pressable>
          </View>
        </View>
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
  content: { padding: 16, paddingBottom: 40, gap: 12 },

  todayCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 2, borderColor: Colors.primary,
    padding: 16, ...Shadow.md,
  },
  todayTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  todayBadge: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  todayBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },
  editTodayBtn: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  editTodayBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  todayTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right' },
  todayDate: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginBottom: 10 },
  todayMeta: { gap: 8 },
  todayQText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20 },
  todayQMeta: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  todayChip: {
    backgroundColor: Colors.primaryLighter, color: Colors.primary,
    fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  addTodayBtn: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  addTodayIcon: { fontSize: 36, color: Colors.primary },
  addTodayText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.primary },

  listHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  listTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.base, color: Colors.text },
  addBtn: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  addBtnGrad: { paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary },
  empty2: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'right', padding: 16 },

  challengeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row-reverse',
    alignItems: 'center', gap: 10, ...Shadow.sm,
  },
  challengeCardToday: { borderColor: Colors.primary, borderWidth: 2 },
  challengeCardPast: { opacity: 0.6 },
  challengeLeft: { flex: 1, gap: 3, alignItems: 'flex-end' },
  challengeDate: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  challengeTitle: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  challengeQText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right' },
  challengeMeta: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  challengeChip: {
    backgroundColor: Colors.surfaceSecondary, fontFamily: FontFamily.medium,
    fontSize: 10, color: Colors.textSecondary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  challengeActions: { gap: 6 },
  chalBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  chalBtnText: { fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'], padding: 24, gap: 12,
  },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text, textAlign: 'right' },
  inputGroup: { gap: 6 },
  inputLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.text,
  },
  qPickerBtn: {
    backgroundColor: Colors.background, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 12, minHeight: 50, justifyContent: 'center',
  },
  qPickerSelected: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  qPickerPlaceholder: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'right' },
  qSearch: {
    backgroundColor: Colors.background, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 10,
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, marginBottom: 8,
  },
  qItem: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 4,
  },
  qItemMeta: { flexDirection: 'row-reverse', gap: 8 },
  qItemTopic: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.primary },
  qItemDiff: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  qItemText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  modalActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceSecondary, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
  confirmBtn: { flex: 2, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  confirmBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
