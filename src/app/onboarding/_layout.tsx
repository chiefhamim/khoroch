import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { GlassContext } from '@/ui/glass';
import { OnboardingBackdrop } from '@/ui/OnboardingBackdrop';

/** Deep colour per step, matching the header tile and the Continue button. */
const STEP_TINT: Record<string, string> = {
  preferences: '#0369A1',
  budget: '#047857',
  categories: '#B45309',
  reminder: '#BE185D',
  wallets: '#0F766E',
  done: '#15803D',
};

export default function OnboardingLayout() {
  const path = usePathname();
  const last = path.split('/').filter(Boolean).pop() ?? '';
  const value = useMemo(() => ({ tint: STEP_TINT[last] ?? '#4338CA' }), [last]);
  return (
    <GlassContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        <OnboardingBackdrop />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </View>
    </GlassContext.Provider>
  );
}
