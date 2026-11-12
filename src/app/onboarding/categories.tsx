import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/domain/categories';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { resolveIoniconName } from '@/ui/CategoryIcon';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';

export default function OnboardingCategoriesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { selectedCategoryIds, toggleCategory } = useOnboardingDraft();

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="caption" color="primary">
          {t('onboarding.stepLabel', { step: 4, total: 6 })}
        </AppText>
        <AppText variant="title">{t('onboarding.categoriesTitle')}</AppText>
        <AppText variant="body" color="textMuted">
          {t('onboarding.categoriesSubtitle')}
        </AppText>
      </View>

      <View style={[styles.grid, { gap: theme.spacing.sm }]}>
        {DEFAULT_EXPENSE_CATEGORIES.map((cat) => {
          const selected = selectedCategoryIds.includes(cat.id);
          return (
            <Chip
              key={cat.id}
              testID={`onboarding-cat-${cat.id}`}
              label={cat.name}
              icon={resolveIoniconName(cat.icon)}
              selected={selected}
              onPress={() => toggleCategory(cat.id)}
            />
          );
        })}
      </View>

      <View style={[styles.navRow, { gap: theme.spacing.md, paddingTop: theme.spacing.md }]}>
        <Button
          title={t('common.back')}
          variant="secondary"
          onPress={() => router.back()}
          style={styles.navBtn}
        />
        <Button
          testID="onboarding-categories-continue"
          title={t('common.continue')}
          onPress={() => router.push('/onboarding/reminder')}
          style={styles.navBtn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  navRow: {
    flexDirection: 'row',
  },
  navBtn: {
    flex: 1,
  },
});
