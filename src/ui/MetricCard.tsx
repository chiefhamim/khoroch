import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CurrencyCode } from '@/domain/types';
import type { ColorPalette } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Card } from './Card';
import { Money } from './Money';

export interface MetricCardProps {
  label: string;
  amountMinor: number | null;
  currency: CurrencyCode;
  fallbackText?: string;
  valueColor?: keyof ColorPalette;
  onInfoPress: () => void;
  infoAccessibilityLabel?: string;
  testID?: string;
}

export function MetricCard({
  label,
  amountMinor,
  currency,
  fallbackText = '—',
  valueColor = 'text',
  onInfoPress,
  infoAccessibilityLabel,
  testID,
}: MetricCardProps) {
  const { theme, reducedMotion } = useTheme();

  return (
    <Card style={[styles.card, { gap: theme.spacing.sm }]}>
      <View style={styles.topRow}>
        <AppText variant="label" color="textMuted" style={styles.label} numberOfLines={2}>
          {label}
        </AppText>
        <Pressable
          testID={testID ? `${testID}-info` : undefined}
          accessibilityRole="button"
          accessibilityLabel={infoAccessibilityLabel ?? `About ${label}`}
          onPress={onInfoPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.infoBtn,
            {
              width: theme.touch.min - theme.spacing.md,
              height: theme.touch.min - theme.spacing.md,
              borderRadius: theme.radius.pill,
              opacity: pressed && !reducedMotion ? 0.65 : 1,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {amountMinor !== null ? (
        <Money
          amountMinor={amountMinor}
          currency={currency}
          variant="heading"
          color={valueColor}
          numberOfLines={1}
        />
      ) : (
        <AppText variant="heading" color="textMuted" tabularNums>
          {fallbackText}
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  label: {
    flex: 1,
  },
  infoBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    marginRight: -6,
  },
});
