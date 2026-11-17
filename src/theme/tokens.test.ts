import { ACCENT_THEMES } from '@/domain/types';
import {
  BANGLA_FONTS,
  getPalette,
  mapFontToBangla,
  type ColorPalette,
  type ResolvedColorMode,
} from './tokens';

function relativeLuminance(hex: string): number {
  const num = Number.parseInt(hex.slice(1), 16);
  const channels = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(fg: string, bg: string): number {
  const la = relativeLuminance(fg);
  const lb = relativeLuminance(bg);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Flattens an rgba() colour over an opaque hex background into a hex colour. */
function compositeOver(rgba: string, bgHex: string): string {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const [r, g, b, a = '1'] = m[1].split(',').map((v) => Number.parseFloat(v));
  const alpha = Number(a);
  const bg = Number.parseInt(bgHex.slice(1), 16);
  const mix = (fg: number, back: number) => Math.round(fg * alpha + back * (1 - alpha));
  const out = [mix(r, (bg >> 16) & 255), mix(g, (bg >> 8) & 255), mix(b, bg & 255)];
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

type SurfaceKey = 'bg' | 'surface' | 'surfaceRaised';
type TextRoleKey =
  | 'text'
  | 'textSecondary'
  | 'textTertiary'
  | 'income'
  | 'accent'
  | 'warning'
  | 'danger';

function assertPaletteContrast(name: string, p: ColorPalette): void {
  const surfaces: SurfaceKey[] = ['bg', 'surface', 'surfaceRaised'];
  const textRoles: TextRoleKey[] = [
    'text',
    'textSecondary',
    'textTertiary',
    'income',
    'accent',
    'warning',
    'danger',
  ];

  for (const bg of surfaces) {
    for (const fg of textRoles) {
      const ratio = contrastRatio(p[fg], p[bg]);
      if (ratio < 4.5) {
        throw new Error(
          `${name}: ${fg} (${p[fg]}) on ${bg} (${p[bg]}) contrast ${ratio.toFixed(2)} < 4.5`
        );
      }
    }
  }

  expect(contrastRatio(p.text, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.textSecondary, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.accent, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.warning, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.warning, p.warningBg)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.text, p.warningBg)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.danger, p.dangerSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.text, p.dangerSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.onDanger, p.danger)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.onInk, p.ink)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.heroText, p.hero)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.heroTextSecondary, p.hero)).toBeGreaterThanOrEqual(4.5);

  // heroStrip is translucent white over the hero fill: composite it, then check the text drawn on it.
  const strip = compositeOver(p.heroStrip, p.hero);
  expect(contrastRatio(p.heroText, strip)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.heroTextSecondary, strip)).toBeGreaterThanOrEqual(4.5);

  // Glass fills are opaque hex in dark modes; the light ones are translucent and cannot be measured here.
  if (p.glassFill.startsWith('#')) {
    for (const glass of [p.glassFill, p.glassSoft]) {
      expect(contrastRatio(p.text, glass)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textSecondary, glass)).toBeGreaterThanOrEqual(4.5);
    }
  }
}

describe('v1.2 token WCAG AA contrast across all 5 accents x 3 resolved modes', () => {
  const modes: readonly ResolvedColorMode[] = ['light', 'dark', 'black'];

  for (const accent of ACCENT_THEMES) {
    for (const mode of modes) {
      it(`passes >= 4.5:1 for ${accent} / ${mode}`, () => {
        assertPaletteContrast(`${accent}/${mode}`, getPalette(mode, accent));
      });
    }
  }

  it('maps each Manrope weight cleanly without matching SemiBold as Bold', () => {
    expect(mapFontToBangla('Manrope_400Regular')).toBe(BANGLA_FONTS.regular);
    expect(mapFontToBangla('Manrope_500Medium')).toBe(BANGLA_FONTS.medium);
    expect(mapFontToBangla('Manrope_600SemiBold')).toBe(BANGLA_FONTS.semibold);
    expect(mapFontToBangla('Manrope_700Bold')).toBe(BANGLA_FONTS.bold);
    expect(mapFontToBangla(undefined)).toBe(BANGLA_FONTS.regular);
  });
});
