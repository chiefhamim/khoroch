import type { TextStyle, ViewStyle } from 'react-native';
import type {
  AccentTheme,
  BanglaFontKey,
  ExpenseColorKey,
  IncomeColorKey,
} from '@/domain/types';

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

export const BANGLA_FONT_FAMILIES: Record<
  BanglaFontKey,
  { regular: string; medium: string; semibold: string; bold: string }
> = {
  noto_sans_bengali: {
    regular: 'NotoSansBengali_400Regular',
    medium: 'NotoSansBengali_500Medium',
    semibold: 'NotoSansBengali_600SemiBold',
    bold: 'NotoSansBengali_700Bold',
  },
  anek_bangla: {
    regular: 'AnekBangla_400Regular',
    medium: 'AnekBangla_500Medium',
    semibold: 'AnekBangla_600SemiBold',
    bold: 'AnekBangla_700Bold',
  },
  solaiman_lipi: {
    regular: 'SolaimanLipi_400Regular',
    medium: 'SolaimanLipi_400Regular',
    semibold: 'SolaimanLipi_700Bold',
    bold: 'SolaimanLipi_700Bold',
  },
  kalpurush: {
    regular: 'Kalpurush_400Regular',
    medium: 'Kalpurush_400Regular',
    semibold: 'Kalpurush_400Regular',
    bold: 'Kalpurush_400Regular',
  },
  nikosh: {
    regular: 'NikoshBAN_400Regular',
    medium: 'NikoshBAN_400Regular',
    semibold: 'NikoshBAN_400Regular',
    bold: 'NikoshBAN_400Regular',
  },
  sutuji: {
    regular: 'SutonnyOMJ_400Regular',
    medium: 'SutonnyOMJ_400Regular',
    semibold: 'SutonnyOMJ_400Regular',
    bold: 'SutonnyOMJ_400Regular',
  },
  hind_siliguri: BANGLA_FONTS,
};

const BENGALI_CHAR_REGEX = /[\u0980-\u09FF]/;

export function containsBengali(text: string): boolean {
  return BENGALI_CHAR_REGEX.test(text);
}

export function mapFontToBangla(
  fontFamily?: string,
  fontWeight?: TextStyle['fontWeight'],
  banglaFont: BanglaFontKey = 'hind_siliguri'
): string {
  const family = BANGLA_FONT_FAMILIES[banglaFont] ?? BANGLA_FONTS;
  const weightStr = fontWeight !== undefined ? String(fontWeight) : '';
  if (weightStr === '700' || weightStr === '800' || weightStr === '900' || weightStr === 'bold') {
    return family.bold;
  }
  if (weightStr === '600') {
    return family.semibold;
  }
  if (weightStr === '500') {
    return family.medium;
  }
  if (!fontFamily) return family.regular;
  if (fontFamily.includes('600') || fontFamily.includes('SemiBold')) {
    return family.semibold;
  }
  if (fontFamily.includes('700') || fontFamily.includes('Bold')) {
    return family.bold;
  }
  if (fontFamily.includes('500') || fontFamily.includes('Medium')) {
    return family.medium;
  }
  return family.regular;
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
  cardPadding: 16,
  listRowHeight: 56,
  iconTile: 38,
  sectionGap: 20,
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
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.2,
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
      accent: '#34D399',
      onAccent: '#032016',
      accentSoft: '#0E241C',
      hero: '#11271E',
      heroText: '#F4F4F6',
      heroTextSecondary: '#B8C7C0',
      heroLine: 'rgba(244, 244, 246, 0.14)',
      heroBar: '#34D399',
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
      accent: '#5B9BFF',
      onAccent: '#06152B',
      accentSoft: '#111E33',
      hero: '#131317',
      heroText: '#F4F4F6',
      heroTextSecondary: '#B8C4D8',
      heroLine: 'rgba(244, 244, 246, 0.14)',
      heroBar: '#5B9BFF',
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
      accent: '#B68DF8',
      onAccent: '#1A0B30',
      accentSoft: '#1E152E',
      hero: '#241838',
      heroText: '#F4F4F6',
      heroTextSecondary: '#C6BAD6',
      heroLine: 'rgba(244, 244, 246, 0.14)',
      heroBar: '#B68DF8',
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
      accent: '#F59E42',
      onAccent: '#261102',
      accentSoft: '#26190E',
      hero: '#321B0E',
      heroText: '#F4F4F6',
      heroTextSecondary: '#D2BEB3',
      heroLine: 'rgba(244, 244, 246, 0.16)',
      heroBar: '#F59E42',
    },
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite',
    swatchColor: '#1E212D',
    light: {
      accent: '#232632',
      onAccent: '#FFFFFF',
      accentSoft: '#E8EAF0',
      hero: '#E7EAF1',
      heroText: '#14161D',
      heroTextSecondary: '#555B6B',
      heroLine: 'rgba(20, 22, 29, 0.12)',
      heroBar: '#0B7A55',
    },
    dark: {
      accent: '#F4F4F6',
      onAccent: '#111216',
      accentSoft: '#252730',
      hero: '#1E2027',
      heroText: '#F4F4F6',
      heroTextSecondary: '#B5B7C2',
      heroLine: 'rgba(244, 244, 246, 0.14)',
      heroBar: '#F4F4F6',
    },
  },
};

