import { create } from 'zustand';

export type FontSizeOption = 'small' | 'medium' | 'large';
export type AutoAdvanceOption = 0 | 2 | 3 | 5;

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
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  updateSetting: (key, value) => set({ [key]: value }),
  resetSettings: () => set(DEFAULT_SETTINGS),
}));
