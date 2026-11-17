/* eslint-disable @typescript-eslint/no-require-imports -- lazy require so a missing native module cannot crash startup */
import { Platform } from 'react-native';

type ScreenCaptureModule = typeof import('expo-screen-capture');

const KEY = 'khoroch-app-lock';

function load(): ScreenCaptureModule | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    return require('expo-screen-capture') as ScreenCaptureModule;
  } catch {
    return null; // build without the native module: skip, the JS cover is the fallback
  }
}

/**
 * Blocks screenshots, screen recording and the recent-apps snapshot (Android secure window flag)
 * while the app lock is on. Never throws. On React Native 0.88 the secure window flag is copied
 * onto Modal windows when they are created, so dialogs (sheets, the lock screen) opened after the
 * flag is set are covered too. Only a sheet that was already open at the moment the lock is first
 * turned on is not.
 */
export async function setScreenCaptureBlocked(blocked: boolean): Promise<void> {
  const mod = load();
  if (!mod) return;
  try {
    if (blocked) await mod.preventScreenCaptureAsync(KEY);
    else await mod.allowScreenCaptureAsync(KEY);
  } catch {
    // module missing at runtime or the call failed: nothing else to do
  }
}
