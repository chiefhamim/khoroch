import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyInsightsRedirect() {
  return <Redirect href="/plan/insights" />;
}
