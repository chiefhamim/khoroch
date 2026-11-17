import { NativeModules, Platform } from 'react-native';

interface ElapsedModule {
  getElapsedRealtime?: () => Promise<number>;
}

/**
 * Android SystemClock.elapsedRealtime in milliseconds: counts deep sleep, cannot be changed by
 * the user, restarts only on reboot. Returns null when the native method is not there (web, iOS,
 * or an app build made before the method existed) or the call fails. Never throws.
 */
export async function readElapsedRealtimeMs(): Promise<number | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const mod = NativeModules.FinanceCapture as ElapsedModule | undefined;
    if (!mod || typeof mod.getElapsedRealtime !== 'function') return null;
    const value = await mod.getElapsedRealtime();
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}
