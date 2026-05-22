import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontFamily, FontSize } from '../constants/theme';

export default function MaintenanceScreen() {
  return (
    <LinearGradient colors={['#080A12', '#0D1020', '#14102A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 64, marginBottom: 24 }}>🔧</Text>
        <Text style={{ fontFamily: FontFamily.heading, fontSize: 28, color: '#fff', textAlign: 'center', marginBottom: 12 }}>
          האפליקציה בתחזוקה
        </Text>
        <Text style={{ fontFamily: FontFamily.regular, fontSize: 16, color: '#94A3B8', textAlign: 'center', lineHeight: 26 }}>
          אנחנו עובדים על שיפורים.{'\n'}נחזור בקרוב! 🚀
        </Text>
        <View style={{ marginTop: 32, backgroundColor: 'rgba(124,111,247,0.15)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(124,111,247,0.3)' }}>
          <Text style={{ fontFamily: FontFamily.medium, fontSize: 14, color: '#7C6FF7', textAlign: 'center' }}>
            PsychoTechniPlus · בתחזוקה
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
