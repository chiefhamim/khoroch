import React from 'react';
import { AppText } from '@/ui/AppText';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { t } from '@/i18n';

export default function PeopleTabScreen() {
  return (
    <Screen scroll bottomSpacer>
      <AppText variant="title">{t('people.title')}</AppText>
      <Surface>
        <EmptyState
          icon="users"
          title={t('people.emptyTitle')}
          body={t('people.emptyBody')}
        />
      </Surface>
    </Screen>
  );
}
