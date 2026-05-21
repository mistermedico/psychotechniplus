import React, { useRef, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, Text, Animated, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { FontFamily } from '../../constants/theme';
import { Colors } from '../../constants/colors';

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
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </Animated.View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const TAB_HEIGHT = 64;
  const BAR_HEIGHT = TAB_HEIGHT + Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            {Platform.OS === 'ios' ? (
              <BlurView tint="dark" intensity={80} style={[StyleSheet.absoluteFill, styles.blurBase]} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidBackground]} />
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
          tabBarIcon: ({ focused }) => <TabIcon icon="⌂" label="בית" focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="targets"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="◎" label="מסלולים" focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="✦" label="תרגול" focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="◈" label="התקדמות" focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="◉" label="פרופיל" focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
    </Tabs>
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
    color: 'rgba(240,244,255,0.45)',
    fontFamily: FontFamily.regular,
  },
  tabIconFocused: {
    color: '#9E99FA',
    fontSize: 22,
  },
  tabLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: 'rgba(240,244,255,0.35)',
    letterSpacing: 0.2,
  },
  tabLabelFocused: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#9E99FA',
    letterSpacing: 0.3,
  },
});
