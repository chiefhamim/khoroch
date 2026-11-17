/* eslint-disable @typescript-eslint/no-require-imports -- lazy require so a missing native module cannot crash startup */
import { Platform } from 'react-native';

type LocalAuthModule = typeof import('expo-local-authentication');

function load(): LocalAuthModule | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    return require('expo-local-authentication') as LocalAuthModule;
  } catch {
    return null;
  }
}

/** True when the device has biometric hardware with at least one enrolled fingerprint or face. */
export async function isBiometricAvailable(): Promise<boolean> {
  const mod = load();
  if (!mod) return false;
  try {
    return (await mod.hasHardwareAsync()) && (await mod.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Resolves true only on a successful biometric match. Device PIN fallback is disabled. */
export async function authenticateBiometric(
  promptMessage: string,
  cancelLabel: string,
): Promise<boolean> {
  const mod = load();
  if (!mod) return false;
  try {
    const res = await mod.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: true,
    });
    return res.success === true;
  } catch {
    return false;
  }
}
