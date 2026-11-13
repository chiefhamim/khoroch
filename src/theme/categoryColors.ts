import { CATEGORY_COLOR_KEYS, type CategoryColorKey } from '@/domain/types';

export { CATEGORY_COLOR_KEYS, type CategoryColorKey };

export interface CategoryColorSpec {
  light: string;
  dark: string;
  label: string;
}

export const CATEGORY_COLORS: Record<CategoryColorKey, CategoryColorSpec> = {
  orange: { light: '#E8590C', dark: '#FF922B', label: 'Orange' },
  green: { light: '#2F9E44', dark: '#69DB7C', label: 'Green' },
  blue: { light: '#1C7ED6', dark: '#4DABF7', label: 'Blue' },
  pink: { light: '#D6336C', dark: '#F783AC', label: 'Pink' },
  violet: { light: '#7048E8', dark: '#9775FA', label: 'Violet' },
  amber: { light: '#E67700', dark: '#FFD43B', label: 'Amber' },
  red: { light: '#E03131', dark: '#FF8787', label: 'Red' },
  grape: { light: '#AE3EC9', dark: '#DA77F2', label: 'Grape' },
  indigo: { light: '#4263EB', dark: '#748FFC', label: 'Indigo' },
  cyan: { light: '#0C8599', dark: '#3BC9DB', label: 'Cyan' },
  teal: { light: '#099268', dark: '#38D9A9', label: 'Teal' },
  lime: { light: '#5C940D', dark: '#A9E34B', label: 'Lime' },
  gray: { light: '#6B7280', dark: '#9CA3AF', label: 'Gray' },
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
    return `rgba(107, 114, 128, ${alpha})`;
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getCategoryTileVisual(
  colorKey: string | null | undefined,
  scheme: 'light' | 'dark'
): { fg: string; bg: string } {
  const key = normalizeCategoryColorKey(colorKey);
  const spec = CATEGORY_COLORS[key];
  const fg = scheme === 'dark' ? spec.dark : spec.light;
  const alpha = scheme === 'dark' ? 0.18 : 0.14;
  return {
    fg,
    bg: hexToRgba(fg, alpha),
  };
}
