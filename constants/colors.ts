export const Colors = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryLighter: 'rgba(99,102,241,0.15)',
  primaryDark: '#4338CA',

  accent: '#A855F7',
  accentLight: 'rgba(168,85,247,0.15)',

  success: '#10B981',
  successLight: 'rgba(16,185,129,0.15)',

  danger: '#EF4444',
  dangerLight: 'rgba(239,68,68,0.15)',

  warning: '#F59E0B',
  warningLight: 'rgba(245,158,11,0.15)',

  gold: '#F59E0B',
  silver: '#94A3B8',

  // Dark glassmorphism backgrounds
  background: '#060912',
  backgroundDark: '#02040A',
  background2: '#0D1425',
  background3: '#1A0F2E',

  // Glass surfaces
  surface: 'rgba(255,255,255,0.07)',
  surfaceSecondary: 'rgba(255,255,255,0.04)',
  surfaceTertiary: 'rgba(255,255,255,0.02)',
  surfaceStrong: 'rgba(255,255,255,0.12)',
  surfaceCard: 'rgba(255,255,255,0.08)',

  // Glass borders
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.25)',
  borderFocus: 'rgba(99,102,241,0.6)',

  // Text (on dark)
  text: '#F1F5F9',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.35)',
  textInverse: '#0F172A',

  // Legacy light surface (used in admin)
  glass: 'rgba(255,255,255,0.85)',
  glassStrong: 'rgba(255,255,255,0.95)',

  // Target colors
  targets: {
    ktzina: '#3B82F6',
    tayyas: '#0EA5E9',
    psychometric: '#8B5CF6',
    hightech: '#10B981',
    modiin: '#F59E0B',
    shabas: '#EF4444',
  },

  // Gradient pairs [from, to]
  gradients: {
    primary: ['#6366F1', '#A855F7'] as [string, string],
    success: ['#10B981', '#059669'] as [string, string],
    danger: ['#EF4444', '#DC2626'] as [string, string],
    gold: ['#F59E0B', '#D97706'] as [string, string],
    bg: ['#060912', '#0D1425', '#1A0F2E'] as unknown as [string, string],
    ktzina: ['#3B82F6', '#1D4ED8'] as [string, string],
    tayyas: ['#0EA5E9', '#0284C7'] as [string, string],
    psychometric: ['#8B5CF6', '#6D28D9'] as [string, string],
    hightech: ['#10B981', '#047857'] as [string, string],
    modiin: ['#F59E0B', '#B45309'] as [string, string],
  },

  // Glass helpers
  glass10: 'rgba(255,255,255,0.10)',
  glass15: 'rgba(255,255,255,0.15)',
  glass20: 'rgba(255,255,255,0.20)',
  glass05: 'rgba(255,255,255,0.05)',
};

