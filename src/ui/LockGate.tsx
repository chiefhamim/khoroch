import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import { runDeleteAllData } from '@/data/deleteAll';
import { t } from '@/i18n';
import { appLock, isAppLockSupported } from '@/security/appLock';
import { isBiometricAvailable } from '@/security/biometrics';
import { shouldLockAfterBackground } from '@/security/pin';
import { useAppContext } from '@/state/AppContext';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { LockScreen } from './LockScreen';

/**
 * Wraps the app. While the lock is on, a full-screen Modal (above any open sheet) covers the app:
 * - at cold start and after the background timeout it shows the PIN screen;
 * - whenever the app leaves the foreground it shows a plain cover so the recent-apps preview
 *   never shows app content.
 * Children stay mounted underneath, so deep links and notification taps navigate as usual and
 * the user lands on the target after unlocking.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const { repo, settings, updateSetting, refreshSettings } = useAppContext();
  const { theme } = useTheme();
  const enabled = settings.appLockEnabled;
  const timeoutSec = settings.appLockTimeoutSec;

  const [locked, setLocked] = useState(enabled);
  const [covered, setCovered] = useState(false);
  const [checked, setChecked] = useState(!enabled);
  const [supported, setSupported] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const timeoutRef = useRef(timeoutSec);
  const lockedRef = useRef(locked);
  useEffect(() => {
    timeoutRef.current = timeoutSec;
    lockedRef.current = locked;
  });

  // Verify the lock can be enforced here. A missing native module or missing credential
  // (for example a backup imported from another phone) must never trap the user.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void (async () => {
      const ok = await isAppLockSupported();
      const hasPin = ok ? await appLock.hasCredential() : false;
      const bioPref = ok && hasPin ? await appLock.getBiometricEnabled() : false;
      const bio = bioPref ? await isBiometricAvailable() : false;
      if (!alive) return;
      setSupported(ok);
      setBiometric(bio);
      if (!ok || !hasPin) {
        setLocked(false);
        if (ok && !hasPin) void updateSetting('appLockEnabled', false);
      }
      setChecked(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !supported) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const left = backgroundedAt.current;
        backgroundedAt.current = null;
        if (left !== null && shouldLockAfterBackground(left, Date.now(), timeoutRef.current)) {
          setLocked(true);
        }
        setCovered(false);
        return;
      }
      if (!lockedRef.current && backgroundedAt.current === null) {
        backgroundedAt.current = Date.now();
      }
      setCovered(true);
    });
    return () => sub.remove();
  }, [enabled, supported]);

  const handleUnlocked = useCallback(() => {
    backgroundedAt.current = null;
    setLocked(false);
    setCovered(false);
  }, []);

  const handleEraseAll = useCallback(async () => {
    await runDeleteAllData(repo);
    await appLock.clearAll();
    await updateSetting('appLockEnabled', false);
    await refreshSettings();
    handleUnlocked();
  }, [repo, updateSetting, refreshSettings, handleUnlocked]);

  const visible = enabled && supported && (locked || covered || !checked);

  return (
    <>
      {children}
      {visible ? (
        <Modal
          visible
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => {}}
        >
          {locked && checked ? (
            <LockScreen
              biometric={biometric}
              onUnlocked={handleUnlocked}
              onEraseAll={handleEraseAll}
            />
          ) : (
            <View
              testID="lock-cover"
              style={[styles.cover, { backgroundColor: theme.colors.bg }]}
            >
              <AppText variant="headline">{t('app.name')}</AppText>
            </View>
          )}
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
