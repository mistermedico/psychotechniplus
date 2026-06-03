import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, InboxMessage } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

// ── Types & constants ─────────────────────────────────────────────────────────

type MsgType    = 'info' | 'update' | 'achievement' | 'warning';
type TargetType = InboxMessage['targetType'];

const TYPE_META: { key: MsgType; label: string; icon: string; color: string }[] = [
  { key: 'info',        label: 'מידע',  icon: 'I',  color: '#3B82F6' },
  { key: 'update',      label: 'עדכון', icon: 'U',  color: '#8B5CF6' },
  { key: 'achievement', label: 'הישג',  icon: 'H',  color: '#F59E0B' },
  { key: 'warning',     label: 'אזהרה', icon: 'W',  color: '#EF4444' },
];

const TYPE_ICON_MAP: Record<MsgType, string> = {
  info: 'ℹ️', update: '🔄', achievement: '🏆', warning: '⚠️',
};

const TARGET_META: { key: TargetType; label: string }[] = [
  { key: 'all',      label: 'כל המשתמשים' },
  { key: 'free',     label: 'משתמשי חינם' },
  { key: 'premium',  label: 'פרמיום בלבד' },
  { key: 'specific', label: 'משתמש ספציפי' },
];

const PRIORITY_META: { key: string; label: string; color: string }[] = [
  { key: 'low',    label: 'נמוכה', color: '#64748B' },
  { key: 'normal', label: 'רגילה', color: '#3B82F6' },
  { key: 'high',   label: 'גבוהה', color: '#EF4444' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function targetLabel(msg: InboxMessage): string {
  if (msg.targetType === 'specific') return `UID: ${msg.targetUserIds[0] ?? '—'}`;
  return TARGET_META.find(t => t.key === msg.targetType)?.label ?? msg.targetType;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InboxAdminScreen() {
  const { inboxMessages, addInboxMessage, deleteInboxMessage } = useAdminStore();

  const [showCompose, setShowCompose]     = useState(false);
  const [title, setTitle]                 = useState('');
  const [body, setBody]                   = useState('');
  const [msgType, setMsgType]             = useState<MsgType>('info');
  const [targetType, setTargetType]       = useState<TargetType>('all');
  const [targetUserId, setTargetUserId]   = useState('');
  const [priority, setPriority]           = useState('normal');

  const resetForm = () => {
    setTitle('');
    setBody('');
    setMsgType('info');
    setTargetType('all');
    setTargetUserId('');
    setPriority('normal');
  };

  const handleSend = () => {
    if (!title.trim()) { Alert.alert('שגיאה', 'כותרת ההודעה לא יכולה להיות ריקה'); return; }
    if (!body.trim())  { Alert.alert('שגיאה', 'גוף ההודעה לא יכול להיות ריק'); return; }
    if (targetType === 'specific' && !targetUserId.trim()) {
      Alert.alert('שגיאה', 'נא להזין מזהה משתמש');
      return;
    }

    const targetLabel = TARGET_META.find(t => t.key === targetType)?.label ?? '';
    Alert.alert(
      'שליחת הודעה',
      'לשלוח הודעה ל' + targetLabel + '?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שלח',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            addInboxMessage({
              title: title.trim(),
              body: body.trim(),
              icon: TYPE_ICON_MAP[msgType],
              targetType,
              targetUserIds: targetType === 'specific' ? [targetUserId.trim()] : [],
            });
            resetForm();
            setShowCompose(false);
          },
        },
      ],
    );
  };

  const handleDelete = (msg: InboxMessage) => {
    Alert.alert(
      'מחיקת הודעה',
      'למחוק את "' + msg.title + '"?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deleteInboxMessage(msg.id);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>{'<'} חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>הודעות Inbox</Text>
        <Text style={styles.headerSub}>{inboxMessages.length} הודעות שנשלחו</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Compose toggle */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowCompose(v => !v);
          }}
          style={({ pressed }) => [styles.composeToggle, pressed && { opacity: 0.8 }]}
        >
          <LinearGradient colors={['#5A52D5', '#7C6FF7']} style={styles.composeToggleGrad}>
            <Text style={styles.composeToggleText}>{showCompose ? 'X סגור' : '+ הרכב הודעה חדשה'}</Text>
          </LinearGradient>
        </Pressable>

        {/* Compose form */}
        {showCompose && (
          <View style={styles.composeCard}>
            <Text style={styles.composeTitle}>הרכבת הודעה</Text>

            {/* Title input */}
            <Text style={styles.inputLabel}>כותרת</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="כותרת ההודעה..."
              placeholderTextColor="#475569"
              textAlign="right"
            />

            {/* Body input */}
            <Text style={styles.inputLabel}>תוכן</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={body}
              onChangeText={setBody}
              placeholder="תוכן ההודעה..."
              placeholderTextColor="#475569"
              textAlign="right"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Message type */}
            <Text style={styles.inputLabel}>סוג הודעה</Text>
            <View style={styles.chipRow}>
              {TYPE_META.map(t => (
                <Pressable
                  key={t.key}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMsgType(t.key); }}
                  style={[styles.chip, msgType === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                >
                  <Text style={[styles.chipText, msgType === t.key && styles.chipTextActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Target */}
            <Text style={styles.inputLabel}>יעד שליחה</Text>
            <View style={styles.chipRow}>
              {TARGET_META.map(t => (
                <Pressable
                  key={t.key}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTargetType(t.key); }}
                  style={[styles.chip, targetType === t.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, targetType === t.key && styles.chipTextActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {targetType === 'specific' && (
              <>
                <Text style={styles.inputLabel}>מזהה משתמש</Text>
                <TextInput
                  style={styles.input}
                  value={targetUserId}
                  onChangeText={setTargetUserId}
                  placeholder="user_123..."
                  placeholderTextColor="#475569"
                  textAlign="right"
                  autoCapitalize="none"
                />
              </>
            )}

            {/* Priority */}
            <Text style={styles.inputLabel}>עדיפות</Text>
            <View style={styles.chipRow}>
              {PRIORITY_META.map(p => (
                <Pressable
                  key={p.key}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPriority(p.key); }}
                  style={[styles.chip, priority === p.key && { backgroundColor: p.color, borderColor: p.color }]}
                >
                  <Text style={[styles.chipText, priority === p.key && styles.chipTextActive]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Send button */}
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}
            >
              <LinearGradient colors={Colors.gradients.primary} style={styles.sendBtnGrad}>
                <Text style={styles.sendBtnText}>שלח הודעה</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Messages list */}
        <Text style={styles.sectionTitle}>
          {'הודעות שנשלחו (' + inboxMessages.length + ')'}
        </Text>

        {inboxMessages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✉️</Text>
            <Text style={styles.emptyText}>אין הודעות עדיין</Text>
            <Text style={styles.emptySubText}>לחץ על "הרכב הודעה חדשה" למעלה</Text>
          </View>
        )}

        {inboxMessages.map(msg => (
          <MessageCard key={msg.id} msg={msg} onDelete={() => handleDelete(msg)} />
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── MessageCard ───────────────────────────────────────────────────────────────

function MessageCard({ msg, onDelete }: { msg: InboxMessage; onDelete: () => void }) {
  const typeColor = msg.icon === TYPE_ICON_MAP.warning ? '#EF4444'
    : msg.icon === TYPE_ICON_MAP.achievement ? '#F59E0B'
    : msg.icon === TYPE_ICON_MAP.update ? '#8B5CF6'
    : '#3B82F6';

  return (
    <View style={[msgStyles.card, { borderLeftColor: typeColor }]}>
      <View style={msgStyles.header}>
        <Pressable onPress={onDelete} style={msgStyles.deleteBtn}>
          <Text style={msgStyles.deleteBtnText}>מחק</Text>
        </Pressable>
        <View style={msgStyles.meta}>
          <Text style={[msgStyles.badge, { backgroundColor: typeColor + '20', color: typeColor }]}>
            {TARGET_META.find(t => t.key === msg.targetType)?.label ?? msg.targetType}
          </Text>
          <Text style={msgStyles.date}>{formatDate(msg.sentAt)}</Text>
        </View>
      </View>
      <Text style={msgStyles.title}>{msg.title}</Text>
      <Text style={msgStyles.body} numberOfLines={3}>{msg.body}</Text>
      {msg.targetType === 'specific' && msg.targetUserIds.length > 0 && (
        <Text style={msgStyles.targetUser}>{'UID: ' + msg.targetUserIds[0]}</Text>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 16, paddingBottom: 24 },
  back: { marginBottom: 12 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', textAlign: 'right', marginTop: 4 },
  content: { padding: 16, paddingBottom: 40 },

  composeToggle: { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: 16, ...Shadow.primary },
  composeToggleGrad: { paddingVertical: 14, alignItems: 'center' },
  composeToggleText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  composeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
    marginBottom: 20, ...Shadow.md,
  },
  composeTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.text,
    textAlign: 'right', marginBottom: 14,
  },
  inputLabel: {
    fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: 'right', marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.text,
    textAlign: 'right',
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  sendBtn: { marginTop: 16, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  sendBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  sendBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  sectionTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.text,
    textAlign: 'right', marginBottom: 10, marginTop: 4,
  },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textSecondary },
  emptySubText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 4 },
});

const msgStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 4,
    padding: 14, marginBottom: 10, ...Shadow.sm,
  },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  meta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  badge: {
    fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full,
  },
  date: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  deleteBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.danger + '60',
  },
  deleteBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.danger },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', marginBottom: 4 },
  body: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20 },
  targetUser: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 6 },
});
