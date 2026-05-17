import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export const impactAsync = (style: Haptics.ImpactFeedbackStyle): void => {
  if (!isNative) return;
  try { Haptics.impactAsync(style); } catch {}
};

export const notificationAsync = (type: Haptics.NotificationFeedbackType): void => {
  if (!isNative) return;
  try { Haptics.notificationAsync(type); } catch {}
};

export const selectionAsync = (): void => {
  if (!isNative) return;
  try { Haptics.selectionAsync(); } catch {}
};
