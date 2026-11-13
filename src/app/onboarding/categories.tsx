import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/domain/categories';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { hapticSelection } from '@/ui/haptics';
import { IconTile } from '@/ui/IconTile';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { PressableScale } from '@/ui/PressableScale';

export default function OnboardingCategoriesScreen() {
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const { selectedCategoryIds, toggleCategory } = useOnboardingDraft();

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.lg }}>
        <OnboardingHeader
          step={4}
          title={t('onboarding.categoriesTitle')}
          subtitle={t('onboarding.categoriesSubtitle')}
        />

        <View style={[styles.grid, { gap: theme.spacing.sm }]}>
          {DEFAULT_EXPENSE_CATEGORIES.map((cat) => {
            const selected = selectedCategoryIds.includes(cat.id);
            return (
              <PressableScale pressScale={0.98}
                key={cat.id}
                testID={`onboarding-cat-${cat.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  hapticSelection();
                  toggleCategory(cat.id);
                }}
                style={({ pressed }) => [
                  styles.pill,
                  {
                    backgroundColor: selected
                      ? theme.colors.accentSoft
                      : theme.colors.surface,
                    borderColor: selected ? theme.colors.accent : 'transparent',
                    borderRadius: theme.radius.pill,
                    paddingLeft: 6,
                    paddingRight: theme.spacing.md,
                    paddingVertical: 6,
                    gap: theme.spacing.xs + 2,
                    opacity: pressed && !reducedMotion ? 0.78 : 1,
                  },
                ]}
              >
                <IconTile
                  icon={cat.icon}
                  colorKey={cat.colorKey}
                  size="sm"
                  selected={selected}
                />
                <AppText
                  variant="label"
                  color={selected ? 'accent' : 'text'}
                  numberOfLines={1}
                >
                  {cat.name}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={[styles.navRow, { gap: theme.spacing.sm, paddingTop: theme.spacing.lg }]}>
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
          style={styles.navBtnPrimary}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 44,
  },
  navRow: {
    flexDirection: 'row',
  },
  navBtn: {
    flex: 1,
  },
  navBtnPrimary: {
    flex: 2,
  },
});
