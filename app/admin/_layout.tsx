import { Stack, router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { FontFamily, FontSize } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { ADMIN_EMAIL, useAdminStore } from '../../store/adminStore';

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
  const { isAdmin, setIsAdmin, loadAdminData, logActivity } = useAdminStore();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const lastLoggedPath = useRef<string | null>(null);
  const [checkedAdminSession, setCheckedAdminSession] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const email = data.session?.user?.email?.toLowerCase() ?? '';
      const allowed = email === ADMIN_EMAIL;
      setIsAdmin(allowed);
      if (allowed) loadAdminData();
      setCheckedAdminSession(true);
    }).catch(() => {
      if (!alive) return;
      setIsAdmin(false);
      setCheckedAdminSession(true);
    });
    return () => { alive = false; };
  }, [setIsAdmin, loadAdminData]);

  useEffect(() => {
    if (!rootNavigationState?.key || !checkedAdminSession) return;
    if (!isAdmin && pathname !== '/admin') router.replace('/admin');
  }, [checkedAdminSession, isAdmin, pathname, rootNavigationState?.key]);

  useEffect(() => {
    if (!isAdmin) return;
    if (pathname === lastLoggedPath.current) return;
    lastLoggedPath.current = pathname;
    const pageName = PAGE_NAMES[pathname] ?? pathname.replace('/admin/', '');
    logActivity(`ביקור בעמוד: ${pageName}`, 'page');
  }, [isAdmin, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
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
  );
}

const styles = StyleSheet.create({
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
