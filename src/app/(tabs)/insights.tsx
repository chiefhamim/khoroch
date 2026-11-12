import React from 'react';
import { t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

export default function InsightsTab() {
  return (
    <Screen scroll bottomSpacer>
      <EmptyState
        icon="analytics-outline"
        title={t('empty.insightsTitle')}
        body={t('empty.insightsBody')}
      />
    </Screen>
  );
}
