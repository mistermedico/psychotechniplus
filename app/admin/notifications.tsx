import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, PushNotification } from '../../store/adminStore';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const SEGMENT_LABELS: Record<PushNotification['targetSegment'], string> = {
  all: 'כל המשתמשים',
  free: 'חינמי',
  premium: 'פרמיום',
  inactive_7d: 'לא פעיל 7י׳',
  inactive_30d: 'לא פעיל 30י׳',
};

const STATUS_COLORS: Record<PushNotification['status'], string> = {
  sent: Colors.success,
  scheduled: Colors.primary,
  draft: Colors.textTertiary,
  failed: Colors.danger,
};

const STATUS_LABELS: Record<PushNotification['status'], string> = {
  sent: 'נשלח',
  scheduled: 'מתוזמן',
  draft: 'טיוטה',
  failed: 'נכשל',
};

const TABS = [
  { key: 'all', label: 'הכל' },
  { key: 'sent', label: 'נשלחו' },
  { key: 'scheduled', label: 'מתוזמנות' },
  { key: 'draft', label: 'טיוטות' },
] as const;

type TabKey = 'all' | 'sent' | 'scheduled' | 'draft';

const SEGMENTS: PushNotification['targetSegment'][] = ['all', 'free', 'premium', 'inactive_7d', 'inactive_30d'];

