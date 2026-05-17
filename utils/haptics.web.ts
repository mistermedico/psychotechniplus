// Web stub — Metro automatically uses this file instead of haptics.ts on web builds
export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
  Rigid = 'rigid',
  Soft = 'soft',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export const impactAsync = (_style: ImpactFeedbackStyle): void => {};
export const notificationAsync = (_type: NotificationFeedbackType): void => {};
export const selectionAsync = (): void => {};
