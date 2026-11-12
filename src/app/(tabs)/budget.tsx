import React from 'react';
import { t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

export default function BudgetTab() {
  return (
    <Screen scroll bottomSpacer>
      <EmptyState
        icon="pie-chart-outline"
        title={t('empty.budgetTitle')}
        body={t('empty.budgetBody')}
      />
    </Screen>
  );
}
