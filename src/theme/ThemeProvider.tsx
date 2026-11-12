import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import type { ThemePreference } from '@/domain/types';
import { darkTheme, lightTheme, type AppTheme } from './tokens';

export interface ThemeContextValue {
  theme: AppTheme;
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  reducedMotion: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  colorScheme: 'light',
  preference: 'system',
  setPreference: () => {},
  reducedMotion: false,
});

export interface ThemeProviderProps {
  preference?: ThemePreference;
  onChangePreference?: (pref: ThemePreference) => void;
  children: React.ReactNode;
}

export function ThemeProvider({
  preference: controlledPreference,
  onChangePreference,
  children,
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [uncontrolledPreference, setUncontrolledPreference] = useState<ThemePreference>('system');
  const [reducedMotion, setReducedMotion] = useState(false);

  const preference = controlledPreference ?? uncontrolledPreference;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReducedMotion(Boolean(enabled));
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReducedMotion(Boolean(enabled));
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      if (controlledPreference === undefined) {
        setUncontrolledPreference(pref);
      }
      onChangePreference?.(pref);
    },
    [controlledPreference, onChangePreference]
  );

  const colorScheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: colorScheme === 'dark' ? darkTheme : lightTheme,
      colorScheme,
      preference,
      setPreference,
      reducedMotion,
    }),
    [colorScheme, preference, setPreference, reducedMotion]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
