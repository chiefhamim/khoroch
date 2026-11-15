import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

function useFloat(amp: number, ms: number, delay: number, reduced: boolean) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    v.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: ms, easing: Easing.inOut(Easing.sin) })
          ),
          -1
        )
      )
    );
  }, [v, ms, delay, reduced]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: -amp * v.get() }] }));
}

const COIN = 132;
const EDGE = 9;

/** A glossy gold taka coin floating over a colourful gradient, with two glass amount chips. */
export function CoinScene({ height = 270 }: { height?: number }) {
  const { theme, reducedMotion } = useTheme();
  const coinFloat = useFloat(8, 2200, 0, reducedMotion);
  const chipA = useFloat(6, 1900, 300, reducedMotion);
  const chipB = useFloat(6, 2500, 700, reducedMotion);

  return (
    <View
      style={[
        styles.card,
        theme.elevation.e3,
        { height, borderRadius: theme.radius.heroCard + 4 },
      ]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="cs-bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#4338CA" />
            <Stop offset="55%" stopColor="#0F766E" />
            <Stop offset="100%" stopColor="#047857" />
          </LinearGradient>
          <RadialGradient id="cs-glow" cx="50%" cy="46%" r="50%">
            <Stop offset="0%" stopColor="#FDE68A" stopOpacity={0.55} />
            <Stop offset="60%" stopColor="#F59E0B" stopOpacity={0.12} />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="cs-orb1" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#A5B4FC" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#A5B4FC" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="cs-orb2" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#5EEAD4" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#5EEAD4" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="cs-sheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.22} />
            <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cs-bg)" />
        <Circle cx="88%" cy="10%" r="120" fill="url(#cs-orb1)" />
        <Circle cx="6%" cy="96%" r="130" fill="url(#cs-orb2)" />
        <Circle cx="50%" cy="46%" r="150" fill="url(#cs-glow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cs-sheen)" />
      </Svg>

      {/* Coin */}
      <Animated.View style={[styles.center, coinFloat]}>
        <Svg width={COIN + 40} height={COIN + EDGE + 56}>
          <Defs>
            <RadialGradient id="coin-face" cx="34%" cy="28%" r="80%">
              <Stop offset="0%" stopColor="#FEF3C7" />
              <Stop offset="38%" stopColor="#FBBF24" />
              <Stop offset="100%" stopColor="#B45309" />
            </RadialGradient>
            <LinearGradient id="coin-edge" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#D97706" />
              <Stop offset="100%" stopColor="#78350F" />
            </LinearGradient>
            <RadialGradient id="coin-shadow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#022C22" stopOpacity={0.55} />
              <Stop offset="100%" stopColor="#022C22" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="coin-hi" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.8} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={(COIN + 40) / 2} cy={COIN + EDGE + 38} rx={COIN * 0.46} ry={9} fill="url(#coin-shadow)" />
          <Circle cx={(COIN + 40) / 2} cy={20 + COIN / 2 + EDGE} r={COIN / 2} fill="url(#coin-edge)" />
          <Circle cx={(COIN + 40) / 2} cy={20 + COIN / 2} r={COIN / 2} fill="url(#coin-face)" />
          <Circle
            cx={(COIN + 40) / 2}
            cy={20 + COIN / 2}
            r={COIN / 2 - 10}
            fill="none"
            stroke="#92400E"
            strokeOpacity={0.45}
            strokeWidth={2}
          />
          <Circle
            cx={(COIN + 40) / 2}
            cy={20 + COIN / 2}
            r={COIN / 2 - 13}
            fill="none"
            stroke="#FFFBEB"
            strokeOpacity={0.55}
            strokeWidth={1}
          />
          <Ellipse
            cx={(COIN + 40) / 2 - 26}
            cy={20 + 28}
            rx={30}
            ry={16}
            fill="url(#coin-hi)"
            transform={`rotate(-28 ${(COIN + 40) / 2 - 26} ${20 + 28})`}
          />
        </Svg>
        <View style={styles.glyph} pointerEvents="none">
          <AppText
            style={{
              fontFamily: 'HindSiliguri_600SemiBold',
              fontSize: 62,
              lineHeight: 74,
              color: '#7C2D12',
              includeFontPadding: false,
              textShadowColor: 'rgba(255, 251, 235, 0.7)',
              textShadowOffset: { width: 0, height: 1.5 },
              textShadowRadius: 1,
            }}
          >
            {'৳'}
          </AppText>
        </View>
      </Animated.View>

      {/* Glass chips */}
      <Animated.View style={[styles.chip, styles.chipIn, chipA]}>
        <View style={[styles.dot, { backgroundColor: '#34D399' }]} />
        <AppText variant="label" style={styles.chipText}>
          {'+৳ 500'}
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.chip, styles.chipOut, chipB]}>
        <View style={[styles.dot, { backgroundColor: '#FB7185' }]} />
        <AppText variant="label" style={styles.chipText}>
          {'−৳ 120'}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    position: 'absolute',
    top: 20 + COIN / 2 - 37,
    alignItems: 'center',
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.38)',
  },
  chipIn: { left: 18, top: 34 },
  chipOut: { right: 18, bottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_700Bold',
  },
});
