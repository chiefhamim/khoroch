import React from 'react';
import { t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

export default function SettingsTab() {
  return (
    <Screen scroll bottomSpacer>
      <EmptyState
        icon="settings-outline"
        title={t('empty.settingsTitle')}
        body={t('empty.settingsBody')}
      />
    </Screen>
  );
}