export default function NotificationsScreen() {
  const { pushNotifications, addPushNotification, deletePushNotification, sendPushNotification } = useAdminStore();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [composeVisible, setComposeVisible] = useState(false);

  // Real user counts per segment, fetched once from Supabase
  const [reachCounts, setReachCounts] = useState<Record<PushNotification['targetSegment'], number>>({
    all: 0, free: 0, premium: 0, inactive_7d: 0, inactive_30d: 0,
  });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('is_premium, last_practiced_date');

        if (!data) return;
        const cutoff7 = new Date();
        cutoff7.setDate(cutoff7.getDate() - 7);
        const cutoff30 = new Date();
        cutoff30.setDate(cutoff30.getDate() - 30);
        const c7 = cutoff7.toISOString().split('T')[0];
        const c30 = cutoff30.toISOString().split('T')[0];

        const all = data.length;
        const premium = data.filter(u => u.is_premium).length;
        const free = all - premium;
        const inactive_7d = data.filter(u => !u.last_practiced_date || u.last_practiced_date < c7).length;
        const inactive_30d = data.filter(u => !u.last_practiced_date || u.last_practiced_date < c30).length;
        setReachCounts({ all, free, premium, inactive_7d, inactive_30d });
      } catch {}
    };
    fetchCounts();
  }, []);

  // Compose form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<PushNotification['targetSegment']>('all');
  const [scheduleToggle, setScheduleToggle] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const filtered = pushNotifications.filter(n => activeTab === 'all' || n.status === activeTab);
  const sentNotifs = pushNotifications.filter(n => n.status === 'sent');
  const avgOpenRate = sentNotifs.length > 0
    ? (sentNotifs.reduce((sum, n) => sum + (n.openRate ?? 0), 0) / sentNotifs.length)
    : 0;

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('שגיאה', 'מלא כותרת ותוכן');
      return;
    }
    const estimatedReachMap = reachCounts;
    if (scheduleToggle && scheduledAt) {
      addPushNotification({
        title: title.trim(),
        body: body.trim(),
        targetSegment: segment,
        status: 'scheduled',
        scheduledAt,
        estimatedReach: estimatedReachMap[segment],
      });
    } else {
      const notif = addPushNotification({
        title: title.trim(),
        body: body.trim(),
        targetSegment: segment,
        status: 'draft',
        scheduledAt: null,
        estimatedReach: estimatedReachMap[segment],
      });
      sendPushNotification(notif.id);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setComposeVisible(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setSegment('all');
    setScheduleToggle(false);
    setScheduledAt('');
  };

  const handleDelete = (notif: PushNotification) => {
    Alert.alert('מחיקת הודעה', `האם למחוק את ״${notif.title}״?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        deletePushNotification(notif.id);
      }},
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🔔 הודעות Push</Text>
        <Text style={styles.headerSub}>ניהול ושליחת התראות למשתמשים</Text>
      </LinearGradient>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatChip label="נשלחו" value={sentNotifs.length} color={Colors.success} />
        <StatChip label="ממוצע פתיחה" value={`${(avgOpenRate * 100).toFixed(0)}%`} color={Colors.primary} />
        <StatChip label="מתוזמנות" value={pushNotifications.filter(n => n.status === 'scheduled').length} color={Colors.warning} />
        <StatChip label="טיוטות" value={pushNotifications.filter(n => n.status === 'draft').length} color={Colors.textTertiary} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <Text style={styles.emptyText}>אין הודעות בקטגוריה זו</Text>
        )}
        {filtered.map(notif => (
          <View key={notif.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Pressable onPress={() => handleDelete(notif)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </Pressable>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>{notif.title}</Text>
                <Text style={styles.cardBody} numberOfLines={2}>{notif.body}</Text>
              </View>
            </View>
            <View style={styles.cardMeta}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[notif.status] + '25', borderColor: STATUS_COLORS[notif.status] }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[notif.status] }]}>
                  {STATUS_LABELS[notif.status]}
                </Text>
              </View>
              <View style={styles.segmentChip}>
                <Text style={styles.segmentText}>{SEGMENT_LABELS[notif.targetSegment]}</Text>
              </View>
            </View>
            {notif.status === 'sent' && notif.sentAt && (
              <Text style={styles.cardSubInfo}>
                נשלח ל-{notif.estimatedReach.toLocaleString()} · {((notif.openRate ?? 0) * 100).toFixed(1)}% פתיחות
              </Text>
            )}
            {notif.status === 'scheduled' && notif.scheduledAt && (
              <Text style={styles.cardSubInfo}>מתוזמן ל-{formatDate(notif.scheduledAt)}</Text>
            )}
            {notif.status === 'draft' && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  sendPushNotification(notif.id);
                }}
                style={styles.sendNowBtn}
              >
                <Text style={styles.sendNowText}>שלח עכשיו</Text>
              </Pressable>
            )}
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setComposeVisible(true); }}
        style={styles.fab}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.fabGrad}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </Pressable>

      {/* Compose Modal */}
      <Modal visible={composeVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>הודעה חדשה</Text>

              <Text style={styles.fieldLabel}>כותרת</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="כותרת ההודעה"
                placeholderTextColor="#475569"
                textAlign="right"
              />

              <Text style={styles.fieldLabel}>תוכן</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={body}
                onChangeText={setBody}
                placeholder="תוכן ההודעה..."
                placeholderTextColor="#475569"
                textAlign="right"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>קהל יעד</Text>
              <View style={styles.segmentPicker}>
                {SEGMENTS.map(s => (
                  <Pressable
                    key={s}
                    onPress={() => setSegment(s)}
                    style={[styles.segmentOption, segment === s && styles.segmentOptionActive]}
                  >
                    <Text style={[styles.segmentOptionText, segment === s && styles.segmentOptionTextActive]}>
                      {SEGMENT_LABELS[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.scheduleRow}>
                <Text style={styles.fieldLabel}>תזמן</Text>
                <Pressable onPress={() => setScheduleToggle(v => !v)} style={styles.toggle}>
                  <View style={[styles.toggleTrack, scheduleToggle && styles.toggleTrackOn]}>
                    <View style={[styles.toggleThumb, scheduleToggle && styles.toggleThumbOn]} />
                  </View>
                </Pressable>
              </View>

              {scheduleToggle && (
                <>
                  <Text style={styles.fieldLabel}>תאריך ושעה (YYYY-MM-DD HH:mm)</Text>
                  <TextInput
                    style={styles.input}
                    value={scheduledAt}
                    onChangeText={setScheduledAt}
                    placeholder="2025-06-15 08:00"
                    placeholderTextColor="#475569"
                    textAlign="right"
                  />
                </>
              )}

              {/* Preview */}
              {(title || body) && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>תצוגה מקדימה (iOS)</Text>
                  <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>{title || 'כותרת'}</Text>
                    <Text style={styles.previewBody}>{body || 'תוכן ההודעה'}</Text>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable onPress={() => { setComposeVisible(false); resetForm(); }} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>ביטול</Text>
                </Pressable>
                <Pressable onPress={handleSend} style={styles.sendBtn}>
                  <LinearGradient colors={Colors.gradients.primary} style={styles.sendBtnGrad}>
                    <Text style={styles.sendBtnText}>{scheduleToggle ? 'תזמן' : 'שלח עכשיו'}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatChip({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={[statStyles.chip, { borderColor: color + '40' }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: Radius.md,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    ...Shadow.sm,
  },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: '#64748B', marginTop: 2 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },

  header: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'flex-end',
  },
  backBtn: { marginBottom: 6 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.lg, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', marginTop: 2 },

  statsRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },

  tabsRow: { paddingHorizontal: 12, paddingBottom: 10, gap: 8, flexDirection: 'row-reverse' },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155',
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  tabTextActive: { color: '#fff' },

  list: { paddingHorizontal: 12, paddingTop: 4, gap: 10 },
  emptyText: {
    textAlign: 'center', color: '#64748B',
    fontFamily: FontFamily.regular, fontSize: FontSize.base,
    marginTop: 40,
  },

  card: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    ...Shadow.md,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row-reverse', gap: 10, alignItems: 'flex-start' },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff', textAlign: 'right' },
  cardBody: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', marginTop: 2, textAlign: 'right' },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 18 },

  cardMeta: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  segmentChip: {
    backgroundColor: '#0F172A',
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#334155',
  },
  segmentText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8' },
  cardSubInfo: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#64748B', textAlign: 'right' },

  sendNowBtn: {
    backgroundColor: Colors.primary + '20',
    borderRadius: Radius.md,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '50',
  },
  sendNowText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },

  fab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    ...Shadow.primary,
  },
  fabGrad: {
    width: 56, height: 56,
    borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: '#fff',
    textAlign: 'right',
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: Radius.md,
    padding: 12,
    color: '#fff',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },

  segmentPicker: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  segmentOption: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#0F172A',
    borderWidth: 1, borderColor: '#334155',
  },
  segmentOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentOptionText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8' },
  segmentOptionTextActive: { color: '#fff' },

  scheduleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  toggle: { padding: 4 },
  toggleTrack: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    padding: 2,
  },
  toggleTrackOn: { backgroundColor: Colors.primary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },

  previewBox: { marginTop: 16 },
  previewLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#64748B', textAlign: 'right', marginBottom: 6 },
  previewCard: {
    backgroundColor: '#0F172A',
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff', textAlign: 'right' },
  previewBody: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', marginTop: 4, textAlign: 'right' },

  modalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: '#94A3B8' },
  sendBtn: { flex: 2, borderRadius: Radius.xl, overflow: 'hidden' },
  sendBtnGrad: { padding: 16, alignItems: 'center' },
  sendBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
