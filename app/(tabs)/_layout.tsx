import React, { useRef, useEffect } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { Platform, StyleSheet, View, Text, Animated, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { FontFamily } from '../../constants/theme';
import { useColors } from '../../hooks/useColors';
import { useSettingsStore } from '../../store/settingsStore';
import { useAdminStore } from '../../store/adminStore';
import { useUserStore } from '../../store/userStore';
import { logUserAction } from '../../utils/visitTracker';

interface TabIconProps {
  icon: string;
  label: string;
  focused: boolean;
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.45)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.12 : 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View
      style={[
        styles.tabItem,
        focused && styles.tabItemFocused,
        { transform: [{ scale }], opacity },
      ]}
    >
      {focused && (
        <View style={styles.activeGlow} />
      )}
      <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused, !focused && { color: 'rgba(128,128,160,0.7)' }]}>{label}</Text>
    </Animated.View>
  );
}

function AnnouncementBanner() {
  const announcementEnabled = useAdminStore(s => s.appConfig.announcementEnabled);
  const announcementText = useAdminStore(s => s.appConfig.announcementText);
  const announcementLevel = useAdminStore(s => s.appConfig.announcementLevel);

  if (!announcementEnabled || !announcementText) return null;

  const bgColor = announcementLevel === 'critical'
    ? 'rgba(239,68,68,0.20)'
    : announcementLevel === 'warning'
      ? 'rgba(245,158,11,0.20)'
      : 'rgba(124,111,247,0.20)';
  const borderColor = announcementLevel === 'critical'
    ? 'rgba(239,68,68,0.5)'
    : announcementLevel === 'warning'
      ? 'rgba(245,158,11,0.5)'
      : 'rgba(124,111,247,0.5)';
  const textColor = announcementLevel === 'critical'
    ? '#EF4444'
    : announcementLevel === 'warning'
      ? '#F59E0B'
      : '#9E99FA';
  const icon = announcementLevel === 'critical' ? '🚨 ' : announcementLevel === 'warning' ? '⚠️ ' : 'ℹ️ ';

  return (
    <View style={{
      backgroundColor: bgColor,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    }}>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: FontFamily.medium,
          fontSize: 13,
          color: textColor,
          textAlign: 'right',
        }}
      >
        {icon}{announcementText}
      </Text>
    </View>
  );
}

const TAB_SCREEN_NAMES: Record<string, string> = {
  '/(tabs)': 'דף הבית',
  '/(tabs)/index': 'דף הבית',
  '/(tabs)/practice': 'תרגול',
  '/(tabs)/progress': 'התקדמות',
  '/(tabs)/profile': 'פרופיל',
  '/(tabs)/targets': 'מסלולים',
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const TAB_HEIGHT = 64;
  const BAR_HEIGHT = TAB_HEIGHT + Math.max(insets.bottom, 12);
  const theme = useSettingsStore(s => s.theme);
  const colors = useColors();
  const pathname = usePathname();
  const lastTrackedTab = useRef<string | null>(null);

  const visitUserId = useUserStore(s => s.userId);
  const visitName = useUserStore(s => s.name);
  const visitEmail = useUserStore(s => s.email);
  const visitIsAuth = useUserStore(s => s.isAuthenticated);
  const visitIsPremium = useUserStore(s => s.isPremium);

  useEffect(() => {
    if (!TAB_SCREEN_NAMES[pathname]) return;
    if (pathname === lastTrackedTab.current) return;
    lastTrackedTab.current = pathname;
    logUserAction({
      screen: TAB_SCREEN_NAMES[pathname],
      action: 'ביקור',
      userId: visitIsAuth && visitUserId ? visitUserId : null,
      userName: visitIsAuth && visitName ? visitName : 'אורח',
      userEmail: visitIsAuth ? visitEmail : '',
      isGuest: !visitIsAuth,
      meta: visitIsAuth ? (visitIsPremium ? 'פרמיום' : 'חינמי') : undefined,
    });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1 }}>
      <AnnouncementBanner />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            {Platform.OS === 'ios' ? (
              <BlurView tint={theme === 'light' ? 'light' : 'dark'} intensity={80} style={[StyleSheet.absoluteFill, styles.blurBase]} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme === 'light' ? 'rgba(244,246,251,0.97)' : 'rgba(8,10,18,0.97)' }]} />
            )}
            <View style={styles.topBorder} />
          </View>
        ),
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          height: BAR_HEIGHT,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 8,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.45,
          shadowRadius: 24,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="בית" focused={focused} />,
          tabBarAccessibilityLabel: 'בית',
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="targets"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🎯" label="מסלולים" focused={focused} />,
          tabBarAccessibilityLabel: 'מסלולים',
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="✏️" label="תרגול" focused={focused} />,
          tabBarAccessibilityLabel: 'תרגול',
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="📊" label="התקדמות" focused={focused} />,
          tabBarAccessibilityLabel: 'התקדמות',
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="פרופיל" focused={focused} />,
          tabBarAccessibilityLabel: 'פרופיל',
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  blurBase: {},
  androidBackground: {
    backgroundColor: 'rgba(8,10,18,0.97)',
  },
  topBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(124,111,247,0.20)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 2,
    minWidth: 52,
    position: 'relative',
  },
  tabItemFocused: {
    backgroundColor: 'rgba(124,111,247,0.15)',
  },
  activeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: 'rgba(124,111,247,0.08)',
    shadowColor: '#7C6FF7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 0,
  },
  tabIcon: {
    fontSize: 20,
    fontFamily: FontFamily.regular,
  },
  tabIconFocused: {
    color: '#9E99FA',
    fontSize: 22,
  },
  tabLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  tabLabelFocused: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#9E99FA',
    letterSpacing: 0.3,
  },
});
