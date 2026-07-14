import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { useUserStore } from '../store/userStore';
import {
  SupportTicket,
  createSupportTicket,
  getSupportUserId,
  loadSupportTickets,
  updateSupportTicket,
} from '../lib/supportTickets';

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: SupportTicket['status']) {
  if (status === 'answered') return 'נענתה';
  if (status === 'closed') return 'נסגרה';
  return 'פתוחה';
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { userId, name, email, isGuest } = useUserStore();
  const [supportUserId, setSupportUserId] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState(email);
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const myTickets = useMemo(
    () => tickets.filter(ticket => ticket.userId === supportUserId),
    [tickets, supportUserId],
  );

  const refresh = useCallback(async () => {
    const identity = await getSupportUserId(userId, isGuest);
    setSupportUserId(identity);
    const all = await loadSupportTickets();
    setTickets(all);
    await Promise.all(
      all
        .filter(ticket => ticket.userId === identity && ticket.status === 'answered')
        .map(ticket => updateSupportTicket(ticket.id, { lastReadByUserAt: new Date().toISOString() })),
    );
    setLoading(false);
  }, [isGuest, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const submitTicket = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      Alert.alert('חסר תוכן', 'כתוב הודעה למנהל לפני שליחה.');
      return;
    }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const identity = supportUserId || await getSupportUserId(userId, isGuest);
      await createSupportTicket({
        userId: identity,
        userName: name || (isGuest ? 'אורח' : 'משתמש'),
        userEmail: contactEmail || email || undefined,
        isGuest,
        subject: subject.trim() || 'פנייה למנהל',
        message: trimmedMessage,
        priority,
      });
      setSubject('');
      setMessage('');
      setPriority('normal');
      await refresh();
      Alert.alert('נשלח', 'הפנייה נשלחה למנהל ותופיע כאן כשהוא יענה.');
    } catch (error: any) {
      Alert.alert('שגיאה', error?.message ?? 'לא ניתן לשלוח את הפנייה כרגע.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#060912', '#0D1425', '#111827']} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={styles.backText}>חזרה</Text>
              </Pressable>
              <View style={styles.headerText}>
                <Text style={styles.title}>תיבת פניות למנהל</Text>
                <Text style={styles.subtitle}>שלח הודעה, עקוב אחרי סטטוס וקבל תשובה ישירות באפליקציה.</Text>
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>פנייה חדשה</Text>
              {isGuest && (
                <Text style={styles.guestNote}>
                  אתה מחובר כאורח. מומלץ להשאיר מייל כדי שנוכל לזהות אותך גם ממכשיר אחר.
                </Text>
              )}
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="נושא הפנייה"
                placeholderTextColor={Colors.textTertiary}
                style={styles.input}
                textAlign="right"
              />
              <TextInput
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="מייל לחזרה (אופציונלי)"
                placeholderTextColor={Colors.textTertiary}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign="right"
              />
              <View style={styles.priorityRow}>
                {(['normal', 'urgent'] as const).map(item => (
                  <Pressable
                    key={item}
                    onPress={() => setPriority(item)}
                    style={[styles.priorityChip, priority === item && styles.priorityChipActive]}
                  >
                    <Text style={[styles.priorityText, priority === item && styles.priorityTextActive]}>
                      {item === 'urgent' ? 'דחוף' : 'רגיל'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="כתוב כאן את הפנייה..."
                placeholderTextColor={Colors.textTertiary}
                style={[styles.input, styles.messageInput]}
                multiline
                textAlign="right"
                textAlignVertical="top"
              />
              <Pressable
                onPress={submitTicket}
                disabled={submitting}
                style={({ pressed }) => [styles.submitBtn, (pressed || submitting) && { opacity: 0.75 }]}
              >
                <LinearGradient colors={Colors.gradients.primary} style={styles.submitGrad}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>שלח פנייה</Text>}
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>הפניות שלי</Text>
              <Pressable onPress={refresh} style={styles.refreshBtn}>
                <Text style={styles.refreshText}>רענן</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color={Colors.primaryLight} style={{ marginTop: 24 }} />
            ) : myTickets.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>אין פניות עדיין</Text>
                <Text style={styles.emptyText}>כשיישלחו פניות למנהל הן יופיעו כאן עם התשובות.</Text>
              </View>
            ) : (
              myTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const lastAdminMessage = [...ticket.messages].reverse().find(message => message.author === 'admin');
  return (
    <View style={styles.ticketCard}>
      <View style={styles.ticketTop}>
        <View style={[styles.statusPill, ticket.status === 'answered' && styles.statusAnswered, ticket.status === 'closed' && styles.statusClosed]}>
          <Text style={styles.statusText}>{statusLabel(ticket.status)}</Text>
        </View>
        <View style={styles.ticketTitleWrap}>
          <Text style={styles.ticketSubject}>{ticket.subject}</Text>
          <Text style={styles.ticketMeta}>{formatDate(ticket.updatedAt)} · {ticket.priority === 'urgent' ? 'דחוף' : 'רגיל'}</Text>
        </View>
      </View>

      <View style={styles.thread}>
        {ticket.messages.map(message => (
          <View key={message.id} style={[styles.bubble, message.author === 'admin' ? styles.adminBubble : styles.userBubble]}>
            <Text style={styles.bubbleAuthor}>{message.author === 'admin' ? 'המנהל' : 'אני'}</Text>
            <Text style={styles.bubbleText}>{message.text}</Text>
            <Text style={styles.bubbleTime}>{formatDate(message.createdAt)}</Text>
          </View>
        ))}
      </View>

      {lastAdminMessage && ticket.status === 'answered' && (
        <Text style={styles.answerHint}>יש תשובה חדשה מהמנהל.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  headerText: { flex: 1, alignItems: 'flex-end', marginLeft: 12 },
  title: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: Colors.text, textAlign: 'right' },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginTop: 4, lineHeight: 20 },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 18,
    ...Shadow.sm,
  },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right', marginBottom: 10 },
  guestNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.warning, textAlign: 'right', lineHeight: 18, marginBottom: 10 },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginBottom: 10,
  },
  messageInput: { minHeight: 120 },
  priorityRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  priorityChip: { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 8 },
  priorityChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  priorityText: { fontFamily: FontFamily.medium, color: Colors.textSecondary, fontSize: FontSize.sm },
  priorityTextActive: { color: Colors.primaryLight },
  submitBtn: { borderRadius: Radius.lg, overflow: 'hidden' },
  submitGrad: { paddingVertical: 14, alignItems: 'center' },
  submitText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text, textAlign: 'right' },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg, backgroundColor: Colors.primaryLighter },
  refreshText: { fontFamily: FontFamily.bold, color: Colors.primaryLight, fontSize: FontSize.xs },
  emptyCard: { borderRadius: Radius.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, padding: 18, alignItems: 'center' },
  emptyTitle: { fontFamily: FontFamily.bold, color: Colors.text, fontSize: FontSize.base },
  emptyText: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', marginTop: 4 },
  ticketCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 12 },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  ticketTitleWrap: { flex: 1, alignItems: 'flex-end', marginLeft: 8 },
  ticketSubject: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  ticketMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  statusPill: { backgroundColor: Colors.warning + '22', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  statusAnswered: { backgroundColor: Colors.success + '22' },
  statusClosed: { backgroundColor: Colors.textTertiary + '22' },
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.text },
  thread: { gap: 8 },
  bubble: { borderRadius: Radius.lg, padding: 10, maxWidth: '94%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary + '24' },
  adminBubble: { alignSelf: 'flex-start', backgroundColor: Colors.success + '22' },
  bubbleAuthor: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right' },
  bubbleText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20, marginTop: 2 },
  bubbleTime: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 4, textAlign: 'left' },
  answerHint: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.success, textAlign: 'right', marginTop: 10 },
});
