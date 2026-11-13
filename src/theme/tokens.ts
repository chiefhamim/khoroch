import type { ViewStyle } from 'react-native';
import type { AccentTheme } from '@/domain/types';

export type ResolvedColorMode = 'light' | 'dark' | 'black';

export const TAKA_FONT_FAMILY = 'HindSiliguri_600SemiBold';

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
  cardPadding: 18,
  listRowHeight: 62,
  iconTile: 36,
  sectionGap: 24,
  cardGap: 12,
  progressBarHeight: 5,
  buttonHeight: 50,
  smallButtonHeight: 40,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
} as const;

export const radius = {
  card: 18,
  heroCard: 22,
  sheetTop: 28,
  button: 14,
  input: 14,
  iconTile: 11,
  monogram: 9,
  chip: 999,
  keypadKey: 12,
  // Scale aliases
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
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
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.4,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  display: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  headline: {
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  overline: {
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.6,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  tab: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
} as const;

export type TypographyVariant = keyof typeof typography;

export interface AccentModeSpec {
  accent: string;
  onAccent: string;
  accentSoft: string;
  hero: string;
  heroText: string;
  heroTextSecondary: string;
  heroLine: string;
  heroBar: string;
}

export interface AccentDefinition {
  id: AccentTheme;
  label: string;
  swatchColor: string;
  light: AccentModeSpec;
  dark: AccentModeSpec;
}

export const ACCENT_DEFINITIONS: Record<AccentTheme, AccentDefinition> = {
  forest: {
    id: 'forest',
    label: 'Forest',
    swatchColor: '#123227',
    light: {
      accent: '#0B6B4B',
      onAccent: '#FFFFFF',
      accentSoft: '#E5F3EC',
      hero: '#123227',
      heroText: '#F3F6F4',
      heroTextSecondary: '#C2CDC7',
      heroLine: 'rgba(243, 246, 244, 0.14)',
      heroBar: '#5FD3A3',
    },
    dark: {
      accent: '#4CCB97',
      onAccent: '#04231A',
      accentSoft: '#10291F',
      hero: '#13241D',
      heroText: '#F3F6F4',
      heroTextSecondary: '#B8C7C0',
      heroLine: 'rgba(243, 246, 244, 0.12)',
      heroBar: '#4CCB97',
    },
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    swatchColor: '#1B2F5C',
    light: {
      accent: '#1B4D99',
      onAccent: '#FFFFFF',
      accentSoft: '#EAF1FC',
      hero: '#1B2F5C',
      heroText: '#F3F6F4',
      heroTextSecondary: '#C2CDC7',
      heroLine: 'rgba(243, 246, 244, 0.14)',
      heroBar: '#7FB2F0',
    },
    dark: {
      accent: '#7FB2F0',
      onAccent: '#0B1B33',
      accentSoft: '#132036',
      hero: '#15203B',
      heroText: '#F3F6F4',
      heroTextSecondary: '#B9C5D9',
      heroLine: 'rgba(243, 246, 244, 0.12)',
      heroBar: '#7FB2F0',
    },
  },
  plum: {
    id: 'plum',
    label: 'Plum',
    swatchColor: '#43245E',
    light: {
      accent: '#5B2C82',
      onAccent: '#FFFFFF',
      accentSoft: '#F3ECF9',
      hero: '#43245E',
      heroText: '#F3F6F4',
      heroTextSecondary: '#C2CDC7',
      heroLine: 'rgba(243, 246, 244, 0.14)',
      heroBar: '#D4B0FA',
    },
    dark: {
      accent: '#C59DF5',
      onAccent: '#1F0F30',
      accentSoft: '#231732',
      hero: '#251734',
      heroText: '#F3F6F4',
      heroTextSecondary: '#C6BAD6',
      heroLine: 'rgba(243, 246, 244, 0.12)',
      heroBar: '#C59DF5',
    },
  },
  saffron: {
    id: 'saffron',
    label: 'Saffron',
    swatchColor: '#7A2E12',
    light: {
      accent: '#9A3B12',
      onAccent: '#FFFFFF',
      accentSoft: '#F9EDE6',
      hero: '#7A2E12',
      heroText: '#F3F6F4',
      heroTextSecondary: '#D1C7C2',
      heroLine: 'rgba(243, 246, 244, 0.16)',
      heroBar: '#F5B864',
    },
    dark: {
      accent: '#F0A35E',
      onAccent: '#2A1205',
      accentSoft: '#2D1B12',
      hero: '#2E1810',
      heroText: '#F3F6F4',
      heroTextSecondary: '#D2BEB3',
      heroLine: 'rgba(243, 246, 244, 0.14)',
      heroBar: '#F0A35E',
    },
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite',
    swatchColor: '#26262A',
    light: {
      accent: '#26262A',
      onAccent: '#FFFFFF',
      accentSoft: '#EAEAE6',
      hero: '#26262A',
      heroText: '#F3F6F4',
      heroTextSecondary: '#C2CDC7',
      heroLine: 'rgba(243, 246, 244, 0.14)',
      heroBar: '#C9C6BE',
    },
    dark: {
      accent: '#C4C4CC',
      onAccent: '#121214',
      accentSoft: '#222226',
      hero: '#1C1C20',
      heroText: '#F3F6F4',
      heroTextSecondary: '#C1C1C7',
      heroLine: 'rgba(243, 246, 244, 0.12)',
      heroBar: '#C4C4CC',
    },
  },
};

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
  ink: string;
  onInk: string;
  income: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  warning: string;
  warningBg: string;
  danger: string;
  onDanger: string;
  dangerSoft: string;
  hero: string;
  heroText: string;
  heroTextSecondary: string;
  heroLine: string;
  heroBar: string;
  scrim: string;
}

const LIGHT_BASE = {
  bg: '#F6F5F1',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EEEDE8',
  separator: '#E5E2DB',
  cardBorder: '#E5E2DB',
  text: '#16150F',
  textSecondary: '#5F5C54',
  textTertiary: '#6E6B63',
  ink: '#16150F',
  onInk: '#F6F5F1',
  income: '#0B7A55',
  warning: '#964207',
  warningBg: '#FBF1E4',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  dangerSoft: '#FDECEA',
  scrim: 'rgba(22, 21, 15, 0.38)',
} as const;

const DARK_BASE = {
  bg: '#0B0B0C',
  surface: '#151517',
  surfaceRaised: '#1C1C1F',
  surfaceSunken: '#1C1C1F',
  separator: '#26262A',
  cardBorder: '#26262A',
  text: '#F2F1EE',
  textSecondary: '#A6A39C',
  textTertiary: '#8E8B84',
  ink: '#F2F1EE',
  onInk: '#0B0B0C',
  income: '#4CCB97',
  warning: '#F2B04A',
  warningBg: '#2A2013',
  danger: '#F08A7E',
  onDanger: '#0B0B0C',
  dangerSoft: '#2E1615',
  scrim: 'rgba(0, 0, 0, 0.65)',
} as const;

const BLACK_BASE = {
  bg: '#000000',
  surface: '#0B0B0D',
  surfaceRaised: '#141417',
  surfaceSunken: '#141417',
  separator: '#222226',
  cardBorder: '#222226',
  text: '#F2F1EE',
  textSecondary: '#A6A39C',
  textTertiary: '#8E8B84',
  ink: '#F2F1EE',
  onInk: '#000000',
  income: '#4CCB97',
  warning: '#F2B04A',
  warningBg: '#241B10',
  danger: '#F08A7E',
  onDanger: '#000000',
  dangerSoft: '#2A1212',
  scrim: 'rgba(0, 0, 0, 0.78)',
} as const;

export function getPalette(
  mode: ResolvedColorMode,
  accent: AccentTheme = 'forest'
): ColorPalette {
  const accentDef = ACCENT_DEFINITIONS[accent] ?? ACCENT_DEFINITIONS.forest;
  const spec = mode === 'light' ? accentDef.light : accentDef.dark;
  const base =
    mode === 'light' ? LIGHT_BASE : mode === 'black' ? BLACK_BASE : DARK_BASE;

  return {
    ...base,
    ...spec,
  };
}

export const lightColors: ColorPalette = getPalette('light', 'forest');
export const darkColors: ColorPalette = getPalette('dark', 'forest');
export const blackColors: ColorPalette = getPalette('black', 'forest');

// v1.2 uses flat hairline-bordered surfaces with zero drop shadow.
export const lightCardShadow: ViewStyle = {};
export const darkCardShadow: ViewStyle = {};

export interface AppTheme {
  scheme: 'light' | 'dark';
  mode: ResolvedColorMode;
  accent: AccentTheme;
  accentDef: AccentDefinition;
  colors: ColorPalette;
  heroGradient: readonly [string, string];
  spacing: typeof spacing;
  geometry: typeof geometry;
  radius: typeof radius;
  touch: typeof touch;
  motion: typeof motion;
  typography: typeof typography;
  cardShadow: ViewStyle;
}

export function buildTheme(
  mode: ResolvedColorMode,
  accent: AccentTheme = 'forest'
): AppTheme {
  const accentDef = ACCENT_DEFINITIONS[accent] ?? ACCENT_DEFINITIONS.forest;
  const colors = getPalette(mode, accent);
  const scheme: 'light' | 'dark' = mode === 'light' ? 'light' : 'dark';
  return {
    scheme,
    mode,
    accent: accentDef.id,
    accentDef,
    colors,
    heroGradient: [colors.hero, colors.hero],
    spacing,
    geometry,
    radius,
    touch,
    motion,
    typography,
    cardShadow: scheme === 'light' ? lightCardShadow : darkCardShadow,
  };
}

export const lightTheme: AppTheme = buildTheme('light', 'forest');
export const darkTheme: AppTheme = buildTheme('dark', 'forest');
export const blackTheme: AppTheme = buildTheme('black', 'forest');
