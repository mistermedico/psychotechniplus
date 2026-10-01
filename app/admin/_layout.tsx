import { Stack, router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily, FontSize } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';

const PAGE_NAMES: Record<string, string> = {
  '/admin': 'כניסה למרכז הניהול',
  '/admin/questions': 'מאגר שאלות',
  '/admin/question-editor': 'עורך שאלה',
  '/admin/validate': 'תור ולידציה',
  '/admin/qa-agent': 'סוכן QA לשאלות',
  '/admin/analytics': 'אנליטיקס',
  '/admin/monitor': 'ניטור תרגולים ומבחנים',
  '/admin/ai-generator': 'מחולל שאלות',
  '/admin/simulation-builder': 'בניית סימולציה',
  '/admin/topics-admin': 'ניהול נושאים',
  '/admin/display-settings': 'הגדרות תצוגה',
  '/admin/users': 'ניהול משתמשים',
  '/admin/json-import': 'ייבוא JSON',
  '/admin/export': 'ייצוא שאלות',
  '/admin/app-settings': 'הגדרות אפליקציה',
  '/admin/session-settings': 'הגדרות סשן',
  '/admin/app-control': 'מרכז שליטה',
  '/admin/daily-challenge': 'אתגרים יומיים',
  '/admin/leaderboard-admin': 'לוח מובילים',
  '/admin/topic-exam-map': 'מפת נושאים-מבחנים',
  '/admin/question-assignment': 'שיוך שאלות',
  '/admin/revenue': 'הכנסות ומנויים',
  '/admin/app-store': 'מדדי App Store',
  '/admin/events': 'התקנות ורכישות',
  '/admin/notifications': 'הודעות Push',
  '/admin/promo-codes': 'קודי קופון',
  '/admin/support': 'פניות משתמשים',
  '/admin/activity-log': 'יומן פעילות',
  '/admin/logs': 'לוגים',
};

export default function AdminLayout() {
  const { isAdmin, setIsAdmin, loadAdminData, logActivity, startRealtimeSync, stopRealtimeSync } = useAdminStore();
  // Save/load failures are shown on every admin page (not only pages with AdminSyncToolbar).
  const syncError = useAdminStore(s => s.syncError);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const lastLoggedPath = useRef<string | null>(null);
  const [checkedAdminSession, setCheckedAdminSession] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!alive) return;
        if (!sessionData.session?.user?.id) {
          setIsAdmin(false);
          setCheckedAdminSession(true);
          return;
        }
        const { data, error } = await supabase.rpc('is_app_admin');
        if (!alive) return;
        const allowed = !error && data === true;
        setIsAdmin(allowed);
        if (allowed) {
          await loadAdminData(true);
          startRealtimeSync();
        }
        setCheckedAdminSession(true);
      } catch {
        if (!alive) return;
        setIsAdmin(false);
        setCheckedAdminSession(true);
      }
    })();
    return () => { alive = false; };
  }, [setIsAdmin, loadAdminData, startRealtimeSync]);

  useEffect(() => {
    if (isAdmin) startRealtimeSync();
    return () => {
      stopRealtimeSync();
    };
  }, [isAdmin, startRealtimeSync, stopRealtimeSync]);

  useEffect(() => {
    if (!rootNavigationState?.key || !checkedAdminSession) return;
    if (!isAdmin) router.replace('/(tabs)');
  }, [checkedAdminSession, isAdmin, pathname, rootNavigationState?.key]);

  useEffect(() => {
    if (!isAdmin) return;
    if (pathname === lastLoggedPath.current) return;
    lastLoggedPath.current = pathname;
    const pageName = PAGE_NAMES[pathname] ?? pathname.replace('/admin/', '');
    logActivity(`ביקור בעמוד: ${pageName}`, 'page');
  }, [isAdmin, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!checkedAdminSession || !isAdmin) return null;

  return (
    <View style={styles.root}>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
        headerTitleAlign: 'center',
        headerBackVisible: false,
        headerLeft: () => (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'ניהול מערכת',
          headerLeft: () => (
            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.backBtn}>
              <Text style={styles.backText}>← יציאה</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="questions" options={{ title: 'מאגר שאלות' }} />
      <Stack.Screen name="question-editor" options={{ title: 'עריכת שאלה' }} />
      <Stack.Screen name="validate" options={{ title: 'תור ולידציה' }} />
      <Stack.Screen name="qa-agent" options={{ title: 'סוכן QA לשאלות' }} />
      <Stack.Screen name="analytics" options={{ title: 'אנליטיקס' }} />
      <Stack.Screen name="monitor" options={{ title: 'ניטור תרגולים ומבחנים' }} />
      <Stack.Screen name="ai-generator" options={{ title: 'מחולל שאלות' }} />
      <Stack.Screen name="simulation-builder" options={{ title: 'בניית סימולציה' }} />
      <Stack.Screen name="topics-admin" options={{ title: 'ניהול נושאים' }} />
      <Stack.Screen name="display-settings" options={{ title: 'הגדרות תצוגה' }} />
      <Stack.Screen name="users" options={{ title: 'ניהול משתמשים' }} />
      <Stack.Screen name="json-import" options={{ title: 'ייבוא JSON' }} />
      <Stack.Screen name="export" options={{ title: 'ייצוא שאלות' }} />
      <Stack.Screen name="app-settings" options={{ title: 'הגדרות אפליקציה' }} />
      <Stack.Screen name="session-settings" options={{ title: 'הגדרות סשן' }} />
      <Stack.Screen name="app-control" options={{ title: 'מרכז שליטה' }} />
      <Stack.Screen name="daily-challenge" options={{ title: 'אתגרים יומיים' }} />
      <Stack.Screen name="leaderboard-admin" options={{ title: 'לוח מובילים' }} />
      <Stack.Screen name="topic-exam-map" options={{ title: 'מפת נושאים-מבחנים' }} />
      <Stack.Screen name="question-assignment" options={{ title: 'שיוך שאלות' }} />
      <Stack.Screen name="revenue" options={{ title: 'הכנסות ומנויים' }} />
      <Stack.Screen name="app-store" options={{ title: 'מדדי App Store' }} />
      <Stack.Screen name="events" options={{ title: 'התקנות ורכישות' }} />
      <Stack.Screen name="notifications" options={{ title: 'הודעות Push' }} />
      <Stack.Screen name="promo-codes" options={{ title: 'קודי קופון' }} />
      <Stack.Screen name="support" options={{ title: 'פניות משתמשים' }} />
      <Stack.Screen name="activity-log" options={{ title: 'יומן פעילות' }} />
      <Stack.Screen name="logs" options={{ title: 'לוגים' }} />
    </Stack>
    {!!syncError && (
      <Pressable
        onPress={() => useAdminStore.setState({ syncError: null })}
        style={[styles.errorBanner, { paddingBottom: 8 + insets.bottom }]}
      >
        <Text style={styles.errorText} numberOfLines={4}>⚠️ {syncError}</Text>
        <Text style={styles.errorDismiss}>סגור ✕</Text>
      </Pressable>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  errorBanner: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#fff',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorDismiss: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#FECACA',
  },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: '#fff',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
