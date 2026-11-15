import { createContext, useContext } from 'react';

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

/** Translucent card fill and rim for light and dark schemes. */
export function glassFill(scheme: 'light' | 'dark'): { fill: string; rim: string; soft: string } {
  return scheme === 'light'
    ? { fill: 'rgba(255, 255, 255, 0.62)', rim: 'rgba(255, 255, 255, 0.85)', soft: 'rgba(255, 255, 255, 0.4)' }
    : { fill: '#111113', rim: '#2A2A2F', soft: '#0D0D0F' };
}
