import { useSettingsStore } from '../store/settingsStore';
import { getColors, ThemeColors } from '../constants/colors';

export function useColors(): ThemeColors {
  const theme = useSettingsStore(s => s.theme);
  return getColors(theme);
}
