export const Colors = {
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryLighter: '#EEF2FF',
  primaryDark: '#3730A3',

  accent: '#9333EA',
  accentLight: '#E9D5FF',

  success: '#10B981',
  successLight: '#D1FAE5',

  danger: '#EF4444',
  dangerLight: '#FEE2E2',

  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  gold: '#F59E0B',
  silver: '#94A3B8',

  // Background
  background: '#F8FAFC',
  backgroundDark: '#020617',

  // Surfaces
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  surfaceTertiary: '#E2E8F0',

  // Text
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E2E8F0',
  borderFocus: '#4F46E5',

  // Glass
  glass: 'rgba(255,255,255,0.85)',
  glassStrong: 'rgba(255,255,255,0.95)',

  // Target colors
  targets: {
    ktzina: '#3B82F6',     // כחול — קצונה
    tayyas: '#0EA5E9',     // שמים — טייס
    psychometric: '#8B5CF6', // סגול — פסיכומטרי
    hightech: '#10B981',   // ירוק — הייטק
    modiin: '#F59E0B',     // כתום — מודיעין
    shabas: '#EF4444',     // אדום — שב"ס
  },

  // Gradient pairs [from, to]
  gradients: {
    primary: ['#4F46E5', '#7C3AED'] as [string, string],
    success: ['#10B981', '#059669'] as [string, string],
    danger: ['#EF4444', '#DC2626'] as [string, string],
    gold: ['#F59E0B', '#D97706'] as [string, string],
    ktzina: ['#3B82F6', '#1D4ED8'] as [string, string],
    tayyas: ['#0EA5E9', '#0284C7'] as [string, string],
    psychometric: ['#8B5CF6', '#6D28D9'] as [string, string],
    hightech: ['#10B981', '#047857'] as [string, string],
    modiin: ['#F59E0B', '#B45309'] as [string, string],
  },
};
