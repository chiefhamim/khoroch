import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { IconTile } from '@/ui/IconTile';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';

interface BenefitItem {
  icon: string;
  colorKey: 'teal' | 'violet' | 'blue';
  title: string;
  body: string;
}

export default function OnboardingWelcomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const benefits: BenefitItem[] = [
    {
      icon: 'pie-chart',
      colorKey: 'teal',
      title: t('onboarding.benefit1Title'),
      body: t('onboarding.benefit1Body'),
    },
    {
      icon: 'shield-check',
      colorKey: 'violet',
      title: t('onboarding.benefit2Title'),
      body: t('onboarding.benefit2Body'),
    },
    {
      icon: 'trending-up',
      colorKey: 'blue',
      title: t('onboarding.benefit3Title'),
      body: t('onboarding.benefit3Body'),
    },
  ];

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.xl }}>
        <OnboardingHeader
          step={1}
          title={t('onboarding.welcomeHeadline')}
          subtitle={t('onboarding.welcomeSubtitle')}
        />

        <View style={{ gap: theme.spacing.sm }}>
          {benefits.map((item) => (
            <Surface key={item.title} style={[styles.benefitCard, { gap: theme.spacing.md }]}>
              <IconTile icon={item.icon} colorKey={item.colorKey} size="lg" />
              <View style={styles.benefitCopy}>
                <AppText variant="headline">{item.title}</AppText>
                <AppText variant="label" color="textSecondary">
                  {item.body}
                </AppText>
              </View>
            </Surface>
          ))}
        </View>
      </View>

      <View style={{ paddingTop: theme.spacing.lg }}>
        <Button
          testID="onboarding-welcome-continue"
          title={t('common.continue')}
          onPress={() => router.push('/onboarding/preferences')}
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
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
