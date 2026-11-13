import Constants from 'expo-constants';

/**
 * Returns true in Metro development sessions and in standalone APP_VARIANT=dev builds.
 * Production builds keep __DEV__ === false and extra.isDev !== true.
 */
export function isDevVariant(): boolean {
  if (__DEV__) return true;
  const extra = Constants.expoConfig?.extra as
    | { isDev?: unknown; appVariant?: unknown }
    | undefined;
  return extra?.isDev === true || extra?.appVariant === 'dev';
}
