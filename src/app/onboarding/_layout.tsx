import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { GlassContext } from '@/ui/glass';
import { OnboardingBackdrop } from '@/ui/OnboardingBackdrop';

/** One accent for the whole flow: the theme accent. */
const ONBOARDING_GLASS = {};

export default function OnboardingLayout() {
  return (
    <GlassContext.Provider value={ONBOARDING_GLASS}>
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
