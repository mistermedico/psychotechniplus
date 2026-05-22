import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { Colors } from '../constants/colors';

export default function Index() {
  const isLoaded = useUserStore(s => s.isLoaded);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const hasCompletedOnboarding = useUserStore(s => s.hasCompletedOnboarding);
  const maintenanceMode = useAdminStore(s => s.appConfig.maintenanceMode);
  const isAdmin = useAdminStore(s => s.isAdmin);

  if (!isLoaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#060912' }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) return <Redirect href="/landing" />;
  if (maintenanceMode && !isAdmin) return <Redirect href={'/maintenance' as any} />;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
