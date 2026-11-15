import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import type {
  AccentTheme,
  BanglaFontKey,
  ExpenseColorKey,
  IncomeColorKey,
  ThemePreference,
} from '@/domain/types';
import { useLocale, type Locale } from '@/i18n';
import {
  buildTheme,
  lightTheme,
  type AppTheme,
  type ResolvedColorMode,
} from './tokens';

export interface ThemeContextValue {
  theme: AppTheme;
  colorScheme: 'light' | 'dark';
  mode: ResolvedColorMode;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  accent: AccentTheme;
  setAccent: (accent: AccentTheme) => void;
  heroGradient: readonly [string, string];
  reducedMotion: boolean;
  locale: Locale;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  colorScheme: 'light',
  mode: 'light',
  preference: 'system',
  setPreference: () => {},
  accent: 'forest',
  setAccent: () => {},
  heroGradient: lightTheme.heroGradient,
  reducedMotion: false,
  locale: 'en',
});

export interface ThemeProviderProps {
  preference?: ThemePreference;
  accent?: AccentTheme;
  banglaFont?: BanglaFontKey;
  incomeColor?: IncomeColorKey;
  expenseColor?: ExpenseColorKey;
  onChangePreference?: (pref: ThemePreference) => void;
  onChangeAccent?: (accent: AccentTheme) => void;
  children: React.ReactNode;
}

export function ThemeProvider({
  preference: controlledPreference,
  accent: controlledAccent,
  banglaFont: controlledBanglaFont,
  incomeColor: controlledIncomeColor,
  expenseColor: controlledExpenseColor,
  onChangePreference,
  onChangeAccent,
  children,
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const locale = useLocale();
  const [uncontrolledPreference, setUncontrolledPreference] =
    useState<ThemePreference>('system');
  const [uncontrolledAccent, setUncontrolledAccent] =
    useState<AccentTheme>('forest');
  const [reducedMotion, setReducedMotion] = useState(false);

  const preference = controlledPreference ?? uncontrolledPreference;
  const accent = controlledAccent ?? uncontrolledAccent;

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

  const setAccent = useCallback(
    (nextAccent: AccentTheme) => {
      if (controlledAccent === undefined) {
        setUncontrolledAccent(nextAccent);
      }
      onChangeAccent?.(nextAccent);
    },
    [controlledAccent, onChangeAccent]
  );

  const mode: ResolvedColorMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colorScheme: 'light' | 'dark' = mode === 'light' ? 'light' : 'dark';

  const banglaFont = controlledBanglaFont ?? 'hind_siliguri';
  const incomeColor = controlledIncomeColor ?? 'emerald';
  const expenseColor = controlledExpenseColor ?? 'ink';

  const value = useMemo<ThemeContextValue>(() => {
    const theme = buildTheme(mode, accent, {
      banglaFont,
      incomeColor,
      expenseColor,
    });
    return {
      theme,
      colorScheme,
      mode,
      preference,
      setPreference,
      accent: theme.accent,
      setAccent,
      heroGradient: theme.heroGradient,
      reducedMotion,
      locale,
    };
  }, [
    mode,
    accent,
    banglaFont,
    incomeColor,
    expenseColor,
    colorScheme,
    preference,
    setPreference,
    setAccent,
    reducedMotion,
    locale,
  ]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
