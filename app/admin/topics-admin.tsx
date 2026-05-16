import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAdminStore } from '../../store/adminStore';
import { TARGETS } from '../../data/mockData';
import { Topic } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const TOPIC_ICONS = ['🔢', '📚', '🧩', '🔷', '🇬🇧', '🧪', '🗺️', '💡', '🎵', '🏛️'];
const TOPIC_COLORS = [Colors.primary, Colors.accent, '#0EA5E9', Colors.success, Colors.warning, Colors.danger, '#6D28D9', '#EC4899'];

export default function TopicsAdmin() {
  const { topics, addTopic, updateTopic, deleteTopic } = useAdminStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetId, setTargetId] = useState(TARGETS[0]?.id ?? '');
  const [icon, setIcon] = useState('🔢');
  const [color, setColor] = useState(Colors.primary);
  const [isPremium, setIsPremium] = useState(false);

  const resetForm = () => {
    setName(''); setDescription('');
    setTargetId(TARGETS[0]?.id ?? '');
    setIcon('🔢'); setColor(Colors.primary);
    setIsPremium(false); setEditId(null);
  };

  const openEdit = (t: Topic) => {
    setName(t.name); setDescription(t.description);
    setTargetId(t.targetId); setIcon(t.icon);
    setColor(t.color); setIsPremium(t.isPremiumOnly);
    setEditId(t.id); setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('שגיאה', 'נא להזין שם'); return; }
    const data: Omit<Topic, 'id'> = {
      name: name.trim(),
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: description.trim(),
      targetId,
      icon,
      color,
      isPremiumOnly: isPremium,
      order: topics.length + 1,
    };

    if (editId) {
      updateTopic(editId, data);
    } else {
      addTopic(data);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false);
    resetForm();
  };

  const topicsByTarget = TARGETS.map(t => ({
    target: t,
    topics: topics.filter(tp => tp.targetId === t.id),
  }));

  if (showForm) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editId ? '✏️ עריכת נושא' : '📚 נושא חדש'}</Text>
            <Pressable onPress={() => { setShowForm(false); resetForm(); }} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>ביטול</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>שם הנושא</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} textAlign="right" placeholder="לדוגמה: חשיבה כמותית" placeholderTextColor={Colors.textTertiary} />

            <Text style={[styles.label, { marginTop: 12 }]}>תיאור</Text>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={description} onChangeText={setDescription} multiline textAlign="right" placeholder="תיאור קצר..." placeholderTextColor={Colors.textTertiary} textAlignVertical="top" />

            <Text style={[styles.label, { marginTop: 12 }]}>מסלול</Text>
            <View style={styles.chipRow}>
              {TARGETS.filter(t => !t.comingSoon).map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => setTargetId(t.id)}
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
                  onPress={() => setIcon(ic)}
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
                  onPress={() => setColor(c)}
                  style={[styles.colorBtn, { backgroundColor: c }, color === c && styles.colorBtnActive]}
                />
              ))}
            </View>

            <View style={[styles.switchRow, { marginTop: 16 }]}>
              <Text style={styles.switchLabel}>נושא פרמיום בלבד 💎</Text>
              <Switch
                value={isPremium}
                onValueChange={setIsPremium}
                trackColor={{ true: Colors.warning, false: Colors.border }}
              />
            </View>
          </View>

          {/* Preview */}
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: color }]}>
            <Text style={styles.previewLabel}>תצוגה מקדימה</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewIcon}>{icon}</Text>
              <View>
                <Text style={[styles.previewName, { color }]}>{name || 'שם הנושא'}</Text>
                <Text style={styles.previewDesc}>{description || 'תיאור הנושא'}</Text>
                {isPremium && <Text style={styles.premiumTag}>💎 פרמיום</Text>}
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>נושאים ({topics.length})</Text>
          <Pressable onPress={() => { resetForm(); setShowForm(true); }} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ נושא חדש</Text>
          </Pressable>
        </View>

        {topicsByTarget.map(({ target, topics: tTopics }) => (
          tTopics.length === 0 ? null : (
            <View key={target.id} style={{ marginBottom: 16 }}>
              <Text style={styles.targetLabel}>{target.icon} {target.name}</Text>
              {tTopics.map(topic => (
                <View key={topic.id} style={[styles.topicCard, { borderRightWidth: 4, borderRightColor: topic.color }]}>
                  <View style={styles.topicLeft}>
                    <Text style={styles.topicIcon}>{topic.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={styles.topicNameRow}>
                        <Text style={[styles.topicName, { color: topic.color }]}>{topic.name}</Text>
                        {topic.isPremiumOnly && <Text style={styles.premiumBadge}>💎</Text>}
                      </View>
                      <Text style={styles.topicDesc} numberOfLines={2}>{topic.description}</Text>
                    </View>
                  </View>
                  <View style={styles.topicActions}>
                    <Pressable onPress={() => openEdit(topic)} style={[styles.tAction, { backgroundColor: Colors.primaryLighter }]}>
                      <Text style={[styles.tActionText, { color: Colors.primary }]}>✏️</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Alert.alert('מחיקה', `למחוק את "${topic.name}"?`, [
                          { text: 'ביטול', style: 'cancel' },
                          { text: 'מחק', style: 'destructive', onPress: () => deleteTopic(topic.id) },
                        ]);
                      }}
                      style={[styles.tAction, { backgroundColor: Colors.dangerLight }]}
                    >
                      <Text style={[styles.tActionText, { color: Colors.danger }]}>🗑️</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updateTopic(topic.id, { isPremiumOnly: !topic.isPremiumOnly })}
                      style={[styles.tAction, { backgroundColor: topic.isPremiumOnly ? Colors.warningLight : Colors.surfaceSecondary }]}
                    >
                      <Text style={styles.tActionText}>{topic.isPremiumOnly ? '💎' : '🔓'}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  listHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  listTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text },
  newBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8, ...Shadow.primary },
  newBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  targetLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'right', marginBottom: 8 },
  topicCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 12, marginBottom: 8, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  topicLeft: { flexDirection: 'row-reverse', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  topicIcon: { fontSize: 24, marginTop: 2 },
  topicNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  topicName: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
  premiumBadge: { fontSize: 14 },
  topicDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
  topicActions: { flexDirection: 'row-reverse', gap: 6, justifyContent: 'flex-start' },
  tAction: { borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 6 },
  tActionText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm },

  // Form
  formHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text },
  cancelBtn: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  cancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  label: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 8 },
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

  previewLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginBottom: 10 },
  previewRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  previewIcon: { fontSize: 32 },
  previewName: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, textAlign: 'right' },
  previewDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  premiumTag: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.warning, marginTop: 2 },

  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 18, alignItems: 'center', ...Shadow.primary, marginTop: 4 },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
});
