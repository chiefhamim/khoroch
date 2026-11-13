import { darkColors, lightColors, type ColorPalette } from './tokens';

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

type SurfaceKey = 'bg' | 'surface' | 'surfaceRaised';
type TextRoleKey = 'text' | 'textSecondary' | 'textTertiary' | 'accent' | 'warning' | 'danger';

function assertPaletteContrast(name: string, p: ColorPalette): void {
  const surfaces: SurfaceKey[] = ['bg', 'surface', 'surfaceRaised'];
  const textRoles: TextRoleKey[] = [
    'text',
    'textSecondary',
    'textTertiary',
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
  expect(contrastRatio(p.danger, p.dangerSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.text, p.dangerSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(p.onDanger, p.danger)).toBeGreaterThanOrEqual(4.5);
}

describe('theme v2 token WCAG AA contrast', () => {
  it('ensures every light text role passes >= 4.5:1 across bg, surface, surfaceRaised, and soft surfaces', () => {
    assertPaletteContrast('light', lightColors);
  });

  it('ensures every dark text role passes >= 4.5:1 across bg, surface, surfaceRaised, and soft surfaces', () => {
    assertPaletteContrast('dark', darkColors);
  });
});
