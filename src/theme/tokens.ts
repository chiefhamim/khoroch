import type { ViewStyle } from 'react-native';
import type { AccentTheme } from '@/domain/types';

export type ResolvedColorMode = 'light' | 'dark' | 'black';

/** The taka glyph is kept in Hind Siliguri so it remains stable beside every app font. */
export const TAKA_FONT_FAMILY = 'HindSiliguri_600SemiBold';
export const BANGLA_FONT_FAMILY = 'HindSiliguri_600SemiBold';

export const BANGLA_FONTS = {
  regular: 'HindSiliguri_400Regular',
  medium: 'HindSiliguri_500Medium',
  semibold: 'HindSiliguri_600SemiBold',
  bold: 'HindSiliguri_700Bold',
} as const;

const BENGALI_CHAR_REGEX = /[\u0980-\u09FF]/;

export function containsBengali(text: string): boolean {
  return BENGALI_CHAR_REGEX.test(text);
}

export function mapFontToBangla(
  fontFamily?: string,
  fontWeight?: string | number
): string {
  const weightStr = fontWeight !== undefined ? String(fontWeight) : '';
  if (weightStr === '700' || weightStr === '800' || weightStr === '900' || weightStr === 'bold') {
    return BANGLA_FONTS.bold;
  }
  if (weightStr === '600') {
    return BANGLA_FONTS.semibold;
  }
  if (weightStr === '500') {
    return BANGLA_FONTS.medium;
  }
  if (!fontFamily) return BANGLA_FONTS.regular;
  if (fontFamily.includes('600') || fontFamily.includes('SemiBold')) {
    return BANGLA_FONTS.semibold;
  }
  if (fontFamily.includes('700') || fontFamily.includes('Bold')) {
    return BANGLA_FONTS.bold;
  }
  if (fontFamily.includes('500') || fontFamily.includes('Medium')) {
    return BANGLA_FONTS.medium;
  }
  return BANGLA_FONTS.regular;
}

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
  screenMargin: 16,
  cardPadding: 18,
  listRowHeight: 62,
  iconTile: 38,
  sectionGap: 24,
  cardGap: 12,
  progressBarHeight: 6,
  buttonHeight: 50,
  smallButtonHeight: 40,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
} as const;

export const radius = {
  card: 20,
  heroCard: 20,
  sheetTop: 28,
  button: 14,
  input: 14,
  iconTile: 12,
  monogram: 10,
  chip: 999,
  keypadKey: 14,
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
  staggerMs: 40,
  countMs: 400,
} as const;

export const typography = {
  hero: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.4,
    fontFamily: 'Manrope_700Bold',
  },
  display: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.9,
    fontFamily: 'Manrope_700Bold',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontFamily: 'Manrope_700Bold',
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Manrope_600SemiBold',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Manrope_400Regular',
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Manrope_600SemiBold',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Manrope_500Medium',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Manrope_500Medium',
  },
  overline: {
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.6,
    fontFamily: 'Manrope_700Bold',
  },
  tab: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Manrope_600SemiBold',
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
      heroLine: 'rgba(243, 246, 244, 0.16)',
      heroBar: '#5FD3A3',
    },
    dark: {
      accent: '#4CCB97',
      onAccent: '#04231A',
      accentSoft: '#10291F',
      hero: '#173A2C',
      heroText: '#F3F6F4',
      heroTextSecondary: '#B8C7C0',
      heroLine: 'rgba(243, 246, 244, 0.14)',
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
      heroLine: 'rgba(243, 246, 244, 0.16)',
      heroBar: '#7FB2F0',
    },
    dark: {
      accent: '#7FB2F0',
      onAccent: '#0B1B33',
      accentSoft: '#132036',
      hero: '#1A2D57',
      heroText: '#F3F6F4',
      heroTextSecondary: '#B9C5D9',
      heroLine: 'rgba(243, 246, 244, 0.14)',
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
      heroLine: 'rgba(243, 246, 244, 0.16)',
      heroBar: '#D4B0FA',
    },
    dark: {
      accent: '#C59DF5',
      onAccent: '#1F0F30',
      accentSoft: '#231732',
      hero: '#34204D',
      heroText: '#F3F6F4',
      heroTextSecondary: '#C6BAD6',
      heroLine: 'rgba(243, 246, 244, 0.14)',
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
      heroLine: 'rgba(243, 246, 244, 0.18)',
      heroBar: '#F5B864',
    },
    dark: {
      accent: '#F0A35E',
      onAccent: '#2A1205',
      accentSoft: '#2D1B12',
      hero: '#4A2414',
      heroText: '#F3F6F4',
      heroTextSecondary: '#D2BEB3',
      heroLine: 'rgba(243, 246, 244, 0.16)',
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
      heroLine: 'rgba(243, 246, 244, 0.16)',
      heroBar: '#C9C6BE',
    },
    dark: {
      accent: '#C4C4CC',
      onAccent: '#121214',
      accentSoft: '#222226',
      hero: '#232327',
      heroText: '#F3F6F4',
      heroTextSecondary: '#C1C1C7',
      heroLine: 'rgba(243, 246, 244, 0.14)',
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
  bg: '#F2F1EC',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EAE8E0',
  separator: '#E2DFD6',
  cardBorder: '#E5E2D9',
  text: '#16150F',
  textSecondary: '#5B5850',
  textTertiary: '#68655D',
  ink: '#16150F',
  onInk: '#F6F5F1',
  income: '#0B7A55',
  warning: '#964207',
  warningBg: '#FBF1E4',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  dangerSoft: '#FDECEA',
  scrim: 'rgba(22, 21, 15, 0.42)',
} as const;

