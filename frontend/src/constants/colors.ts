// TallyDekho Color System
// All green Figma accents → #1A1A1A (brandPrimary)
// Light green active states → #E8E7E1 (activeBg)
// Positive % indicators KEEP green → #2D7D46

export const COLORS = {
  // Backgrounds
  pageBg: '#F5F4EF',
  cardBg: '#FFFFFF',
  hoverBg: '#F0EFE9',
  activeBg: '#E8E7E1',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#787774',
  textTertiary: '#AEACA8',

  // Borders
  borderDefault: '#E9E8E3',
  borderStrong: '#D4D3CE',

  // Brand / Buttons (replaces Figma green for CTAs)
  brandPrimary: '#1A1A1A',
  brandHover: '#333333',

  // Semantic
  positive: '#2D7D46',
  positiveBg: '#F0FBF4',
  negative: '#C0392B',
  negativeBg: '#FDECEA',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  info: '#2563EB',
  infoBg: '#EFF6FF',

  // Bottom Nav / Sidebar
  navBg: '#1A1A1A',
  activeNavBg: '#333333',
  navText: '#F5F4EF',
  inactiveNavText: '#9A9A97',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.4)',
};

export const TYPOGRAPHY = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 36,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};
