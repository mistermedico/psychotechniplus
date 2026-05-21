export const Colors = {
  // Core brand
  primary: '#7C6FF7',
  primaryLight: '#9E99FA',
  primaryLighter: 'rgba(124,111,247,0.18)',
  primaryDark: '#5A52D5',
  primaryGlow: 'rgba(124,111,247,0.45)',

  accent: '#C084FC',
  accentLight: 'rgba(192,132,252,0.18)',
  accentGlow: 'rgba(192,132,252,0.40)',

  cyan: '#22D3EE',
  cyanLight: 'rgba(34,211,238,0.18)',
  cyanGlow: 'rgba(34,211,238,0.40)',

  success: '#34D399',
  successLight: 'rgba(52,211,153,0.15)',
  successGlow: 'rgba(52,211,153,0.35)',

  danger: '#F87171',
  dangerLight: 'rgba(248,113,113,0.15)',
  dangerGlow: 'rgba(248,113,113,0.35)',

  warning: '#FBBF24',
  warningLight: 'rgba(251,191,36,0.15)',
  warningGlow: 'rgba(251,191,36,0.35)',

  gold: '#FBBF24',
  silver: '#94A3B8',

  // Backgrounds — deep space dark
  background: '#080A12',
  backgroundDark: '#04060D',
  background2: '#0D1020',
  background3: '#14102A',

  // Surfaces
  surface: 'rgba(255,255,255,0.06)',
  surfaceSecondary: 'rgba(255,255,255,0.03)',
  surfaceTertiary: 'rgba(255,255,255,0.02)',
  surfaceStrong: 'rgba(255,255,255,0.10)',
  surfaceCard: 'rgba(255,255,255,0.07)',
  surfaceElevated: 'rgba(255,255,255,0.09)',

  // Borders
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.20)',
  borderFocus: 'rgba(124,111,247,0.70)',
  borderGlow: 'rgba(124,111,247,0.40)',

  // Text
  text: '#F0F4FF',
  textSecondary: 'rgba(240,244,255,0.60)',
  textTertiary: 'rgba(240,244,255,0.32)',
  textInverse: '#0F172A',

  glass: 'rgba(255,255,255,0.85)',
  glassStrong: 'rgba(255,255,255,0.95)',

  // Target colors
  targets: {
    ktzina: '#3B82F6',
    tayyas: '#0EA5E9',
    psychometric: '#7C6FF7',
    hightech: '#34D399',
    modiin: '#FBBF24',
    shabas: '#F87171',
  },

  // Gradient pairs
  gradients: {
    primary: ['#7C6FF7', '#C084FC'] as [string, string],
    primaryDeep: ['#5A52D5', '#7C6FF7'] as [string, string],
    success: ['#34D399', '#10B981'] as [string, string],
    danger: ['#F87171', '#EF4444'] as [string, string],
    gold: ['#FBBF24', '#F59E0B'] as [string, string],
    cyan: ['#22D3EE', '#0EA5E9'] as [string, string],
    bg: ['#080A12', '#0D1020', '#14102A'] as unknown as [string, string],
    hero: ['#1A1740', '#0E0B2A'] as [string, string],
    ktzina: ['#3B82F6', '#1D4ED8'] as [string, string],
    tayyas: ['#0EA5E9', '#0284C7'] as [string, string],
    psychometric: ['#7C6FF7', '#5A52D5'] as [string, string],
    hightech: ['#34D399', '#10B981'] as [string, string],
    modiin: ['#FBBF24', '#F59E0B'] as [string, string],
  },

  // Opacity helpers
  glass05: 'rgba(255,255,255,0.05)',
  glass08: 'rgba(255,255,255,0.08)',
  glass10: 'rgba(255,255,255,0.10)',
  glass15: 'rgba(255,255,255,0.15)',
  glass20: 'rgba(255,255,255,0.20)',
};
