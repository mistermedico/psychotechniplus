import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

export const impactAsync = (style: Haptics.ImpactFeedbackStyle): void => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};

export const notificationAsync = (type: Haptics.NotificationFeedbackType): void => {
  if (Platform.OS !== 'web') Haptics.notificationAsync(type);
};

export const selectionAsync = (): void => {
  if (Platform.OS !== 'web') Haptics.selectionAsync();
};
