import { Platform } from 'react-native';

type HapticsMod = typeof import('expo-haptics');

function getHaptics(): HapticsMod | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-haptics') as HapticsMod;
  } catch {
    return null;
  }
}

export function hapticSelection(): void {
  const h = getHaptics();
  h?.selectionAsync().catch(() => {});
}

export function hapticLight(): void {
  const h = getHaptics();
  if (!h) return;
  h.impactAsync(h.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticMedium(): void {
  const h = getHaptics();
  if (!h) return;
  h.impactAsync(h.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticSuccess(): void {
  const h = getHaptics();
  if (!h) return;
  h.notificationAsync(h.NotificationFeedbackType.Success).catch(() => {});
}
