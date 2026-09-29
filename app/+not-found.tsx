import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

export default function NotFoundScreen() {
  return (
    <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.card}>
          <Text style={styles.code}>404</Text>
          <Text style={styles.title}>העמוד לא נמצא</Text>
          <Text style={styles.body}>
            הכתובת שביקשת אינה קיימת או שהעמוד הועבר. אפשר לחזור לאפליקציה ולהמשיך משם.
          </Text>
          <Pressable onPress={() => router.replace('/(tabs)')} style={styles.primary}>
            <Text style={styles.primaryText}>חזרה לאפליקציה</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/auth')} style={styles.secondary}>
            <Text style={styles.secondaryText}>התחברות / הרשמה</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
  },
  code: { fontFamily: FontFamily.heading, fontSize: 52, color: Colors.primaryLight },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize['2xl'], color: Colors.text, marginTop: 8, textAlign: 'center' },
  body: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 24, textAlign: 'center', marginTop: 10, marginBottom: 22 },
  primary: { width: '100%', backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 13, alignItems: 'center' },
  primaryText: { fontFamily: FontFamily.bold, color: '#fff', fontSize: FontSize.base },
  secondary: { width: '100%', paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  secondaryText: { fontFamily: FontFamily.medium, color: Colors.primaryLight, fontSize: FontSize.sm },
});
