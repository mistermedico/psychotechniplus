import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { FontFamily } from '../../constants/theme';

interface TabIconProps {
  icon: string;
  label: string;
  focused: boolean;
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemFocused]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

function TabBarBackground() {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        tint="dark"
        intensity={60}
        style={[StyleSheet.absoluteFill, styles.blurBase]}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, styles.androidBackground]} />;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.1)',
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom || 8,
          paddingTop: 8,
          backgroundColor: Platform.OS === 'android' ? 'rgba(10,14,28,0.97)' : 'transparent',
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" label="בית" focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="targets"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🎯" label="מסלולים" focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="✏️" label="תרגול" focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📈" label="התקדמות" focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" label="פרופיל" focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blurBase: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  androidBackground: {
    backgroundColor: 'rgba(10,14,28,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 2,
  },
  tabItemFocused: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconFocused: {
    fontSize: 22,
    opacity: 1,
  },
  tabLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  tabLabelFocused: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#818CF8',
  },
});
