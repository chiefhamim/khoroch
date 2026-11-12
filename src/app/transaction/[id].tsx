import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Category, Transaction } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ConfirmModal } from '@/ui/ConfirmModal';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { TransactionForm, type TransactionFormValues } from '@/ui/TransactionForm';

function formatAmountMinorForInput(amountMinor: number): string {
  const whole = Math.floor(amountMinor / 100);
  const frac = amountMinor % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const txId = typeof id === 'string' ? id : '';
    (async () => {
      try {
        const [loadedTx, allCats, recents] = await Promise.all([
          txId ? repo.getTransaction(txId) : Promise.resolve(null),
          repo.listCategories({ includeArchived: true }),
          repo.listRecentDescriptions(8),
        ]);
        if (!active) return;
        setTx(loadedTx);
        const visibleCats = allCats.filter(
          (c) => c.archivedAt === null || c.id === loadedTx?.categoryId
        );
        setCategories(visibleCats);
        setRecentDescriptions(recents);
      } catch {
        if (!active) return;
        setTx(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [repo, id]);

  const handleUpdate = async (values: TransactionFormValues) => {
    if (!tx) return;
    await repo.updateTransaction(tx.id, {
      type: values.type,
      amountMinor: values.amountMinor,
      categoryId: values.categoryId,
      description: values.description,
      occurredOn: values.occurredOn,
      occurredTime: values.occurredTime,
      note: values.note,
    });
    bumpDataVersion();
    router.back();
  };

  const handleConfirmDelete = async () => {
    if (!tx || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await repo.softDeleteTransaction(tx.id);
      setConfirmOpen(false);
      bumpDataVersion();
      router.back();
    } catch {
      setDeleteError(t('tx.errorDeleteFailed'));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <AppText variant="body" color="textMuted">
          {t('tx.detailTitle')}
        </AppText>
      </Screen>
    );
  }

  if (!tx) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <EmptyState
          icon="receipt-outline"
          title={t('tx.notFound')}
          body={t('empty.activityBody')}
          ctaLabel={t('common.back')}
          onCtaPress={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} keyboardAvoiding>
      <View style={[styles.header, { minHeight: theme.touch.min }]}>
        <Pressable
          testID="back-tx-detail"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          style={[
            styles.iconBtn,
            {
              width: theme.touch.min,
              height: theme.touch.min,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
            },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </Pressable>
        <AppText variant="title" style={styles.title}>
          {t('tx.editTitle')}
        </AppText>
        <View style={{ width: theme.touch.min }} />
      </View>

      <TransactionForm
        currency={settings.currency}
        categories={categories}
        recentDescriptions={recentDescriptions}
        initialValues={{
          type: tx.type,
          amountText: formatAmountMinorForInput(tx.amountMinor),
          categoryId: tx.categoryId,
          description: tx.description,
          occurredOn: tx.occurredOn,
          occurredTime: tx.occurredTime,
          note: tx.note ?? '',
        }}
        submitLabel={t('common.save')}
        onSubmit={handleUpdate}
      />

      {deleteError ? (
        <AppText variant="caption" color="danger">
          {deleteError}
        </AppText>
      ) : null}

      <Button
        testID="delete-tx-button"
        title={t('tx.deleteButton')}
        variant="danger"
        onPress={() => setConfirmOpen(true)}
      />

      <ConfirmModal
        visible={confirmOpen}
        title={t('tx.deleteConfirmTitle')}
        body={t('tx.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    flex: 1,
  },
});
