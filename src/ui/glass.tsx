import { createContext, useContext } from 'react';
import type { ColorPalette } from '@/theme/tokens';

export interface GlassValue {
  /** When set, every Screen draws its own colour backdrop at this strength (tabs). */
  backdrop?: number;
}

/** Present when a screen sits on a colour backdrop: cards turn translucent so the colour shows through. */
export const GlassContext = createContext<GlassValue | null>(null);

export function useGlass(): GlassValue | null {
  return useContext(GlassContext);
}

/** Translucent card fill and rim, read from the active palette. */
export function glassFill(colors: Pick<ColorPalette, 'glassFill' | 'glassRim' | 'glassSoft'>): {
  fill: string;
  rim: string;
  soft: string;
} {
  return { fill: colors.glassFill, rim: colors.glassRim, soft: colors.glassSoft };
}
