import type { ViewStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 28,
  xxxl: 32,
} as const;

export const geometry = {
  screenMargin: 20,
  cardPadding: 20,
  listRowHeight: 64,
  iconTile: 40,
  sectionGap: 28,
  cardGap: 12,
  progressBarHeight: 8,
  buttonHeight: 52,
  smallButtonHeight: 40,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
} as const;

export const radius = {
  // v2 semantic radii
  card: 20,
  sheetTop: 28,
  button: 14,
  input: 14,
  iconTile: 12,
  chip: 999,
  keypadKey: 16,
  // Scale aliases
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const touch = {
  min: 48,
} as const;

export const motion = {
  fast: 150,
  normal: 200,
  slow: 250,
} as const;

export const typography = {
  hero: {
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.2,
    fontFamily: 'Inter_600SemiBold',
  },
  display: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    fontFamily: 'Inter_600SemiBold',
  },
  headline: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontFamily: 'Inter_600SemiBold',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_500Medium',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    fontFamily: 'Inter_500Medium',
  },
  tab: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Inter_500Medium',
  },
  /** @deprecated Compatibility alias for v1 screens until Phase 12 cleanup; use `headline`. */
  heading: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontFamily: 'Inter_600SemiBold',
  },
} as const;

export type TypographyVariant = keyof typeof typography;

export interface ColorPalette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  separator: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  warning: string;
  danger: string;
  onDanger: string;
  dangerSoft: string;
  scrim: string;

  /** @deprecated Legacy v1 token aliases removed once v1.1 screen rollout completes. */
  surfaceAlt: string;
  /** @deprecated Legacy v1 token alias; use `textSecondary`. */
  textMuted: string;
  /** @deprecated Legacy v1 token alias; use `accent`. */
  primary: string;
  /** @deprecated Legacy v1 token alias; use `accentSoft`. */
  primarySoft: string;
  /** @deprecated Legacy v1 token alias; use `onAccent`. */
  onPrimary: string;
  /** @deprecated Legacy v1 token alias; use `accent`. */
  income: string;
  /** @deprecated Legacy v1 token alias; use `danger`. */
  expense: string;
  /** @deprecated Legacy v1 token alias; use `separator`. */
  border: string;
}

export const lightColors: ColorPalette = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EEEEF1',
  separator: '#E6E6EA',
  cardBorder: 'rgba(11, 11, 13, 0.04)',
  text: '#0B0B0D',
  textSecondary: '#5C5F66',
  textTertiary: '#6B6F77',
  accent: '#097A52',
  onAccent: '#FFFFFF',
  accentSoft: '#E4F5EE',
  warning: '#B05008',
  danger: '#CE281D',
  onDanger: '#FFFFFF',
  dangerSoft: '#FDECEA',
  scrim: 'rgba(0, 0, 0, 0.35)',

  surfaceAlt: '#EEEEF1',
  textMuted: '#5C5F66',
  primary: '#097A52',
  primarySoft: '#E4F5EE',
  onPrimary: '#FFFFFF',
  income: '#097A52',
  expense: '#CE281D',
  border: '#E6E6EA',
};

export const darkColors: ColorPalette = {
  bg: '#0A0A0C',
  surface: '#151518',
  surfaceRaised: '#1D1D21',
  surfaceSunken: '#101013',
  separator: '#232327',
  cardBorder: '#232327',
  text: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textTertiary: '#86868F',
  accent: '#34D399',
  onAccent: '#04241A',
  accentSoft: '#10291F',
  warning: '#FBBF24',
  danger: '#F87171',
  onDanger: '#0A0A0C',
  dangerSoft: '#2A1414',
  scrim: 'rgba(0, 0, 0, 0.6)',

  surfaceAlt: '#1D1D21',
  textMuted: '#A1A1AA',
  primary: '#34D399',
  primarySoft: '#10291F',
  onPrimary: '#04241A',
  income: '#34D399',
  expense: '#F87171',
  border: '#232327',
};

export const lightCardShadow: ViewStyle = {
  shadowColor: '#0B0B0D',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 3,
  elevation: 1,
};

export const darkCardShadow: ViewStyle = {};

export interface AppTheme {
  scheme: 'light' | 'dark';
  colors: ColorPalette;
  spacing: typeof spacing;
  geometry: typeof geometry;
  radius: typeof radius;
  touch: typeof touch;
  motion: typeof motion;
  typography: typeof typography;
  cardShadow: ViewStyle;
}

export const lightTheme: AppTheme = {
  scheme: 'light',
  colors: lightColors,
  spacing,
  geometry,
  radius,
  touch,
  motion,
  typography,
  cardShadow: lightCardShadow,
};

export const darkTheme: AppTheme = {
  scheme: 'dark',
  colors: darkColors,
  spacing,
  geometry,
  radius,
  touch,
  motion,
  typography,
  cardShadow: darkCardShadow,
};
