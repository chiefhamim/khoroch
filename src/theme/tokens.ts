export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
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
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Inter_600SemiBold',
  },
  heading: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Inter_600SemiBold',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },
} as const;

export type TypographyVariant = keyof typeof typography;

export interface ColorPalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  income: string;
  expense: string;
  warning: string;
  danger: string;
  onDanger: string;
  border: string;
}

export const lightColors: ColorPalette = {
  bg: '#F6F7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3EF',
  text: '#1C2321',
  textMuted: '#5E6863',
  primary: '#1F6F54',
  primarySoft: '#DDF0E6',
  onPrimary: '#FFFFFF',
  income: '#1F7A4A',
  expense: '#B94536',
  warning: '#966109',
  danger: '#C0392B',
  onDanger: '#FFFFFF',
  border: '#E3E7E4',
};

export const darkColors: ColorPalette = {
  bg: '#0F1412',
  surface: '#171D1B',
  surfaceAlt: '#1F2724',
  text: '#ECF1EE',
  textMuted: '#9AA5A0',
  primary: '#5CC49A',
  primarySoft: '#1F3A2F',
  onPrimary: '#0F1412',
  income: '#6BCB94',
  expense: '#F08A7A',
  warning: '#E5B04A',
  danger: '#F28076',
  onDanger: '#0F1412',
  border: '#2A332F',
};

export interface AppTheme {
  scheme: 'light' | 'dark';
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  touch: typeof touch;
  motion: typeof motion;
  typography: typeof typography;
}

export const lightTheme: AppTheme = {
  scheme: 'light',
  colors: lightColors,
  spacing,
  radius,
  touch,
  motion,
  typography,
};

export const darkTheme: AppTheme = {
  scheme: 'dark',
  colors: darkColors,
  spacing,
  radius,
  touch,
  motion,
  typography,
};
