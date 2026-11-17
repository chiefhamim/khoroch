/* eslint-disable @typescript-eslint/no-require-imports -- lazy require so a missing native module cannot crash startup */
import { Platform } from 'react-native';

type SecureStoreModule = typeof import('expo-secure-store');
type LocalAuthModule = typeof import('expo-local-authentication');

function loadSecureStore(): SecureStoreModule | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    return require('expo-secure-store') as SecureStoreModule;
  } catch {
    return null;
  }
}

function loadLocalAuth(): LocalAuthModule | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    return require('expo-local-authentication') as LocalAuthModule;
  } catch {
    return null;
  }
}

/**
 * True when this phone has a strong (Android Class 3) fingerprint or face enrolled, which is what
 * the biometric-protected secret in secure storage needs. The unlock itself is done by reading
 * that secret (see appLock.biometricUnlock), never by trusting a yes/no prompt result.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const store = loadSecureStore();
  try {
    if (store && typeof store.canUseBiometricAuthentication === 'function') {
      return Boolean(store.canUseBiometricAuthentication());
    }
  } catch {
    return false;
  }
  const mod = loadLocalAuth();
  if (!mod) return false;
  try {
    if (!(await mod.hasHardwareAsync())) return false;
    return (await mod.getEnrolledLevelAsync()) >= mod.SecurityLevel.BIOMETRIC_STRONG;
  } catch {
    return false;
  }
}
