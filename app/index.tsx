import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useUserStore } from '../store/userStore';
import { Colors } from '../constants/colors';

export default function Index() {
  const isLoaded = useUserStore(s => s.isLoaded);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const hasCompletedOnboarding = useUserStore(s => s.hasCompletedOnboarding);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/auth" />;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
