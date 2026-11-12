import React from 'react';
import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

export default function OverviewTab() {
  const router = useRouter();

  return (
    <Screen scroll bottomSpacer>
      <EmptyState
        icon="wallet-outline"
        title={t('empty.overviewTitle')}
        body={t('empty.overviewBody')}
        ctaLabel={t('empty.overviewCta')}
        onCtaPress={() => router.push('/transaction/new')}
      />
    </Screen>
  );
}
