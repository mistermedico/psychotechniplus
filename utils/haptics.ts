import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/settingsStore';

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
const enabled = () => useSettingsStore.getState().hapticsEnabled;

export const impactAsync = (style: Haptics.ImpactFeedbackStyle): void => {
  if (!isNative || !enabled()) return;
  try { Haptics.impactAsync(style); } catch {}
};

export const notificationAsync = (type: Haptics.NotificationFeedbackType): void => {
  if (!isNative || !enabled()) return;
  try { Haptics.notificationAsync(type); } catch {}
};

export const selectionAsync = (): void => {
  if (!isNative || !enabled()) return;
  try { Haptics.selectionAsync(); } catch {}
};
