import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyActivityRedirect() {
  return <Redirect href="/(tabs)/ledger" />;
}