const DARK_BASE = {
  bg: '#0B0B0E',
  surface: '#16161B',
  surfaceRaised: '#222229',
  surfaceSunken: '#101014',
  separator: '#282832',
  cardBorder: '#2A2A34',
  text: '#F2F1EE',
  textSecondary: '#ABA8A0',
  textTertiary: '#98958E',
  ink: '#F2F1EE',
  onInk: '#0B0B0E',
  income: '#4CCB97',
  warning: '#F2B04A',
  warningBg: '#2A2013',
  danger: '#F08A7E',
  onDanger: '#0B0B0E',
  dangerSoft: '#2E1615',
  scrim: 'rgba(0, 0, 0, 0.68)',
} as const;

const BLACK_BASE = {
  bg: '#000000',
  surface: '#111115',
  surfaceRaised: '#1D1D24',
  surfaceSunken: '#08080B',
  separator: '#24242D',
  cardBorder: '#25252F',
  text: '#F2F1EE',
  textSecondary: '#ABA8A0',
  textTertiary: '#96938C',
  ink: '#F2F1EE',
  onInk: '#000000',
  income: '#4CCB97',
  warning: '#F2B04A',
  warningBg: '#241B10',
  danger: '#F08A7E',
  onDanger: '#000000',
  dangerSoft: '#2A1212',
  scrim: 'rgba(0, 0, 0, 0.8)',
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

export interface ElevationTokens {
  none: ViewStyle;
  e1: ViewStyle;
  e2: ViewStyle;
  e3: ViewStyle;
}

export const lightElevation: ElevationTokens = {
  none: {},
  e1: {
    boxShadow:
      '0 0 0 0.5px rgba(22,22,44,0.06), 0 1px 2px rgba(22,22,44,0.04), 0 8px 22px -12px rgba(22,22,44,0.18)',
  },
  e2: {
    boxShadow:
      '0 0 0 0.5px rgba(22,22,44,0.07), 0 2px 5px rgba(22,22,44,0.06), 0 14px 30px -14px rgba(22,22,44,0.28)',
  },
  e3: {
    boxShadow:
      '0 0 0 0.5px rgba(22,22,44,0.08), 0 6px 14px rgba(22,22,44,0.08), 0 26px 52px -18px rgba(22,22,44,0.38)',
  },
};

export const darkElevation: ElevationTokens = {
  none: {},
  e1: {
    boxShadow:
      '0 0 0 0.5px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.45), 0 10px 24px -12px rgba(0,0,0,0.70)',
  },
  e2: {
    boxShadow:
      '0 0 0 0.5px rgba(255,255,255,0.10), 0 2px 5px rgba(0,0,0,0.50), 0 16px 32px -14px rgba(0,0,0,0.80)',
  },
  e3: {
    boxShadow:
      '0 0 0 0.5px rgba(255,255,255,0.12), 0 6px 14px rgba(0,0,0,0.50), 0 28px 56px -18px rgba(0,0,0,0.85)',
  },
};

export const lightCardShadow: ViewStyle = lightElevation.e1;
export const darkCardShadow: ViewStyle = darkElevation.e1;

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
  elevation: ElevationTokens;
  cardShadow: ViewStyle;
}

export function buildTheme(
  mode: ResolvedColorMode,
  accent: AccentTheme = 'forest'
): AppTheme {
  const accentDef = ACCENT_DEFINITIONS[accent] ?? ACCENT_DEFINITIONS.forest;
  const colors = getPalette(mode, accent);
  const scheme: 'light' | 'dark' = mode === 'light' ? 'light' : 'dark';
  const elevation = scheme === 'light' ? lightElevation : darkElevation;
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
    elevation,
    cardShadow: elevation.e1,
  };
}

export const lightTheme: AppTheme = buildTheme('light', 'forest');
export const darkTheme: AppTheme = buildTheme('dark', 'forest');
export const blackTheme: AppTheme = buildTheme('black', 'forest');
