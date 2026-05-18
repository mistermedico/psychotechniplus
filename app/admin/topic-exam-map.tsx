import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, SimulationRule } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

export default function TopicExamMapScreen() {
  const insets = useSafeAreaInsets();
  const {
    topics, templates, questions,
    addTopicRuleToTemplate, removeTopicRuleFromTemplate,
  } = useAdminStore();

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [pendingTopicId, setPendingTopicId] = useState('');
  const [pendingTemplateId, setPendingTemplateId] = useState('');
  const [ruleCount, setRuleCount] = useState('10');
  const [ruleMinDiff, setRuleMinDiff] = useState('1');
  const [ruleMaxDiff, setRuleMaxDiff] = useState('10');
  const [useAdaptive, setUseAdaptive] = useState(true);

  // qPerTopic: question count per topic
  const qPerTopic = useMemo(() => {
    const map: Record<string, number> = {};
    questions.forEach(q => { map[q.topicId] = (map[q.topicId] ?? 0) + 1; });
    return map;
  }, [questions]);

  // isTopicInTemplate: given topicId + templateId → rule or null
  const getRule = (topicId: string, templateId: string): SimulationRule | undefined => {
    const tmpl = templates.find(t => t.id === templateId);
    return tmpl?.rules.find(r => r.topicId === topicId);
  };

  const handleCellPress = (topicId: string, templateId: string) => {
    const existingRule = getRule(topicId, templateId);
    if (existingRule) {
      // Remove
      const topic = topics.find(t => t.id === topicId);
      const tmpl = templates.find(t => t.id === templateId);
      Alert.alert(
        'הסרת נושא ממבחן',
        `להסיר את "${topic?.name}" מ"${tmpl?.name}"?`,
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'הסר',
            style: 'destructive',
            onPress: () => {
              removeTopicRuleFromTemplate(templateId, existingRule.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            },
          },
        ],
      );
    } else {
      // Add — open modal with defaults
      setPendingTopicId(topicId);
      setPendingTemplateId(templateId);
      setRuleCount('10');
      setRuleMinDiff('1');
      setRuleMaxDiff('10');
      setUseAdaptive(true);
      setShowRuleModal(true);
    }
  };

  const confirmAddRule = () => {
    const count = parseInt(ruleCount, 10);
    const min = parseInt(ruleMinDiff, 10);
    const max = parseInt(ruleMaxDiff, 10);
    if (isNaN(count) || count < 1 || count > 200) {
      Alert.alert('שגיאה', 'כמות שאלות: 1–200');
      return;
    }
    if (min > max) {
      Alert.alert('שגיאה', 'קושי מינימלי גדול ממקסימלי');
      return;
    }
    const rule: SimulationRule = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      topicId: pendingTopicId,
      count,
      minDifficulty: min,
      maxDifficulty: max,
      useAdaptive,
    };
    addTopicRuleToTemplate(pendingTemplateId, rule);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowRuleModal(false);
  };

  const pendingTopic = topics.find(t => t.id === pendingTopicId);
  const pendingTemplate = templates.find(t => t.id === pendingTemplateId);

  // Summary stats
  const totalMappings = templates.reduce((s, t) => s + t.rules.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🗺️ מפת נושאים–מבחנים</Text>
        <Text style={styles.headerSub}>
          {topics.length} נושאים · {templates.length} מבחנים · {totalMappings} שיוכים
        </Text>
      </LinearGradient>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>נושא משויך — לחץ להסרה</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border }]} />
          <Text style={styles.legendText}>לא משויך — לחץ להוספה</Text>
        </View>
      </View>

      {/* Matrix: rows=topics, cols=templates */}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Header row: exam names */}
          <View style={styles.matrixRow}>
            <View style={styles.topicLabelCell} />
            {templates.map(tmpl => (
              <View key={tmpl.id} style={styles.examHeaderCell}>
                <Text style={styles.examHeaderText} numberOfLines={2}>{tmpl.name}</Text>
                <Text style={styles.examHeaderSub}>{tmpl.rules.length} נושאות</Text>
              </View>
            ))}
          </View>

          {/* Data rows: one per topic */}
          {topics.map((topic, idx) => (
            <View key={topic.id} style={[styles.matrixRow, idx % 2 === 0 && styles.matrixRowAlt]}>
              {/* Topic label */}
              <View style={styles.topicLabelCell}>
                <Text style={styles.topicIcon}>{topic.icon}</Text>
                <View style={styles.topicLabelInfo}>
                  <Text style={styles.topicName} numberOfLines={1}>{topic.name}</Text>
                  <Text style={styles.topicCount}>{qPerTopic[topic.id] ?? 0} שאלות</Text>
                </View>
                {topic.isPremiumOnly && (
                  <Text style={styles.premiumBadge}>💎</Text>
                )}
              </View>

              {/* Cells: one per template */}
              {templates.map(tmpl => {
                const rule = getRule(topic.id, tmpl.id);
                return (
                  <Pressable
                    key={tmpl.id}
                    onPress={() => handleCellPress(topic.id, tmpl.id)}
                    style={({ pressed }) => [styles.matrixCell, pressed && { opacity: 0.7 }]}
                  >
                    {rule ? (
                      <LinearGradient colors={Colors.gradients.primary} style={styles.cellActive}>
                        <Text style={styles.cellCount}>{rule.count}</Text>
                        <Text style={styles.cellDiff}>{rule.minDifficulty}–{rule.maxDifficulty}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.cellEmpty}>
                        <Text style={styles.cellPlus}>+</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {topics.length === 0 && (
            <Text style={styles.empty}>אין נושאים. הוסף נושאים קודם.</Text>
          )}
        </ScrollView>
      </ScrollView>

      {/* Rule config modal */}
      <Modal visible={showRuleModal} transparent animationType="slide" onRequestClose={() => setShowRuleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
            <Text style={styles.modalTitle}>הוסף שיוך</Text>
            <Text style={styles.modalSubtitle}>
              {pendingTopic?.icon} {pendingTopic?.name}  →  {pendingTemplate?.name}
            </Text>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>כמות שאלות</Text>
                <TextInput
                  style={styles.input}
                  value={ruleCount}
                  onChangeText={setRuleCount}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>קושי מינ׳</Text>
                <TextInput
                  style={styles.input}
                  value={ruleMinDiff}
                  onChangeText={setRuleMinDiff}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>קושי מקס׳</Text>
                <TextInput
                  style={styles.input}
                  value={ruleMaxDiff}
                  onChangeText={setRuleMaxDiff}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
            </View>

            <Pressable
              onPress={() => setUseAdaptive(v => !v)}
              style={[styles.adaptiveToggle, useAdaptive && { backgroundColor: Colors.primaryLighter, borderColor: Colors.primary }]}
            >
              <Text style={[styles.adaptiveText, useAdaptive && { color: Colors.primary }]}>
                {useAdaptive ? '🧠 אלגוריתם אדפטיבי פעיל' : '🎲 בחירה אקראית'}
              </Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowRuleModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </Pressable>
              <Pressable onPress={confirmAddRule} style={styles.confirmBtn}>
                <LinearGradient colors={Colors.gradients.primary} style={styles.confirmBtnGrad}>
                  <Text style={styles.confirmBtnText}>הוסף שיוך ←</Text>
                </LinearGradient>
              </Pressable>
            </View>
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

  legend: {
    flexDirection: 'row-reverse', paddingHorizontal: 16, paddingVertical: 8, gap: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },

  // Matrix
  matrixRow: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 64 },
  matrixRowAlt: { backgroundColor: Colors.surfaceSecondary + '60' },

  topicLabelCell: {
    width: 160, paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    borderRightWidth: 1, borderRightColor: Colors.border,
    minHeight: 64,
  },
  topicIcon: { fontSize: 20 },
  topicLabelInfo: { flex: 1, alignItems: 'flex-end' },
  topicName: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text, textAlign: 'right' },
  topicCount: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
  premiumBadge: { fontSize: 12 },

  examHeaderCell: {
    width: 110, alignItems: 'center', paddingHorizontal: 6, paddingVertical: 8,
    borderRightWidth: 1, borderRightColor: Colors.border, borderBottomWidth: 2, borderBottomColor: Colors.primary,
    minHeight: 56, justifyContent: 'center',
  },
  examHeaderText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.text, textAlign: 'center' },
  examHeaderSub: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 2 },

  matrixCell: {
    width: 110, height: 64, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border, padding: 6,
  },
  cellActive: { width: 90, height: 50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cellCount: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  cellDiff: { fontFamily: FontFamily.regular, fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  cellEmpty: {
    width: 90, height: 50, borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
  },
  cellPlus: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.textTertiary },

  empty: {
    fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textTertiary,
    textAlign: 'center', padding: 40,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'], padding: 24, gap: 16,
  },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text, textAlign: 'right' },
  modalSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.primary, textAlign: 'right' },
  inputRow: { flexDirection: 'row-reverse', gap: 10 },
  inputGroup: { flex: 1, alignItems: 'center', gap: 6 },
  inputLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 10, fontFamily: FontFamily.bold,
    fontSize: FontSize.lg, color: Colors.text, width: '100%',
  },
  adaptiveToggle: {
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: 12, alignItems: 'center',
  },
  adaptiveText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  modalActions: { flexDirection: 'row-reverse', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceSecondary, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
  confirmBtn: { flex: 2, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  confirmBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
