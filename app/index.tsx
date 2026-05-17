import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useUserStore } from '../store/userStore';
import { Colors } from '../constants/colors';

export default function Index() {
  const hasCompletedOnboarding = useUserStore(s => s.hasCompletedOnboarding);
  const isLoaded = useUserStore(s => s.isLoaded);

  // Wait for Supabase to load user data before deciding where to route
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <Redirect href={hasCompletedOnboarding ? '/(tabs)' : '/onboarding'} />;
}
