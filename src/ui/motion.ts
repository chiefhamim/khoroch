import { Easing, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { motion } from '@/theme/tokens';

const EASE_OUT = Easing.bezier(...motion.easing.out);

export const ENTER_DURATION_MS = motion.enterMs;
export const ENTER_STAGGER_MS = motion.staggerMs;
export const NUMBER_COUNT_MS = motion.countMs;

/**
 * Ease-out fade-up for screen cards. Only the first `motion.staggerCount` cards stagger
 * (`motion.staggerMs` apart); later cards appear with no delay. Delay plus duration never
 * exceeds `motion.enterCeilingMs`. Returns `undefined` when reduced motion is active.
 */
export function staggerEnter(index: number, reducedMotion: boolean) {
  if (reducedMotion) return undefined;
  const delay = index < motion.staggerCount ? index * ENTER_STAGGER_MS : 0;
  const duration = Math.min(ENTER_DURATION_MS, motion.enterCeilingMs - delay);
  // Timing, not a spring: a spring with a duration runs about 1.5x longer than asked.
  return FadeInDown.delay(delay).duration(duration).easing(EASE_OUT);
}

/** Smooth layout transition for dynamic list insertions and deletions. */
export function listLayoutTransition(reducedMotion: boolean) {
  if (reducedMotion) return undefined;
  return LinearTransition.springify().damping(24).stiffness(280);
}
