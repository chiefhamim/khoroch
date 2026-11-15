import {
  BANGLA_FONT_KEYS,
  EXPENSE_COLOR_KEYS,
  INCOME_COLOR_KEYS,
} from '@/domain/types';
import {
  BANGLA_FONT_FAMILIES,
  buildTheme,
  EXPENSE_COLOR_PRESETS,
  INCOME_COLOR_PRESETS,
  mapFontToBangla,
  type ResolvedColorMode,
} from './tokens';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Bangla font families and custom money color presets', () => {
  it('maps every BanglaFontKey across regular, medium, semibold, and bold weights', () => {
    for (const key of BANGLA_FONT_KEYS) {
      const family = BANGLA_FONT_FAMILIES[key];
      expect(mapFontToBangla('Manrope_400Regular', undefined, key)).toBe(family.regular);
      expect(mapFontToBangla('Manrope_500Medium', undefined, key)).toBe(family.medium);
      expect(mapFontToBangla('Manrope_600SemiBold', undefined, key)).toBe(family.semibold);
      expect(mapFontToBangla('Manrope_700Bold', undefined, key)).toBe(family.bold);
      expect(mapFontToBangla(undefined, '700', key)).toBe(family.bold);
    }
  });

  it('meets WCAG AA (>= 4.5:1) contrast for every income and expense preset on light, dark, and black modes', () => {
    const modes: ResolvedColorMode[] = ['light', 'dark', 'black'];
    for (const mode of modes) {
      for (const incomeKey of INCOME_COLOR_KEYS) {
        const theme = buildTheme(mode, 'graphite', { incomeColor: incomeKey });
        expect(theme.colors.income).toBe(
          mode === 'light'
            ? INCOME_COLOR_PRESETS[incomeKey].light
            : INCOME_COLOR_PRESETS[incomeKey].dark
        );
        expect(contrastRatio(theme.colors.income, theme.colors.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.colors.income, theme.colors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.colors.income, theme.colors.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
      }

      for (const expenseKey of EXPENSE_COLOR_KEYS) {
        const theme = buildTheme(mode, 'graphite', { expenseColor: expenseKey });
        expect(theme.colors.expense).toBe(
          mode === 'light'
            ? EXPENSE_COLOR_PRESETS[expenseKey].light
            : EXPENSE_COLOR_PRESETS[expenseKey].dark
        );
        expect(contrastRatio(theme.colors.expense, theme.colors.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.colors.expense, theme.colors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.colors.expense, theme.colors.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
