import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

interface BenefitItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

export default function OnboardingWelcomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const benefits: BenefitItem[] = [
    {
      icon: 'pie-chart-outline',
      title: t('onboarding.benefit1Title'),
      body: t('onboarding.benefit1Body'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: t('onboarding.benefit2Title'),
      body: t('onboarding.benefit2Body'),
    },
    {
      icon: 'trending-up-outline',
      title: t('onboarding.benefit3Title'),
      body: t('onboarding.benefit3Body'),
    },
  ];

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} contentContainerStyle={styles.container}>
      <View style={[styles.hero, { gap: theme.spacing.md }]}>
        <AppText variant="caption" color="primary">
          {t('onboarding.stepLabel', { step: 1, total: 6 })}
        </AppText>
        <AppText variant="display">{t('onboarding.welcomeHeadline')}</AppText>
        <AppText variant="body" color="textMuted">
          {t('onboarding.welcomeSubtitle')}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {benefits.map((item) => (
          <Card key={item.title} style={[styles.benefitCard, { gap: theme.spacing.md }]}>
            <View
              style={[
                styles.iconBadge,
                {
                  width: theme.touch.min,
                  height: theme.touch.min,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.primarySoft,
                },
              ]}
            >
              <Ionicons name={item.icon} size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.benefitCopy}>
              <AppText variant="heading">{item.title}</AppText>
              <AppText variant="caption" color="textMuted">
                {item.body}
              </AppText>
            </View>
          </Card>
        ))}
      </View>

      <View style={[styles.footer, { paddingTop: theme.spacing.md }]}>
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
  hero: {},
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitCopy: {
    flex: 1,
    gap: 2,
  },
  footer: {},
});
