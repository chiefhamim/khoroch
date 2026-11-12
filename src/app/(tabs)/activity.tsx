import React from 'react';
import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

export default function ActivityTab() {
  const router = useRouter();

  return (
    <Screen scroll bottomSpacer>
      <EmptyState
        icon="receipt-outline"
        title={t('empty.activityTitle')}
        body={t('empty.activityBody')}
        ctaLabel={t('empty.activityCta')}
        onCtaPress={() => router.push('/transaction/new')}
      />
    </Screen>
  );
}