export interface MoneyTonePreset {
  id: string;
  light: string;
  dark: string;
  bgLight: string;
  bgDark: string;
  swatch: string;
}

export const INCOME_COLOR_PRESETS: Record<IncomeColorKey, MoneyTonePreset> = {
  emerald: {
    id: 'emerald',
    light: '#0B7A55',
    dark: '#34D399',
    bgLight: '#E8F6F0',
    bgDark: '#0E241C',
    swatch: '#0F8E63',
  },
  teal: {
    id: 'teal',
    light: '#0B6E7D',
    dark: '#2DD4BF',
    bgLight: '#E7F5F8',
    bgDark: '#0D2224',
    swatch: '#0D8394',
  },
  ocean: {
    id: 'ocean',
    light: '#194B96',
    dark: '#63A1FF',
    bgLight: '#EBF2FC',
    bgDark: '#101D33',
    swatch: '#245FB8',
  },
  violet: {
    id: 'violet',
    light: '#5B2C82',
    dark: '#B68DF8',
    bgLight: '#F3ECF9',
    bgDark: '#1E152E',
    swatch: '#6E389E',
  },
  gold: {
    id: 'gold',
    light: '#804D00',
    dark: '#FBBF24',
    bgLight: '#FBF2E1',
    bgDark: '#271E0E',
    swatch: '#B0700E',
  },
  ink: {
    id: 'ink',
    light: '#16150F',
    dark: '#F4F4F6',
    bgLight: '#EAE8E0',
    bgDark: '#1D1D23',
    swatch: '#3A3832',
  },
};

