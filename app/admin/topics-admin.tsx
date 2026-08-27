import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Topic } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import AdminSyncToolbar from '../../components/AdminSyncToolbar';

const TOPIC_ICONS = ['🔢', '📚', '🧩', '🔷', '🇬🇧', '🧪', '🗺️', '💡', '🎵', '🏛️', '⚡', '🔬', '🎯', '🌍', '🧮'];
const TOPIC_COLORS = [
  Colors.primary, Colors.accent, '#0EA5E9', Colors.success,
  Colors.warning, Colors.danger, '#6D28D9', '#EC4899', '#F59E0B', '#14B8A6',
];

function makeSlug(name: string, existingId?: string): string {
  // Use existing id prefix if editing, otherwise generate from timestamp
  const prefix = existingId ? existingId.replace(/^topic_/, '') : `t${Date.now()}`;
  const ascii = name
    .toLowerCase()
    .replace(/[אבגדהוזחטיכךלמםנןסעפףצץקרשת]/g, '')  // strip Hebrew
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return ascii.length >= 3 ? ascii : `topic-${prefix}`;
}

export default function TopicsAdmin() {
  const { topics, targets, addTopic, updateTopic, deleteTopic, questions } = useAdminStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTarget, setFilterTarget] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [icon, setIcon] = useState('🔢');
  const [color, setColor] = useState(Colors.primary);
  const [isPremium, setIsPremium] = useState(false);

  const markDirty = () => setIsDirty(true);

  useEffect(() => {
    if (!targetId && targets[0]?.id) setTargetId(targets[0].id);
  }, [targetId, targets]);

  const resetForm = () => {
    setName(''); setDescription('');
    setTargetId(targets[0]?.id ?? '');
    setIcon('🔢'); setColor(Colors.primary);
    setIsPremium(false); setEditId(null);
    setIsDirty(false);
  };

  const openEdit = (t: Topic) => {
    setName(t.name); setDescription(t.description);
    setTargetId(t.targetId); setIcon(t.icon);
    setColor(t.color); setIsPremium(t.isPremiumOnly);
    setEditId(t.id); setIsDirty(false); setShowForm(true);
  };

  const handleCancel = () => {
    if (isDirty) {
      Alert.alert('ביטול עריכה', 'יש שינויים שלא נשמרו. לבטל?', [
        { text: 'המשך עריכה', style: 'cancel' },
        { text: 'בטל', style: 'destructive', onPress: () => { setShowForm(false); resetForm(); } },
      ]);
    } else {
      setShowForm(false); resetForm();
    }
  };

  const handleSave = () => {
    const trimName = name.trim();
    if (!trimName) { Alert.alert('שגיאה', 'נא להזין שם לנושא'); return; }
    if (trimName.length < 2) { Alert.alert('שגיאה', 'שם חייב להכיל לפחות 2 תווים'); return; }

    // Check for duplicate name in same target
    const dup = topics.find(t =>
      t.targetId === targetId && t.name.trim().toLowerCase() === trimName.toLowerCase() && t.id !== editId
    );
    if (dup) {
      Alert.alert('שם כפול', `הנושא "${trimName}" כבר קיים במסלול זה`);
      return;
    }

    const slug = makeSlug(trimName, editId ?? undefined);
    const data: Omit<Topic, 'id'> = {
      name: trimName,
      slug,
      description: description.trim(),
      targetId,
      icon,
      color,
      isPremiumOnly: isPremium,
      order: editId ? (topics.find(t => t.id === editId)?.order ?? topics.length + 1) : topics.length + 1,
    };

    if (editId) {
      updateTopic(editId, data);
      Alert.alert('עודכן!', `הנושא "${trimName}" עודכן`);
    } else {
      addTopic(data);
      Alert.alert('נוסף!', `הנושא "${trimName}" נוסף בהצלחה`);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false);
    resetForm();
  };

  // Compute question count per topic
  const qPerTopic = useMemo(() => {
    const map: Record<string, { total: number; validated: number }> = {};
    questions.forEach(q => {
      const tid = q.topicId;
      if (!tid) return;
      if (!map[tid]) map[tid] = { total: 0, validated: 0 };
      map[tid].total++;
      if (q.validationStatus === 'validated') map[tid].validated++;
    });
    return map;
  }, [questions]);

  const filteredTopics = useMemo(() => {
    let result = [...topics];
    if (filterTarget) result = result.filter(t => t.targetId === filterTarget);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [topics, filterTarget, search]);

  const topicsByTarget = targets.map(t => ({
    target: t,
    topics: filteredTopics.filter(tp => tp.targetId === t.id),
  }));

  const moveOrder = (topicId: string, dir: 'up' | 'down') => {
    const sorted = [...topics].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex(t => t.id === topicId);
    if (idx === -1) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    updateTopic(a.id, { order: b.order ?? swapIdx });
    updateTopic(b.id, { order: a.order ?? idx });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const setVisibleTopicsPremium = (premium: boolean) => {
    filteredTopics.forEach(topic => updateTopic(topic.id, { isPremiumOnly: premium }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const sortVisibleTopicsByQuestionCount = () => {
    const sorted = [...filteredTopics].sort((a, b) => (qPerTopic[b.id]?.total ?? 0) - (qPerTopic[a.id]?.total ?? 0));
    sorted.forEach((topic, index) => updateTopic(topic.id, { order: index + 1 }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (showForm) {
    const qCount = editId ? (qPerTopic[editId] ?? { total: 0, validated: 0 }) : { total: 0, validated: 0 };
    const previewSlug = makeSlug(name || 'שם הנושא', editId ?? undefined);
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editId ? '✏️ עריכת נושא' : '📚 נושא חדש'}</Text>
            <Pressable onPress={handleCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>ביטול</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>שם הנושא *</Text>
            <TextInput
              style={styles.input} value={name}
              onChangeText={v => { setName(v); markDirty(); }}
              textAlign="right" placeholder="לדוגמה: חשיבה כמותית"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.charCount}>{name.length} / 50 | slug: {previewSlug}</Text>

            <Text style={[styles.label, { marginTop: 12 }]}>תיאור</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]} value={description}
              onChangeText={v => { setDescription(v); markDirty(); }}
              multiline textAlign="right" placeholder="תיאור קצר של הנושא..."
              placeholderTextColor={Colors.textTertiary} textAlignVertical="top"
            />

            <Text style={[styles.label, { marginTop: 12 }]}>מסלול</Text>
            <View style={styles.chipRow}>
              {targets.filter(t => !t.comingSoon).map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => { setTargetId(t.id); markDirty(); }}
                  style={[styles.chip, targetId === t.id && { backgroundColor: t.color, borderColor: t.color }]}
                >
                  <Text style={[styles.chipText, targetId === t.id && { color: '#fff' }]}>{t.icon} {t.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>אייקון</Text>
            <View style={styles.iconRow}>
              {TOPIC_ICONS.map(ic => (
                <Pressable
                  key={ic}
                  onPress={() => { setIcon(ic); markDirty(); }}
                  style={[styles.iconBtn, icon === ic && { backgroundColor: Colors.primaryLighter, borderColor: Colors.primary }]}
                >
                  <Text style={styles.iconBtnText}>{ic}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>צבע</Text>
            <View style={styles.colorRow}>
              {TOPIC_COLORS.map(c => (
                <Pressable
                  key={c}
                  onPress={() => { setColor(c); markDirty(); }}
                  style={[styles.colorBtn, { backgroundColor: c }, color === c && styles.colorBtnActive]}
                />
              ))}
            </View>

            <View style={[styles.switchRow, { marginTop: 16 }]}>
              <Text style={styles.switchLabel}>נושא פרמיום בלבד 💎</Text>
              <Switch
                value={isPremium}
                onValueChange={v => { setIsPremium(v); markDirty(); }}
                trackColor={{ true: Colors.warning, false: Colors.border }}
              />
            </View>

            {editId && (
              <View style={styles.editStats}>
                <Text style={styles.editStatsText}>
                  📊 שאלות בנושא זה: {qCount.total} (מאושרות: {qCount.validated})
                </Text>
              </View>
            )}
          </View>

          {/* Preview */}
          <View style={[styles.card, { borderRightWidth: 4, borderRightColor: color }]}>
            <Text style={styles.previewLabel}>תצוגה מקדימה</Text>
            <View style={styles.previewRow}>
              <View style={[styles.previewIconWrap, { backgroundColor: color + '20' }]}>
                <Text style={styles.previewIcon}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewName, { color }]}>{name || 'שם הנושא'}</Text>
                <Text style={styles.previewDesc}>{description || 'תיאור הנושא'}</Text>
                <View style={styles.previewTags}>
                  {isPremium && <Text style={styles.premiumTag}>💎 פרמיום</Text>}
                  <Text style={styles.slugTag}>/{previewSlug}</Text>
                </View>
              </View>
            </View>
          </View>

          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{editId ? '💾 שמור שינויים' : '➕ הוסף נושא'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const totalTopics = topics.length;
  const premiumCount = topics.filter(t => t.isPremiumOnly).length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdminSyncToolbar
          title="ניהול נושאים ופרקים"
          subtitle="שינוי שם, תיאור, סדר, שיוך למסלול וגישה לפרימיום נשמרים מול Supabase ומשפיעים על האפליקציה."
          counters={[
            { label: 'נושאים', value: totalTopics, tone: 'primary' },
            { label: 'פרימיום', value: premiumCount, tone: 'warning' },
            { label: 'מסלולים', value: targets.length, tone: 'primary' },
            { label: 'שאלות משויכות', value: questions.length, tone: 'success' },
          ]}
        />

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatChip icon="📚" label="נושאים" value={totalTopics} color={Colors.primary} />
          <StatChip icon="🔓" label="חינמי" value={totalTopics - premiumCount} color={Colors.success} />
          <StatChip icon="💎" label="פרמיום" value={premiumCount} color={Colors.warning} />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>ניהול נושאים</Text>
          <Pressable onPress={() => { resetForm(); setShowForm(true); }} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ נושא חדש</Text>
          </Pressable>
        </View>

        {/* Search + filter */}
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput} value={search}
            onChangeText={setSearch} textAlign="right"
            placeholder="🔍 חיפוש נושא..."
            placeholderTextColor={Colors.textTertiary}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.searchClear}>
              <Text style={{ color: Colors.textSecondary }}>✕</Text>
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}
          contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, padding: 4 }}>
          <Pressable
            onPress={() => setFilterTarget(null)}
            style={[styles.filterChip, !filterTarget && { backgroundColor: Colors.primary }]}
          >
            <Text style={[styles.filterChipText, !filterTarget && { color: '#fff' }]}>הכל</Text>
          </Pressable>
          {targets.filter(t => !t.comingSoon).map(t => (
            <Pressable
              key={t.id}
              onPress={() => setFilterTarget(filterTarget === t.id ? null : t.id)}
              style={[styles.filterChip, filterTarget === t.id && { backgroundColor: t.color, borderColor: t.color }]}
            >
              <Text style={[styles.filterChipText, filterTarget === t.id && { color: '#fff' }]}>{t.icon} {t.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.bulkTopicBar}>
          <Pressable onPress={() => setVisibleTopicsPremium(true)} style={[styles.bulkTopicBtn, { backgroundColor: Colors.warningLight }]}>
            <Text style={[styles.bulkTopicText, { color: Colors.warning }]}>הפוך מוצגים לפרימיום</Text>
          </Pressable>
          <Pressable onPress={() => setVisibleTopicsPremium(false)} style={[styles.bulkTopicBtn, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.bulkTopicText, { color: Colors.success }]}>הפוך מוצגים לחינם</Text>
          </Pressable>
          <Pressable onPress={sortVisibleTopicsByQuestionCount} style={[styles.bulkTopicBtn, { backgroundColor: Colors.primaryLighter }]}>
            <Text style={[styles.bulkTopicText, { color: Colors.primary }]}>מיין לפי שאלות</Text>
          </Pressable>
        </View>

        {filteredTopics.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>
              {search.length > 0 || filterTarget ? 'לא נמצאו נושאים' : 'לא קיימים נושאים עדיין'}
            </Text>
          </View>
        )}

        {topicsByTarget.map(({ target, topics: tTopics }) => (
          tTopics.length === 0 ? null : (
            <View key={target.id} style={{ marginBottom: 16 }}>
              <Text style={styles.targetLabel}>{target.icon} {target.name} ({tTopics.length})</Text>
              {tTopics.map((topic, idx) => {
                const qc = qPerTopic[topic.id] ?? { total: 0, validated: 0 };
                const sortedInTarget = filteredTopics.filter(t => t.targetId === target.id);
                const posInTarget = sortedInTarget.findIndex(t => t.id === topic.id);
                return (
                  <View key={topic.id} style={[styles.topicCard, { borderRightWidth: 4, borderRightColor: topic.color }]}>
                    <View style={styles.topicMain}>
                      <View style={[styles.topicIconWrap, { backgroundColor: topic.color + '20' }]}>
                        <Text style={styles.topicIconText}>{topic.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.topicNameRow}>
                          <Text style={[styles.topicName, { color: topic.color }]}>{topic.name}</Text>
                          {topic.isPremiumOnly && <Text style={styles.premiumBadge}>💎</Text>}
                        </View>
                        <Text style={styles.topicDesc} numberOfLines={2}>{topic.description}</Text>
                        <View style={styles.topicMeta}>
                          <Text style={styles.topicMetaText}>
                            📊 {qc.total} שאלות ({qc.validated} מאושרות)
                          </Text>
                          <Text style={styles.topicMetaSlug}>/{topic.slug}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.topicActions}>
                      {/* Order buttons */}
                      <View style={styles.orderBtns}>
                        <Pressable
                          onPress={() => moveOrder(topic.id, 'up')}
                          style={[styles.orderBtn, posInTarget === 0 && { opacity: 0.3 }]}
                          disabled={posInTarget === 0}
                        >
                          <Text style={styles.orderBtnText}>▲</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => moveOrder(topic.id, 'down')}
                          style={[styles.orderBtn, posInTarget === sortedInTarget.length - 1 && { opacity: 0.3 }]}
                          disabled={posInTarget === sortedInTarget.length - 1}
                        >
                          <Text style={styles.orderBtnText}>▼</Text>
                        </Pressable>
                      </View>

                      <Pressable onPress={() => openEdit(topic)} style={[styles.tAction, { backgroundColor: Colors.primaryLighter }]}>
                        <Text style={[styles.tActionText, { color: Colors.primary }]}>✏️ ערוך</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => updateTopic(topic.id, { isPremiumOnly: !topic.isPremiumOnly })}
                        style={[styles.tAction, { backgroundColor: topic.isPremiumOnly ? Colors.warningLight : Colors.surfaceSecondary }]}
                      >
                        <Text style={styles.tActionText}>{topic.isPremiumOnly ? '💎 פרמיום' : '🔓 חינמי'}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (qc.total > 0) {
                            Alert.alert(
                              'מחיקת נושא',
                              `לנושא "${topic.name}" יש ${qc.total} שאלות. מחיקת הנושא לא תמחק את השאלות. להמשיך?`,
                              [
                                { text: 'ביטול', style: 'cancel' },
                                { text: 'מחק נושא', style: 'destructive', onPress: () => deleteTopic(topic.id) },
                              ]
                            );
                          } else {
                            Alert.alert('מחיקה', `למחוק את "${topic.name}"?`, [
                              { text: 'ביטול', style: 'cancel' },
                              { text: 'מחק', style: 'destructive', onPress: () => deleteTopic(topic.id) },
                            ]);
                          }
                        }}
                        style={[styles.tAction, { backgroundColor: Colors.dangerLight }]}
                      >
                        <Text style={[styles.tActionText, { color: Colors.danger }]}>🗑️</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={[scStyles.chip, { borderColor: color + '40', backgroundColor: color + '10' }]}>
      <Text style={scStyles.icon}>{icon}</Text>
      <Text style={[scStyles.value, { color }]}>{value}</Text>
      <Text style={scStyles.label}>{label}</Text>
    </View>
  );
}

const scStyles = StyleSheet.create({
  chip: { flex: 1, alignItems: 'center', borderRadius: Radius.lg, padding: 10, borderWidth: 1 },
  icon: { fontSize: 16, marginBottom: 2 },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, writingDirection: 'rtl' },
  content: { padding: 16, paddingBottom: 40, writingDirection: 'rtl' },

  statsRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 16 },

  listHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text, textAlign: 'right', writingDirection: 'rtl' },
  newBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8, ...Shadow.primary },
  newBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  searchWrap: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, ...Shadow.sm },
  searchInput: { flex: 1, padding: 10, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', writingDirection: 'rtl' },
  searchClear: { padding: 10 },

  filterScroll: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  bulkTopicBar: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  bulkTopicBtn: { flexGrow: 1, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 9, alignItems: 'center' },
  bulkTopicText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, textAlign: 'center', writingDirection: 'rtl' },

  targetLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'right', marginBottom: 8 },

  topicCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 12, marginBottom: 8, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
    writingDirection: 'rtl',
  },
  topicMain: { flexDirection: 'row-reverse', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  topicIconWrap: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  topicIconText: { fontSize: 22 },
  topicNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  topicName: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
  premiumBadge: { fontSize: 14 },
  topicDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
  topicMeta: { flexDirection: 'row-reverse', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' },
  topicMetaText: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textSecondary },
  topicMetaSlug: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },

  topicActions: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  orderBtns: { flexDirection: 'column', gap: 2 },
  orderBtn: { width: 26, height: 20, borderRadius: 6, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  orderBtnText: { fontSize: 9, color: Colors.textSecondary },
  tAction: { borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 6 },
  tActionText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },

  emptyWrap: { alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary },

  // Form
  formHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text },
  cancelBtn: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  cancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  label: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 8 },
  charCount: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
  input: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surfaceSecondary, borderWidth: 1.5, borderColor: Colors.border },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  iconRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  iconBtnText: { fontSize: 20 },
  colorRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  colorBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'transparent' },
  colorBtnActive: { borderWidth: 3, borderColor: Colors.text },
  switchRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text },

  editStats: { marginTop: 12, backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 10 },
  editStatsText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },

  previewLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginBottom: 10 },
  previewRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 },
  previewIconWrap: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  previewIcon: { fontSize: 28 },
  previewName: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, textAlign: 'right' },
  previewDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  previewTags: { flexDirection: 'row-reverse', gap: 8, marginTop: 4, alignItems: 'center' },
  premiumTag: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.warning },
  slugTag: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },

  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 18, alignItems: 'center', ...Shadow.primary, marginTop: 4 },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
});
