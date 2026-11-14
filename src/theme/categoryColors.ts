import { CATEGORY_COLOR_KEYS, type CategoryColorKey } from '@/domain/types';

export { CATEGORY_COLOR_KEYS, type CategoryColorKey };

export interface CategoryColorSpec {
  light: string;
  dark: string;
  label: string;
}

export const CATEGORY_COLORS: Record<CategoryColorKey, CategoryColorSpec> = {
  orange: { light: '#D9480F', dark: '#FF922B', label: 'Orange' },
  green: { light: '#2B8A3E', dark: '#69DB7C', label: 'Green' },
  blue: { light: '#1971C2', dark: '#4DABF7', label: 'Blue' },
  pink: { light: '#C2255C', dark: '#F783AC', label: 'Pink' },
  violet: { light: '#6741D9', dark: '#9775FA', label: 'Violet' },
  amber: { light: '#C77700', dark: '#FFD43B', label: 'Amber' },
  red: { light: '#B42318', dark: '#F08A7E', label: 'Red' },
  grape: { light: '#9C36B5', dark: '#DA77F2', label: 'Grape' },
  indigo: { light: '#3B5BDB', dark: '#748FFC', label: 'Indigo' },
  cyan: { light: '#0C8599', dark: '#3BC9DB', label: 'Cyan' },
  teal: { light: '#0B7A55', dark: '#4CCB97', label: 'Teal' },
  lime: { light: '#5C7A2E', dark: '#A9E34B', label: 'Lime' },
  gray: { light: '#5F5C54', dark: '#A6A39C', label: 'Gray' },
};

const COLOR_KEY_SET = new Set<string>(CATEGORY_COLOR_KEYS);

export function isCategoryColorKey(value: string | null | undefined): value is CategoryColorKey {
  return typeof value === 'string' && COLOR_KEY_SET.has(value);
}

export function normalizeCategoryColorKey(value: string | null | undefined): CategoryColorKey {
  return isCategoryColorKey(value) ? value : 'gray';
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const num = Number.parseInt(clean, 16);
  if (!Number.isFinite(num) || clean.length !== 6) {
    return `rgba(95, 92, 84, ${alpha})`;
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Category glyphs keep their category colour paired with a soft tinted background.
 */
export function getCategoryTileVisual(
  colorKey: string | null | undefined,
  scheme: 'light' | 'dark'
): { fg: string; bg: string } {
  const key = normalizeCategoryColorKey(colorKey);
  const spec = CATEGORY_COLORS[key];
  const fg = scheme === 'dark' ? spec.dark : spec.light;
  const bg = hexToRgba(fg, scheme === 'dark' ? 0.18 : 0.12);
  return { fg, bg };
}
