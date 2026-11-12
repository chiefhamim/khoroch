import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Category } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { ErrorState } from '@/ui/ErrorState';
import { Screen } from '@/ui/Screen';
import { TransactionForm, type TransactionFormValues } from '@/ui/TransactionForm';

export default function NewTransactionScreen() {
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();

  const txIdRef = useRef<string>(Crypto.randomUUID());
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      repo.listCategories({ includeArchived: false }),
      repo.listRecentDescriptions(8),
    ])
      .then(([cats, recents]) => {
        if (!active) return;
        setLoadError(false);
        setCategories(cats);
        setRecentDescriptions(recents);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [repo, reloadTick]);

  const handleSubmit = async (values: TransactionFormValues) => {
    await repo.insertTransaction({
      id: txIdRef.current,
      type: values.type,
      amountMinor: values.amountMinor,
      currency: settings.currency,
      categoryId: values.categoryId,
      description: values.description,
      occurredOn: values.occurredOn,
      occurredTime: values.occurredTime,
      note: values.note,
      source: 'manual',
    });
    bumpDataVersion();
    router.back();
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} keyboardAvoiding>
      <View style={[styles.header, { minHeight: theme.touch.min }]}>
        <AppText variant="title">{t('tx.newTitle')}</AppText>
        <Pressable
          testID="close-new-tx"
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => router.back()}
          style={[
            styles.closeBtn,
            {
              width: theme.touch.min,
              height: theme.touch.min,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
            },
          ]}
        >
          <Ionicons name="close" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <Pressable
        testID="new-tx-quick-entry"
        accessibilityRole="button"
        accessibilityLabel={t('quickEntry.shortcutBtn')}
        onPress={() => router.replace('/quick-entry')}
        style={[
          styles.quickBanner,
          {
            minHeight: theme.touch.min,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primarySoft,
            borderColor: theme.colors.border,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
        <AppText variant="label" color="primary" style={{ flex: 1 }}>
          {t('quickEntry.shortcutBtn')}
        </AppText>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
      </Pressable>

      <TransactionForm
        currency={settings.currency}
        categories={categories}
        recentDescriptions={recentDescriptions}
        onSubmit={handleSubmit}
      />
      {loadError ? (
        <ErrorState
          title={t('error.genericTitle')}
          body={t('categories.loadError')}
          retryLabel={t('common.retry')}
          onRetry={() => setReloadTick((v) => v + 1)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
});
