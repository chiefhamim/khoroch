import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Surface, type SurfaceVariant } from './Surface';

export interface CardProps {
  children: React.ReactNode;
  tone?: 'surface' | 'alt' | 'soft';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** @deprecated Compatibility wrapper over `Surface`; prefer `Surface` in v1.1 screens. */
export function Card({ children, tone = 'surface', padded = true, style, testID }: CardProps) {
  const variant: SurfaceVariant =
    tone === 'alt' ? 'sunken' : tone === 'soft' ? 'soft' : 'card';

  return (
    <Surface testID={testID} variant={variant} padded={padded} style={style}>
      {children}
    </Surface>
  );
}
