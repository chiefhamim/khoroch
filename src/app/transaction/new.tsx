import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';

import { isValidLocalDate, todayLocalDate } from '@/domain/dates';
import { getCurrencySymbol, parseMoneyInput } from '@/domain/money';
import type { Category, TransactionType } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

export default function NewTransactionScreen() {
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();

  const txIdRef = useRef<string>(Crypto.randomUUID());
  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>('food_dining');
  const [description, setDescription] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayLocalDate());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    repo.listCategories().then((list) => {
      if (active) setCategories(list);
    });
    return () => {
      active = false;
    };
  }, [repo]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === type),
    [categories, type]
  );

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    const firstForKind = categories.find((c) => c.kind === nextType);
    if (firstForKind) {
      setCategoryId(firstForKind.id);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setError(null);

    const parsed = parseMoneyInput(amountText);
    if (!parsed.ok) {
      if (parsed.error === 'too_large') setError(t('tx.errorTooLarge'));
      else if (parsed.error === 'too_many_decimals') setError(t('tx.errorTooManyDecimals'));
      else setError(t('tx.errorInvalidAmount'));
      return;
    }
    if (parsed.minor === null) {
      setError(t('tx.errorInvalidAmount'));
      return;
    }
    if (!isValidLocalDate(occurredOn.trim())) {
      setError(t('tx.errorInvalidDate'));
      return;
    }

    setSaving(true);
    try {
      await repo.insertTransaction({
        id: txIdRef.current,
        type,
        amountMinor: parsed.minor,
        currency: settings.currency,
        categoryId,
        description: description.trim(),
        occurredOn: occurredOn.trim(),
        source: 'manual',
      });
      bumpDataVersion();
      router.back();
    } catch {
      setError(t('tx.errorSaveFailed'));
      setSaving(false);
    }
  };

  const currencySymbol = getCurrencySymbol(settings.currency);

  return (
    <Screen scroll keyboardAvoiding edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.headerRow}>
        <AppText variant="title">{t('tx.newTitle')}</AppText>
        <Button title={t('common.close')} variant="ghost" onPress={() => router.back()} />
      </View>

      <View style={[styles.typeRow, { gap: theme.spacing.sm }]}>
        {(['expense', 'income'] as const).map((item) => {
          const active = type === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={item === 'expense' ? t('common.expense') : t('common.income')}
              accessibilityState={{ selected: active }}
              onPress={() => handleTypeChange(item)}
              style={[
                styles.typeButton,
                {
                  minHeight: theme.touch.min,
                  borderRadius: theme.radius.md,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                },
              ]}
            >
              <AppText variant="label" color={active ? 'primary' : 'text'}>
                {item === 'expense' ? t('common.expense') : t('common.income')}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" color="textMuted">
          {t('common.amount')} ({currencySymbol})
        </AppText>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder={t('tx.amountPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          accessibilityLabel={t('common.amount')}
          style={[
            theme.typography.display,
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontVariant: ['tabular-nums'],
            },
          ]}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color="textMuted">
          {t('common.category')}
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm }}
        >
          {filteredCategories.map((cat) => {
            const active = categoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                accessibilityRole="button"
                accessibilityLabel={cat.name}
                accessibilityState={{ selected: active }}
                onPress={() => setCategoryId(cat.id)}
                style={[
                  styles.chip,
                  {
                    minHeight: theme.touch.min,
                    borderRadius: theme.radius.pill,
                    paddingHorizontal: theme.spacing.lg,
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <AppText variant="label" color={active ? 'primary' : 'text'}>
                  {cat.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" color="textMuted">
          {t('common.description')}
        </AppText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('tx.descriptionPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={t('common.description')}
          style={[
            theme.typography.body,
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
            },
          ]}
        />
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" color="textMuted">
          {t('common.date')}
        </AppText>
        <TextInput
          value={occurredOn}
          onChangeText={setOccurredOn}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={t('common.date')}
          style={[
            theme.typography.body,
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
            },
          ]}
        />
      </View>

      {error ? (
        <AppText variant="label" color="danger">
          {error}
        </AppText>
      ) : null}

      <Button
        title={saving ? t('common.saving') : t('common.save')}
        onPress={handleSave}
        loading={saving}
        disabled={saving}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeRow: {
    flexDirection: 'row',
  },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
  },
  chip: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
