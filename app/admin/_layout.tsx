import { Stack, router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/theme';
import { useAdminStore } from '../../store/adminStore';

export default function AdminLayout() {
  const { isAdmin } = useAdminStore();
  const pathname = usePathname();

  // Auth guard — redirect to PIN screen for any protected admin route
  useEffect(() => {
    if (!isAdmin && pathname !== '/admin') {
      router.replace('/admin');
    }
  }, [isAdmin, pathname]);

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
            <Text style={styles.backText}>→</Text>
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: '🛠️ ניהול מערכת', headerLeft: () => (
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.backBtn}>
          <Text style={styles.backText}>→ יציאה</Text>
        </Pressable>
      )}} />
      <Stack.Screen name="questions"           options={{ title: '📋 מאגר שאלות' }} />
      <Stack.Screen name="question-editor"     options={{ title: '✏️ עריכת שאלה' }} />
      <Stack.Screen name="validate"            options={{ title: '✅ תור ולידציה' }} />
      <Stack.Screen name="analytics"           options={{ title: '📊 אנליטיקס' }} />
      <Stack.Screen name="ai-generator"        options={{ title: '🤖 מחולל AI' }} />
      <Stack.Screen name="simulation-builder"  options={{ title: '🏗️ בניית סימולציה' }} />
      <Stack.Screen name="topics-admin"        options={{ title: '📚 ניהול נושאים' }} />
      <Stack.Screen name="display-settings"    options={{ title: '🎨 הגדרות תצוגה' }} />
      <Stack.Screen name="users"               options={{ title: '👥 ניהול משתמשים' }} />
      <Stack.Screen name="json-import"         options={{ title: '📥 ייבוא JSON' }} />
      <Stack.Screen name="export"              options={{ title: '📤 ייצוא שאלות' }} />
      <Stack.Screen name="app-settings"        options={{ title: '⚙️ הגדרות אפליקציה' }} />
      <Stack.Screen name="session-settings"    options={{ title: '🎛️ הגדרות סשן' }} />
      <Stack.Screen name="app-control"         options={{ title: '🎮 מרכז שליטה' }} />
      <Stack.Screen name="daily-challenge"     options={{ title: '🎯 אתגרים יומיים' }} />
      <Stack.Screen name="leaderboard-admin"   options={{ title: '🏅 לוח מובילים' }} />
      <Stack.Screen name="topic-exam-map"      options={{ title: '🗺️ מפת נושאים–מבחנים' }} />
      <Stack.Screen name="question-assignment" options={{ title: '🔗 שיוך שאלות' }} />
      <Stack.Screen name="revenue"             options={{ title: '📈 הכנסות ומנויים' }} />
      <Stack.Screen name="notifications"       options={{ title: '🔔 הודעות Push' }} />
      <Stack.Screen name="promo-codes"         options={{ title: '🎟️ קודי קופון' }} />
      <Stack.Screen name="activity-log"        options={{ title: '📋 יומן פעילות' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  backBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: '#fff' },
});
