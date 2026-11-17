import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TAKA_FONT_FAMILY } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Money } from './Money';

/** Illustration sizes; decorative only, so they live here rather than in the global scale. */
const COIN = 120;
const COIN_RING_INSET = 8;
const DOT = 8;
/** Sample amounts for the illustration, in integer minor units (poisha). */
const SAMPLE_INCOME_MINOR = 50_000;
const SAMPLE_EXPENSE_MINOR = 12_000;

/** A calm flat illustration: an accent taka coin on a soft card with two plain amount pills. */
export function CoinScene({ height = 270 }: { height?: number }) {
  const { theme } = useTheme();
  const { colors, spacing, radius, geometry } = theme;

  return (
    <View
      style={[
        styles.card,
        theme.elevation.e1,
        {
          height,
          borderRadius: radius.heroCard,
          backgroundColor: colors.accentSoft,
          borderColor: colors.cardBorder,
        },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.coin, { backgroundColor: colors.accent }]}>
        <View
          style={[
            styles.coinRing,
            { borderColor: colors.onAccent, top: COIN_RING_INSET, left: COIN_RING_INSET },
          ]}
        />
        <AppText
          variant="display"
          style={[styles.glyph, { color: colors.onAccent, fontFamily: TAKA_FONT_FAMILY }]}
        >
          {'৳'}
        </AppText>
      </View>

      <View
        style={[
          styles.chip,
          {
            left: spacing.lg,
            top: spacing.xxxl,
            minHeight: geometry.chipVisualHeight,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: colors.income }]} />
        <Money
          amountMinor={SAMPLE_INCOME_MINOR}
          currency="BDT"
          variant="label"
          prefix="+"
          animate={false}
          hidden={false}
        />
      </View>
      <View
        style={[
          styles.chip,
          {
            right: spacing.lg,
            bottom: spacing.xxxl,
            minHeight: geometry.chipVisualHeight,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: colors.expense }]} />
        <Money
          amountMinor={SAMPLE_EXPENSE_MINOR}
          currency="BDT"
          variant="label"
          prefix="-"
          animate={false}
          hidden={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  coin: {
    width: COIN,
    height: COIN,
    borderRadius: COIN / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinRing: {
    position: 'absolute',
    width: COIN - COIN_RING_INSET * 2,
    height: COIN - COIN_RING_INSET * 2,
    borderRadius: (COIN - COIN_RING_INSET * 2) / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  glyph: {
    includeFontPadding: false,
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
