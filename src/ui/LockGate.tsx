import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import { runDeleteAllData } from '@/data/deleteAll';
import { t } from '@/i18n';
import { appLock, isAppLockSupported } from '@/security/appLock';
import { isBiometricAvailable } from '@/security/biometrics';
import { monotonicMs, shouldLockAfterBackground } from '@/security/pin';
import { setScreenCaptureBlocked } from '@/security/screenCapture';
import { LockContext, type LockState } from '@/state/LockContext';
import { useAppContext } from '@/state/AppContext';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { EraseAllSheet } from './EraseAllSheet';
import { LockScreen } from './LockScreen';
import { Sheet } from './Sheet';

type Phase = 'checking' | 'error' | 'locked' | 'open';

/**
 * Wraps the app and decides, from the secure store alone, whether the lock is on.
 *
 * - Cold start: the app (and so the router's navigator) is NOT mounted until the lock check has
 *   finished and the user is unlocked. The children are rendered in one fixed place and, once
 *   mounted, are never unmounted or moved again, so there is still exactly one navigator and one
 *   navigation container (that lives above this component in expo-router).
 * - After the background timeout the app stays mounted underneath and a full-screen Modal shows
 *   the PIN screen. Sheets hide themselves while locked (see useIsLocked).
 * - Whenever the app leaves the foreground a plain cover Modal hides the content.
 * - A failed secure-store read keeps the app locked and shows Retry. After a Retry that fails
 *   again, the same typed-confirmation erase path as "forgot PIN" is offered, so a PIN that can
 *   never be read does not lock the owner out for good.
 * - The lock is switched off automatically only when a read succeeded and found no credential.
 *   If the setting said on, a one-time notice tells the owner it was turned off and why.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const { repo, settings, updateSetting, refreshSettings } = useAppContext();
  const { theme } = useTheme();

  const [phase, setPhase] = useState<Phase>('checking');
  const [everOpen, setEverOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [covered, setCovered] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [lostNotice, setLostNotice] = useState(false);

  const phaseRef = useRef(phase);
  const settingsRef = useRef(settings);
  const updateSettingRef = useRef(updateSetting);
  const backgroundedAt = useRef<{ wall: number; mono: number } | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    phaseRef.current = phase;
    settingsRef.current = settings;
    updateSettingRef.current = updateSetting;
  });
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** Re-reads the biometric preference. Called every time the app locks. */
  const refreshBiometric = useCallback(async () => {
    const pref = await appLock.getBiometricEnabled();
    const available = pref ? await isBiometricAvailable() : false;
    if (aliveRef.current) setBiometric(available);
  }, []);

  const openApp = useCallback(() => {
    setRetryFailed(false);
    setEraseOpen(false);
    setEverOpen(true);
    setPhase('open');
  }, []);

  const syncSettingOff = useCallback(() => {
    if (settingsRef.current.appLockEnabled) {
      // The setting said on but the stored PIN is gone (its Keystore key no longer exists):
      // say so once. The setting is switched off below, so the next open does not repeat it.
      setLostNotice(true);
      void updateSettingRef.current('appLockEnabled', false);
    }
  }, []);

  /** Cold start and Retry. */
  const runCheck = useCallback(async (fromRetry = false) => {
    const supported = await isAppLockSupported();
    if (!aliveRef.current) return;
    if (!supported) {
      setEnabled(false);
      openApp();
      return;
    }
    const state = await appLock.credentialState();
    if (!aliveRef.current) return;
    if (state === 'error') {
      if (fromRetry) setRetryFailed(true); // offer the erase path after a failed Retry
      setPhase('error'); // stay locked: a failed read is never "no lock"
      return;
    }
    if (state === 'absent') {
      setEnabled(false);
      syncSettingOff(); // only here: the read worked and found nothing
      openApp();
      return;
    }
    setEnabled(true);
    if (!settingsRef.current.appLockEnabled) {
      void updateSettingRef.current('appLockEnabled', true); // a credential exists, so the lock is on
    }
    setBiometric(false);
    await refreshBiometric();
    if (aliveRef.current) setPhase('locked');
  }, [openApp, refreshBiometric, syncSettingOff]);

  useEffect(() => {
    void Promise.resolve().then(() => runCheck());
  }, [runCheck]);

  /** Lock again (background timeout). Closed first, then verified. */
  const lockNow = useCallback(async () => {
    setBiometric(false);
    setPhase('locked');
    const state = await appLock.credentialState();
    if (!aliveRef.current) return;
    if (state === 'error') {
      setPhase('error');
      return;
    }
    if (state === 'absent') {
      setEnabled(false);
      syncSettingOff();
      openApp();
      return;
    }
    await refreshBiometric();
  }, [openApp, refreshBiometric, syncSettingOff]);

  const refresh = useCallback(async () => {
    const state = await appLock.credentialState();
    if (!aliveRef.current) return;
    if (state === 'present') setEnabled(true);
    else if (state === 'absent') setEnabled(false);
    // 'error': keep what we know, the lock stays on
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const left = backgroundedAt.current;
        backgroundedAt.current = null;
        const timeoutSec = settingsRef.current.appLockTimeoutSec;
        // Wall time can be moved by the user, monotonic time cannot (but pauses in deep sleep).
        // Lock when either says the timeout has passed.
        if (
          left !== null &&
          phaseRef.current === 'open' &&
          (shouldLockAfterBackground(left.wall, Date.now(), timeoutSec) ||
            shouldLockAfterBackground(left.mono, monotonicMs(), timeoutSec))
        ) {
          void lockNow();
        }
        setCovered(false);
        return;
      }
      if (phaseRef.current === 'open' && backgroundedAt.current === null) {
        backgroundedAt.current = { wall: Date.now(), mono: monotonicMs() };
      }
      setCovered(true);
    });
    return () => sub.remove();
  }, [enabled, lockNow]);

  // Block screenshots and the recents snapshot from app start while the lock is (or may be) on.
  const blockCapture =
    enabled || phase === 'error' || (phase === 'checking' && settings.appLockEnabled);
  useEffect(() => {
    void setScreenCaptureBlocked(blockCapture);
  }, [blockCapture]);

  const handleUnlocked = useCallback(() => {
    backgroundedAt.current = null;
    setCovered(false);
    openApp();
  }, [openApp]);

  const handleEraseAll = useCallback(async () => {
    await runDeleteAllData(repo);
    await appLock.clearAll(); // rejects if the credential could not be removed
    await updateSetting('appLockEnabled', false);
    await refreshSettings();
    setEnabled(false);
    handleUnlocked();
  }, [repo, updateSetting, refreshSettings, handleUnlocked]);

  const ctx = useMemo<LockState>(
    () => ({ locked: phase !== 'open', enabled, refresh }),
    [phase, enabled, refresh],
  );

  const showModal = phase === 'locked' || phase === 'error' || (everOpen && phase === 'checking') || (enabled && covered);
  const coverStyle = [styles.cover, { backgroundColor: theme.colors.bg }];

  let modalBody: React.ReactNode;
  if (phase === 'locked') {
    modalBody = (
      <LockScreen biometric={biometric} onUnlocked={handleUnlocked} onEraseAll={handleEraseAll} />
    );
  } else if (phase === 'error') {
    modalBody = (
      <View
        testID="lock-error"
        style={[
          coverStyle,
          { padding: theme.geometry.screenMargin, gap: theme.spacing.lg },
        ]}
      >
        <AppText variant="headline" accessibilityRole="header">
          {t('app.name')}
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.centerText}>
          {t('lock.storageError')}
        </AppText>
        <Button testID="lock-retry" title={t('common.retry')} onPress={() => {
            setPhase('checking');
            void runCheck(true);
          }} />
        {retryFailed ? (
          <Button
            testID="lock-storage-erase"
            title={t('lock.storageErase')}
            variant="ghost"
            onPress={() => setEraseOpen(true)}
          />
        ) : null}
        {retryFailed ? (
          <EraseAllSheet
            visible={eraseOpen}
            onClose={() => setEraseOpen(false)}
            onEraseAll={handleEraseAll}
            title={t('lock.storageEraseTitle')}
            body={t('lock.storageEraseBody')}
          />
        ) : null}
      </View>
    );
  } else {
    modalBody = (
      <View testID="lock-cover" style={coverStyle}>
        <AppText variant="headline">{t('app.name')}</AppText>
      </View>
    );
  }

  return (
    <LockContext.Provider value={ctx}>
      {everOpen ? children : null}
      {!everOpen && phase === 'checking' ? (
        <View testID="lock-checking" style={[StyleSheet.absoluteFill, coverStyle]} />
      ) : null}
      {everOpen && lostNotice ? (
        <Sheet
          testID="lock-lost-notice"
          visible
          onClose={() => setLostNotice(false)}
          title={t('lock.lostTitle')}
        >
          <AppText variant="body" color="textSecondary">
            {t('lock.lostBody')}
          </AppText>
          <Button
            testID="lock-lost-done"
            title={t('common.done')}
            onPress={() => setLostNotice(false)}
          />
        </Sheet>
      ) : null}
      {showModal ? (
        <Modal visible animationType="none" statusBarTranslucent onRequestClose={() => {}}>
          {modalBody}
        </Modal>
      ) : null}
    </LockContext.Provider>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
});
