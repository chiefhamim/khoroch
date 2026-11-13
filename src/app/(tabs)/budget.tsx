import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyBudgetRedirect() {
  return <Redirect href="/(tabs)/plan" />;
}
