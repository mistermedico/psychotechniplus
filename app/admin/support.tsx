import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import {
  SupportTicket,
  SupportTicketStatus,
  addSupportTicketMessage,
  loadSupportTickets,
  updateSupportTicket,
} from '../../lib/supportTickets';
import { useAdminStore } from '../../store/adminStore';

type Filter = 'all' | SupportTicketStatus;

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: SupportTicketStatus) {
  if (status === 'answered') return 'נענתה';
  if (status === 'closed') return 'סגורה';
  return 'פתוחה';
}

export default function AdminSupportTickets() {
  const insets = useSafeAreaInsets();
  const logActivity = useAdminStore(s => s.logActivity);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => tickets.filter(ticket => filter === 'all' || ticket.status === filter),
    [filter, tickets],
  );
  const selected = filtered.find(ticket => ticket.id === selectedId) ?? filtered[0] ?? null;
  const openCount = tickets.filter(ticket => ticket.status === 'open').length;
  const answeredCount = tickets.filter(ticket => ticket.status === 'answered').length;

  const refresh = async () => {
    setLoading(true);
    const next = await loadSupportTickets();
    setTickets(next);
    setSelectedId(current => current && next.some(ticket => ticket.id === current) ? current : next[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  const submitReply = async () => {
    if (!selected) return;
    if (!reply.trim()) {
      Alert.alert('חסר תוכן', 'כתוב תשובה לפני שליחה.');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await addSupportTicketMessage(selected.id, 'admin', reply);
      logActivity(`נשלחה תשובה לפנייה: ${selected.subject}`, 'notification');
      setReply('');
      await refresh();
      Alert.alert('נשלח', 'התשובה נשמרה ותופיע אצל המשתמש בתיבת הפניות.');
    } catch (error: any) {
      Alert.alert('שגיאה', error?.message ?? 'לא ניתן לשמור תשובה כרגע.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: SupportTicketStatus) => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateSupportTicket(selected.id, { status });
      logActivity(`סטטוס פנייה עודכן: ${selected.subject} -> ${statusLabel(status)}`, 'notification');
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.hero}>
            <Text style={styles.heroTitle}>פניות משתמשים</Text>
            <Text style={styles.heroSub}>כל הפניות והתשובות מסונכרנות מול תיבת הפניות של המשתמשים והאורחים.</Text>
            <View style={styles.statsRow}>
              <Stat label="פתוחות" value={openCount} color={Colors.warning} />
              <Stat label="נענו" value={answeredCount} color={Colors.success} />
              <Stat label="סה״כ" value={tickets.length} color={Colors.primaryLight} />
            </View>
          </LinearGradient>

          <View style={styles.toolbar}>
            <Pressable onPress={refresh} style={styles.refreshBtn}>
              <Text style={styles.refreshText}>רענן</Text>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {(['all', 'open', 'answered', 'closed'] as Filter[]).map(item => (
                <Pressable
                  key={item}
                  onPress={() => setFilter(item)}
                  style={[styles.filterChip, filter === item && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                    {item === 'all' ? 'הכל' : statusLabel(item)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primaryLight} style={{ marginTop: 32 }} />
          ) : tickets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>אין פניות עדיין</Text>
              <Text style={styles.emptyText}>ברגע שמשתמש או אורח ישלח פנייה, היא תופיע כאן.</Text>
            </View>
          ) : (
            <View style={styles.layout}>
              <View style={styles.list}>
                {filtered.map(ticket => (
                  <Pressable
                    key={ticket.id}
                    onPress={() => setSelectedId(ticket.id)}
                    style={[styles.ticketRow, selected?.id === ticket.id && styles.ticketRowActive]}
                  >
                    <View style={styles.ticketRowTop}>
                      <Text style={styles.ticketDate}>{formatDate(ticket.updatedAt)}</Text>
                      <Text style={styles.ticketSubject} numberOfLines={1}>{ticket.subject}</Text>
                    </View>
                    <Text style={styles.ticketMeta} numberOfLines={1}>
                      {ticket.isGuest ? 'אורח' : ticket.userName} · {statusLabel(ticket.status)} · {ticket.priority === 'urgent' ? 'דחוף' : 'רגיל'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {selected && (
                <View style={styles.detail}>
                  <View style={styles.detailHeader}>
                    <View style={styles.statusActions}>
                      {(['open', 'answered', 'closed'] as SupportTicketStatus[]).map(status => (
                        <Pressable
                          key={status}
                          disabled={saving}
                          onPress={() => changeStatus(status)}
                          style={[styles.statusBtn, selected.status === status && styles.statusBtnActive]}
                        >
                          <Text style={[styles.statusBtnText, selected.status === status && styles.statusBtnTextActive]}>
                            {statusLabel(status)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.detailTitle}>{selected.subject}</Text>
                    <Text style={styles.detailMeta}>
                      {selected.userName} {selected.userEmail ? `· ${selected.userEmail}` : ''} · {selected.isGuest ? 'אורח' : 'משתמש'}
                    </Text>
                  </View>

                  <View style={styles.thread}>
                    {selected.messages.map(message => (
                      <View key={message.id} style={[styles.bubble, message.author === 'admin' ? styles.adminBubble : styles.userBubble]}>
                        <Text style={styles.bubbleAuthor}>{message.author === 'admin' ? 'מנהל' : selected.userName}</Text>
                        <Text style={styles.bubbleText}>{message.text}</Text>
                        <Text style={styles.bubbleTime}>{formatDate(message.createdAt)}</Text>
                      </View>
                    ))}
                  </View>

                  <TextInput
                    value={reply}
                    onChangeText={setReply}
                    placeholder="כתוב תשובה למשתמש..."
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.replyInput}
                    multiline
                    textAlign="right"
                    textAlignVertical="top"
                  />
                  <Pressable
                    onPress={submitReply}
                    disabled={saving}
                    style={({ pressed }) => [styles.sendBtn, (pressed || saving) && { opacity: 0.75 }]}
                  >
                    <LinearGradient colors={Colors.gradients.primary} style={styles.sendGrad}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>שלח תשובה</Text>}
                    </LinearGradient>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18 },
  hero: { borderRadius: Radius.xl, padding: 18, marginBottom: 14, ...Shadow.primary },
  heroTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  heroSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', textAlign: 'right', lineHeight: 20, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.lg, padding: 12, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
  statLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.72)' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  refreshBtn: { backgroundColor: Colors.primaryLighter, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 9 },
  refreshText: { fontFamily: FontFamily.bold, color: Colors.primaryLight, fontSize: FontSize.xs },
  filters: { flexDirection: 'row-reverse', gap: 8 },
  filterChip: { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { backgroundColor: Colors.primary + '22', borderColor: Colors.primary },
  filterText: { fontFamily: FontFamily.medium, color: Colors.textSecondary, fontSize: FontSize.xs },
  filterTextActive: { color: Colors.primaryLight },
  emptyCard: { borderRadius: Radius.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, padding: 24, alignItems: 'center' },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 6 },
  layout: { gap: 12 },
  list: { gap: 8 },
  ticketRow: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  ticketRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  ticketRowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  ticketSubject: { flex: 1, fontFamily: FontFamily.bold, color: Colors.text, fontSize: FontSize.sm, textAlign: 'right' },
  ticketDate: { fontFamily: FontFamily.regular, color: Colors.textTertiary, fontSize: FontSize.xs },
  ticketMeta: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right', marginTop: 4 },
  detail: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  detailHeader: { alignItems: 'flex-end', marginBottom: 12 },
  detailTitle: { fontFamily: FontFamily.bold, color: Colors.text, fontSize: FontSize.lg, textAlign: 'right' },
  detailMeta: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right', marginTop: 3 },
  statusActions: { flexDirection: 'row-reverse', gap: 6, marginBottom: 10 },
  statusBtn: { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  statusBtnActive: { backgroundColor: Colors.success + '22', borderColor: Colors.success },
  statusBtnText: { fontFamily: FontFamily.medium, color: Colors.textSecondary, fontSize: FontSize.xs },
  statusBtnTextActive: { color: Colors.success },
  thread: { gap: 8, marginBottom: 12 },
  bubble: { borderRadius: Radius.lg, padding: 10, maxWidth: '94%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary + '24' },
  adminBubble: { alignSelf: 'flex-start', backgroundColor: Colors.success + '22' },
  bubbleAuthor: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right' },
  bubbleText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20, marginTop: 2 },
  bubbleTime: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 4 },
  replyInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 110,
    padding: 12,
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginBottom: 10,
  },
  sendBtn: { borderRadius: Radius.lg, overflow: 'hidden' },
  sendGrad: { paddingVertical: 13, alignItems: 'center' },
  sendText: { fontFamily: FontFamily.bold, color: '#fff', fontSize: FontSize.base },
});
