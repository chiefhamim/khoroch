import { createContext, useContext } from 'react';
import type { ResolvedColorMode } from '@/theme/tokens';

export interface GlassValue {
  /** Accent for chips and fills inside glass surfaces; null keeps the theme accent. */
  tint: string | null;
  /** When set, every Screen draws its own colour backdrop at this strength (tabs). */
  backdrop?: number;
}

/** Present when a screen sits on a colour backdrop: cards turn translucent so the colour shows through. */
export const GlassContext = createContext<GlassValue | null>(null);

export function useGlass(): GlassValue | null {
  return useContext(GlassContext);
}

/** Translucent card fill and rim for light, dark, and black modes. */
export function glassFill(mode: ResolvedColorMode): { fill: string; rim: string; soft: string } {
  if (mode === 'light') {
    return {
      fill: 'rgba(255, 255, 255, 0.62)',
      rim: 'rgba(255, 255, 255, 0.85)',
      soft: 'rgba(255, 255, 255, 0.4)',
    };
  }
  if (mode === 'black') {
    return { fill: '#0C0C0F', rim: '#24242B', soft: '#060608' };
  }
  return {
    fill: 'rgba(28, 29, 36, 0.82)',
    rim: '#323440',
    soft: 'rgba(21, 22, 27, 0.78)',
  };
}