export const EXPENSE_COLOR_PRESETS: Record<ExpenseColorKey, MoneyTonePreset> = {
  ink: {
    id: 'ink',
    light: '#16150F',
    dark: '#F4F4F6',
    bgLight: '#EAE8E0',
    bgDark: '#1D1D23',
    swatch: '#3A3832',
  },
  crimson: {
    id: 'crimson',
    light: '#B42318',
    dark: '#F87171',
    bgLight: '#FDECEA',
    bgDark: '#2A1416',
    swatch: '#C92D21',
  },
  rose: {
    id: 'rose',
    light: '#A61B54',
    dark: '#F472B6',
    bgLight: '#FCEAF2',
    bgDark: '#2A131E',
    swatch: '#C22668',
  },
  amber: {
    id: 'amber',
    light: '#8C4006',
    dark: '#F59E42',
    bgLight: '#FBF1E4',
    bgDark: '#26190E',
    swatch: '#B5550D',
  },
  plum: {
    id: 'plum',
    light: '#6A2378',
    dark: '#C084FC',
    bgLight: '#F5EBFA',
    bgDark: '#24142B',
    swatch: '#833094',
  },
  teal: {
    id: 'teal',
    light: '#0B6E7D',
    dark: '#2DD4BF',
    bgLight: '#E7F5F8',
    bgDark: '#0D2224',
    swatch: '#0D8394',
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
  incomeBg: string;
  expense: string;
  expenseBg: string;
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
  incomeBg: '#E8F6F0',
  expense: '#16150F',
  expenseBg: '#EAE8E0',
  warning: '#964207',
  warningBg: '#FBF1E4',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  dangerSoft: '#FDECEA',
  scrim: 'rgba(22, 21, 15, 0.42)',
} as const;

const DARK_BASE = {
  bg: '#121316',
  surface: '#1C1D23',
  surfaceRaised: '#252730',
  surfaceSunken: '#15161B',
  separator: '#292B35',
  cardBorder: '#323440',
  text: '#F4F4F6',
  textSecondary: '#B5B7C2',
  textTertiary: '#9698A6',
  ink: '#F4F4F6',
  onInk: '#121316',
  income: '#34D399',
  incomeBg: '#12281F',
  expense: '#F4F4F6',
  expenseBg: '#22242C',
  warning: '#FBBF24',
  warningBg: '#2A2010',
  danger: '#F87171',
  onDanger: '#180607',
  dangerSoft: '#2E1619',
  scrim: 'rgba(0, 0, 0, 0.72)',
} as const;

const BLACK_BASE = {
  bg: '#000000',
  surface: '#0C0C0F',
  surfaceRaised: '#17171C',
  surfaceSunken: '#060608',
  separator: '#202026',
  cardBorder: '#24242B',
  text: '#F4F4F6',
  textSecondary: '#B2B2BC',
  textTertiary: '#92929E',
  ink: '#F4F4F6',
  onInk: '#000000',
  income: '#34D399',
  incomeBg: '#0E241C',
  expense: '#F4F4F6',
  expenseBg: '#19191F',
  warning: '#FBBF24',
  warningBg: '#241B0C',
  danger: '#F87171',
  onDanger: '#000000',
  dangerSoft: '#261214',
  scrim: 'rgba(0, 0, 0, 0.84)',
} as const;

export function getPalette(
  mode: ResolvedColorMode,
  accent: AccentTheme = 'forest',
  incomeColor: IncomeColorKey = 'emerald',
  expenseColor: ExpenseColorKey = 'ink'
): ColorPalette {
  const accentDef = ACCENT_DEFINITIONS[accent] ?? ACCENT_DEFINITIONS.forest;
  const spec = mode === 'light' ? accentDef.light : accentDef.dark;
  const base =
    mode === 'light' ? LIGHT_BASE : mode === 'black' ? BLACK_BASE : DARK_BASE;
  const inc = INCOME_COLOR_PRESETS[incomeColor] ?? INCOME_COLOR_PRESETS.emerald;
  const exp = EXPENSE_COLOR_PRESETS[expenseColor] ?? EXPENSE_COLOR_PRESETS.ink;
  const isLight = mode === 'light';

  // One neutral hero surface per scheme; the accent only supplies a tint (see HeroCard).
  const hero = isLight
    ? {
        hero: '#EEF0F5',
        heroText: '#14161D',
        heroTextSecondary: '#555B6B',
        heroLine: 'rgba(20, 22, 29, 0.12)',
        heroBar: spec.heroBar,
      }
    : {
        hero: mode === 'black' ? '#0E0E12' : '#1E2027',
        heroText: '#F4F4F6',
        heroTextSecondary: mode === 'black' ? '#B2B2BC' : '#B5B7C2',
        heroLine: 'rgba(255, 255, 255, 0.14)',
        heroBar: accent === 'graphite' ? '#F4F4F6' : spec.accent,
      };

  return {
    ...base,
    ...spec,
    ...hero,
    income: isLight ? inc.light : inc.dark,
    incomeBg: isLight ? inc.bgLight : inc.bgDark,
    expense: isLight ? exp.light : exp.dark,
    expenseBg: isLight ? exp.bgLight : exp.bgDark,
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
      '0 0 0 0.5px rgba(22,22,44,0.06), 0 2px 4px rgba(22,22,44,0.05), 0 10px 24px -10px rgba(22,22,44,0.20)',
  },
  e2: {
    boxShadow:
      '0 0 0 0.5px rgba(22,22,44,0.08), 0 4px 8px rgba(22,22,44,0.07), 0 18px 36px -12px rgba(22,22,44,0.28)',
  },
  e3: {
    boxShadow:
      '0 0 0 0.5px rgba(22,22,44,0.10), 0 8px 18px rgba(22,22,44,0.10), 0 28px 56px -16px rgba(22,22,44,0.38)',
  },
};

export const darkElevation: ElevationTokens = {
  none: {},
  e1: {
    boxShadow:
      '0 0 0 1px rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.45), 0 12px 24px -10px rgba(0,0,0,0.72)',
  },
  e2: {
    boxShadow:
      '0 0 0 1px rgba(255,255,255,0.11), 0 4px 10px rgba(0,0,0,0.5), 0 18px 36px -12px rgba(0,0,0,0.78)',
  },
  e3: {
    boxShadow:
      '0 0 0 1px rgba(255,255,255,0.13), 0 8px 18px rgba(0,0,0,0.55), 0 28px 54px -16px rgba(0,0,0,0.85)',
  },
};

export const lightCardShadow: ViewStyle = lightElevation.e1;
export const darkCardShadow: ViewStyle = darkElevation.e1;

export interface AppTheme {
  scheme: 'light' | 'dark';
  mode: ResolvedColorMode;
  accent: AccentTheme;
  accentDef: AccentDefinition;
  banglaFont: BanglaFontKey;
  incomeColor: IncomeColorKey;
  expenseColor: ExpenseColorKey;
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
  accent: AccentTheme = 'forest',
  options?: {
    banglaFont?: BanglaFontKey;
    incomeColor?: IncomeColorKey;
    expenseColor?: ExpenseColorKey;
  }
): AppTheme {
  const accentDef = ACCENT_DEFINITIONS[accent] ?? ACCENT_DEFINITIONS.forest;
  const banglaFont = options?.banglaFont ?? 'hind_siliguri';
  const incomeColor = options?.incomeColor ?? 'emerald';
  const expenseColor = options?.expenseColor ?? 'ink';
  const colors = getPalette(mode, accent, incomeColor, expenseColor);
  const scheme: 'light' | 'dark' = mode === 'light' ? 'light' : 'dark';
  const elevation = scheme === 'light' ? lightElevation : darkElevation;
  return {
    scheme,
    mode,
    accent: accentDef.id,
    accentDef,
    banglaFont,
    incomeColor,
    expenseColor,
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
