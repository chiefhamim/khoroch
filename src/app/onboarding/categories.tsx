import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/domain/categories';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { hapticSelection } from '@/ui/haptics';
import { IconTile } from '@/ui/IconTile';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';

export default function OnboardingCategoriesScreen() {
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const { selectedCategoryIds, toggleCategory } = useOnboardingDraft();

  return (
    <Screen
      style={{ backgroundColor: 'transparent' }}
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.md }}>
        <OnboardingHeader
          step={4}
          title={t('onboarding.pinCategoriesTitle')}
          subtitle={t('onboarding.pinCategoriesSub')}
        />

        <Surface padded={false}>
          {DEFAULT_EXPENSE_CATEGORIES.map((cat, idx) => {
            const selected = selectedCategoryIds.includes(cat.id);
            return (
              <React.Fragment key={cat.id}>
                {idx > 0 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.colors.separator,
                    }}
                  />
                ) : null}
                <PressableScale
                  pressScale={0.99}
                  testID={`onboarding-cat-${cat.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    hapticSelection();
                    toggleCategory(cat.id);
                  }}
                  style={({ pressed }) => [
                    styles.registerRow,
                    {
                      backgroundColor: selected
                        ? theme.colors.surface
                        : theme.colors.surface,
                      opacity: pressed && !reducedMotion ? 0.8 : 1,
                    },
                  ]}
                >
                  <IconTile
                    icon={cat.icon}
                    colorKey={cat.colorKey}
                    size={34}
                    selected={selected}
                  />
                  <View style={styles.rowMid}>
                    <AppText
                      variant="bodyStrong"
                      color={selected ? 'text' : 'textSecondary'}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: selected
                          ? theme.colors.accent
                          : 'transparent',
                        borderColor: selected
                          ? theme.colors.accent
                          : theme.colors.cardBorder,
                      },
                    ]}
                  >
                    {selected ? (
                      <AppIcon name="check" size={13} color={theme.colors.onAccent} />
                    ) : null}
                  </View>
                </PressableScale>
              </React.Fragment>
            );
          })}
        </Surface>
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
          title={t('onboarding.continueSelectedCount', {
            count: selectedCategoryIds.length,
          })}
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
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    gap: 12,
  },
  rowMid: {
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
