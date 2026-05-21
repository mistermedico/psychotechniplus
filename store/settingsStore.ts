import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSizeOption = 'small' | 'medium' | 'large';
export type AutoAdvanceOption = 0 | 2 | 3 | 5;
export type ThemeOption = 'dark' | 'light';
export type DifficultyOption = 'auto' | 'easy' | 'medium' | 'hard';

export interface DisplaySettings {
  showDifficultyBadge: boolean;
  showEloOnQuestion: boolean;
  shuffleOptions: boolean;
  collapseReadingPassage: boolean;
  highlightCorrectAfterWrong: boolean;
  showTimerInPractice: boolean;
  autoAdvanceDelay: AutoAdvanceOption;
  questionFontSize: FontSizeOption;
  showExplanationAuto: boolean;
  hapticsEnabled: boolean;
  theme: ThemeOption;
  defaultDifficulty: DifficultyOption;
}

interface SettingsState extends DisplaySettings {
  updateSetting: <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  showDifficultyBadge: true,
  showEloOnQuestion: false,
  shuffleOptions: false,
  collapseReadingPassage: false,
  highlightCorrectAfterWrong: true,
  showTimerInPractice: false,
  autoAdvanceDelay: 0,
  questionFontSize: 'medium',
  showExplanationAuto: true,
  hapticsEnabled: true,
  theme: 'dark',
  defaultDifficulty: 'auto',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSetting: (key, value) => set({ [key]: value }),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'psychotechniplus-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
