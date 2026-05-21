import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../store/userStore';
import { Colors } from '../constants/colors';

export default function Index() {
  const isLoaded = useUserStore(s => s.isLoaded);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const hasCompletedOnboarding = useUserStore(s => s.hasCompletedOnboarding);

  if (!isLoaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#060912' }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) return <Redirect href={'/landing' as any} />;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
