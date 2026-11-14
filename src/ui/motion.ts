import { FadeInDown, LinearTransition } from 'react-native-reanimated';

export const ENTER_DURATION_MS = 230;
export const ENTER_STAGGER_MS = 40;
export const NUMBER_COUNT_MS = 400;

/**
 * 200-260 ms spring fade-up stagger for screen cards, 40 ms apart.
 * Returns `undefined` when reduced motion is active.
 */
export function staggerEnter(index: number, reducedMotion: boolean) {
  if (reducedMotion) return undefined;
  return FadeInDown.delay(Math.min(index, 6) * ENTER_STAGGER_MS)
    .duration(ENTER_DURATION_MS)
    .springify()
    .damping(22)
    .stiffness(260);
}

/** Smooth layout transition for dynamic list insertions and deletions. */
export function listLayoutTransition(reducedMotion: boolean) {
  if (reducedMotion) return undefined;
  return LinearTransition.springify().damping(24).stiffness(280);
}
