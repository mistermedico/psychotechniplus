import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { logger, LogEntry, LogLevel } from '../../utils/logger';
import { FontFamily, FontSize, Radius } from '../../constants/theme';

const LEVEL_COLOR: Record<LogLevel, string> = {
  error:   '#EF4444',
  warn:    '#F59E0B',
  info:    '#60A5FA',
  success: '#10B981',
  debug:   '#94A3B8',
};

const LEVEL_BG: Record<LogLevel, string> = {
  error:   'rgba(239,68,68,0.12)',
  warn:    'rgba(245,158,11,0.12)',
  info:    'rgba(96,165,250,0.10)',
  success: 'rgba(16,185,129,0.12)',
  debug:   'rgba(148,163,184,0.08)',
};

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'success', 'debug'];

export default function LogsScreen() {
  const [entries, setEntries] = useState<LogEntry[]>(() => logger.getEntries());
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    return logger.subscribe(() => setEntries(logger.getEntries()));
  }, []);

  const handleCopyEntry = useCallback(async (e: LogEntry) => {
    await logger.copyEntry(e);
    setCopied(e.id);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const handleCopyAll = useCallback(async () => {
    await logger.copyAll();
    Alert.alert('הועתק', `${entries.length} רשומות הועתקו ללוח`);
  }, [entries.length]);

  const handleCopyJson = useCallback(async () => {
    await logger.copyAllAsJson();
    Alert.alert('הועתק', 'לוגים הועתקו כ-JSON');
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert('נקה לוגים', 'האם למחוק את כל הלוגים?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'נקה', style: 'destructive', onPress: () => logger.clear() },
    ]);
  }, []);

  const visible = entries.filter(e => {
    if (filter !== 'all' && e.level !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return e.ctx.toLowerCase().includes(q) || e.msg.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <Pressable onPress={handleCopyAll} style={styles.toolBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.toolBtnText}>📋 העתק הכל</Text>
            </Pressable>
            <Pressable onPress={handleCopyJson} style={styles.toolBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.toolBtnText}>{ '{ }' } JSON</Text>
            </Pressable>
          </View>
          <Pressable onPress={handleClear} style={[styles.toolBtn, styles.toolBtnDanger]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.toolBtnText, { color: '#EF4444' }]}>🗑️ נקה</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש בלוגים..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
            textAlign="right"
          />
          <Text style={styles.countBadge}>{visible.length}/{entries.length}</Text>
        </View>

        {/* Level filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {(['all', ...LEVELS] as const).map(lvl => (
            <Pressable
              key={lvl}
              onPress={() => setFilter(lvl)}
              style={[styles.filterChip, filter === lvl && { backgroundColor: lvl === 'all' ? 'rgba(99,102,241,0.3)' : LEVEL_BG[lvl as LogLevel], borderColor: lvl === 'all' ? '#6366F1' : LEVEL_COLOR[lvl as LogLevel] }]}
            >
              <Text style={[styles.filterChipText, filter === lvl && { color: lvl === 'all' ? '#818CF8' : LEVEL_COLOR[lvl as LogLevel] }]}>
                {lvl === 'all' ? 'הכל' : lvl}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Entries */}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {visible.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>{entries.length === 0 ? 'אין לוגים עדיין' : 'אין תוצאות לפילטר הנוכחי'}</Text>
            </View>
          )}

          {visible.map(entry => (
            <View key={entry.id} style={[styles.entry, { backgroundColor: LEVEL_BG[entry.level], borderLeftColor: LEVEL_COLOR[entry.level] }]}>
              {/* Header row */}
              <View style={styles.entryHeader}>
                <Pressable
                  onPress={() => handleCopyEntry(entry)}
                  style={[styles.copyBtn, copied === entry.id && styles.copyBtnDone]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.copyBtnText}>{copied === entry.id ? '✓' : '📋'}</Text>
                </Pressable>
                <View style={styles.entryMeta}>
                  <Text style={[styles.entryLevel, { color: LEVEL_COLOR[entry.level] }]}>
                    {entry.level.toUpperCase()}
                  </Text>
                  <Text style={styles.entryCtx}>{entry.ctx}</Text>
                </View>
                <Text style={styles.entryTs}>
                  {new Date(entry.ts).toLocaleTimeString('he-IL', { hour12: false })}
                </Text>
              </View>

              {/* Message */}
              <Text style={styles.entryMsg}>{entry.msg}</Text>

              {/* Data */}
              {entry.data && (
                <View style={styles.entryData}>
                  <Text style={styles.entryDataText}>{entry.data}</Text>
                </View>
              )}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  toolbar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  toolbarLeft: { flexDirection: 'row-reverse', gap: 8 },
  toolBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 44,
    justifyContent: 'center',
  },
  toolBtnDanger: { borderColor: 'rgba(239,68,68,0.3)' },
  toolBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)' },

  searchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 44,
  },
  countBadge: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)' },

  filterRow: { flexGrow: 0, marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, flexDirection: 'row-reverse', gap: 8, paddingVertical: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    minHeight: 32,
    justifyContent: 'center',
  },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },

  list: { flex: 1 },
  listContent: { padding: 12, gap: 8 },

  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: 'rgba(255,255,255,0.35)' },

  entry: {
    borderRadius: Radius.lg,
    borderLeftWidth: 3,
    padding: 12,
    gap: 6,
  },
  entryHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  entryMeta: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  entryLevel: { fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 0.5 },
  entryCtx: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', flex: 1, textAlign: 'right' },
  entryTs: { fontFamily: FontFamily.regular, fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  entryMsg: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', textAlign: 'right', lineHeight: 20 },
  entryData: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: Radius.md,
    padding: 8,
    marginTop: 2,
  },
  entryDataText: { fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'left' },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBtnDone: { backgroundColor: 'rgba(16,185,129,0.2)' },
  copyBtnText: { fontSize: 14 },
});
