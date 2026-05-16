import { Stack, router } from 'expo-router';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/theme';

export default function AdminLayout() {
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
      <Stack.Screen name="questions" options={{ title: '📋 מאגר שאלות' }} />
      <Stack.Screen name="question-editor" options={{ title: '✏️ עריכת שאלה' }} />
      <Stack.Screen name="validate" options={{ title: '✅ תור ולידציה' }} />
      <Stack.Screen name="analytics" options={{ title: '📊 אנליטיקס' }} />
      <Stack.Screen name="ai-generator" options={{ title: '🤖 מחולל AI' }} />
      <Stack.Screen name="simulation-builder" options={{ title: '🏗️ בניית סימולציה' }} />
      <Stack.Screen name="topics-admin" options={{ title: '📚 ניהול נושאים' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  backBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: '#fff' },
});
