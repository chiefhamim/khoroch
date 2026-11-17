import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { t, type TranslationKey } from '@/i18n';
import { appLock, isAppLockSupported } from '@/security/appLock';
import { isBiometricAvailable } from '@/security/biometrics';
import { PIN_MIN_LENGTH, TIMEOUT_CHOICES_SEC } from '@/security/pin';
import { useAppContext } from '@/state/AppContext';
import { useLockState } from '@/state/LockContext';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { hapticLight } from './haptics';
import { PillSwitch } from './PillSwitch';
import { PinEntryPanel } from './PinEntryPanel';
import { PinPad } from './PinPad';
import { SettingsGroup } from './SettingsGroup';
import { SettingsRow } from './SettingsRow';
import { Sheet } from './Sheet';
import { useToast } from './Toast';

type Flow = 'enable' | 'change' | 'disable' | 'timeout' | 'biometric';
type Step = 'verify' | 'new' | 'confirm' | 'options';

const TIMEOUT_KEYS: Record<number, TranslationKey> = {
  0: 'lock.timeout0',
  60: 'lock.timeout60',
  300: 'lock.timeout300',
  900: 'lock.timeout900',
};

function timeoutLabel(sec: number): string {
  const key = TIMEOUT_KEYS[sec];
  return key ? t(key) : t('lock.timeout0');
}

/**
 * Settings section for the app lock. Renders nothing where secure storage is unavailable
 * (web, or a build without the native module). The lock counts as on whenever a credential
 * exists in secure storage, whatever the stored setting says.
 */
export function AppLockSettings() {
  const { settings, updateSetting } = useAppContext();
  const lockState = useLockState();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const enabled = lockState.enabled || settings.appLockEnabled;

  const [supported, setSupported] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioOn, setBioOn] = useState(false);

  const [flow, setFlow] = useState<Flow | null>(null);
  const [step, setStep] = useState<Step>('new');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [bioChoice, setBioChoice] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [timeoutOpen, setTimeoutOpen] = useState(false);

  const refreshBio = useCallback(async () => {
    const avail = await isBiometricAvailable();
    setBioAvailable(avail);
    setBioOn(avail ? await appLock.getBiometricEnabled() : false);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const ok = await isAppLockSupported();
      if (!alive) return;
      setSupported(ok);
      if (ok) await refreshBio();
    })();
    return () => {
      alive = false;
    };
  }, [refreshBio]);

  if (!supported) return null;

  /**
   * Every flow that changes the lock starts with the current PIN. The only exception is turning
   * the lock on when nothing is stored: if a credential exists, or cannot be read, the stored PIN
   * must be verified first, so a lock that looks off can never be overwritten without it.
   */
  const openFlow = async (next: Flow) => {
    hapticLight();
    setPin('');
    setFirstPin('');
    setError(null);
    setBioChoice(false);
    let first: Step = 'verify';
    if (next === 'enable') {
      const stored = await appLock.credentialState();
      if (stored === 'absent') first = 'new';
    }
    setStep(first);
    setFlow(next);
  };

  const closeFlow = () => {
    if (saving) return;
    setFlow(null);
    setPin('');
    setFirstPin('');
  };

  /** Re-reads what is really stored, whatever the steps before did. Never throws. */
  const syncState = async () => {
    try {
      await lockState.refresh();
      await refreshBio();
    } catch {
      // both readers already swallow storage errors; nothing more to do
    }
  };

  const save = async (chosenBio: boolean) => {
    if (!flow || saving) return;
    const pinToSave = firstPin;
    const startedFlow = flow;
    setSaving(true);
    setError(null);
    let bioSetUp = true;
    let done = false;
    try {
      await appLock.setPin(pinToSave);
      if (startedFlow === 'enable') {
        if (chosenBio) bioSetUp = await appLock.enableBiometric(t('lock.biometricPrompt'));
        else await appLock.disableBiometric().catch(() => {});
        await updateSetting('appLockEnabled', true);
      }
      done = true;
    } catch {
      setError(t('lock.saveError'));
      setStep('new');
    } finally {
      // The credential may already be written even when a later step failed: always show and
      // enforce what is really stored, and never keep the typed PIN around.
      setPin('');
      setFirstPin('');
      await syncState();
      setSaving(false);
    }
    if (done) {
      setFlow(null);
      showToast({
        message: t(
          startedFlow !== 'enable'
            ? 'lock.toastChanged'
            : bioSetUp
              ? 'lock.toastOn'
              : 'lock.toastOnNoBiometric',
        ),
        icon: 'circle-check',
        tone: 'accent',
      });
    }
  };

  const disable = async () => {
    let done = false;
    try {
      await appLock.clearAll(); // rejects when the credential could not be removed
      await updateSetting('appLockEnabled', false);
      done = true;
    } catch {
      setError(t('lock.saveError'));
    } finally {
      await syncState();
    }
    if (done) {
      setFlow(null);
      showToast({ message: t('lock.toastOff'), icon: 'circle-check', tone: 'accent' });
    }
  };

  /** After the PIN was verified: store a fresh secret behind a strong fingerprint or face check. */
  const enableBiometricVerified = async () => {
    let ok = false;
    try {
      ok = await appLock.enableBiometric(t('lock.biometricPrompt'));
    } finally {
      await syncState();
    }
    if (ok) setFlow(null);
    else setError(t('lock.biometricEnableFailed'));
  };

  const onNewContinue = () => {
    setFirstPin(pin);
    setPin('');
    setError(null);
    setStep('confirm');
  };

  const onConfirmContinue = () => {
    if (pin !== firstPin) {
      setError(t('lock.setupMismatch'));
      setShakeKey((k) => k + 1);
      setPin('');
      setFirstPin('');
      setStep('new');
      return;
    }
    if (flow === 'enable' && bioAvailable) {
      setStep('options');
      return;
    }
    void save(false);
  };

  const toggleBioSetting = async (next: boolean) => {
    if (next) {
      void openFlow('biometric'); // turning it on needs the PIN first, like the timeout change
      return;
    }
    await appLock.disableBiometric().catch(() => {});
    await refreshBio(); // read back what is stored instead of assuming it is off
  };

  const sheetTitle =
    flow === 'enable'
      ? t('lock.setupTitle')
      : flow === 'change'
        ? t('lock.changeTitle')
        : flow === 'timeout'
          ? t('lock.timeoutLabel')
          : flow === 'biometric'
            ? t('lock.biometricToggle')
            : t('lock.disableTitle');

  return (
    <>
      <SettingsGroup
        testID="settings-app-lock-group"
        title={t('lock.sectionTitle')}
        footer={t('lock.footer')}
      >
        <SettingsRow
          testID="settings-app-lock-row"
          label={t('lock.rowLabel')}
          subtitle={t('lock.rowSubtitle')}
          trailing={
            <PillSwitch
              testID="settings-app-lock-switch"
              accessibilityLabel={t('lock.rowLabel')}
              value={enabled}
              onValueChange={(next) => void openFlow(next ? 'enable' : 'disable')}
            />
          }
        />
        {enabled ? (
          <SettingsRow
            testID="settings-app-lock-timeout-row"
            label={t('lock.timeoutLabel')}
            value={timeoutLabel(settings.appLockTimeoutSec)}
            showChevron
            onPress={() => void openFlow('timeout')}
          />
        ) : null}
        {enabled ? (
          <SettingsRow
            testID="settings-app-lock-change-row"
            label={t('lock.changeTitle')}
            showChevron
            onPress={() => void openFlow('change')}
          />
        ) : null}
        {enabled && bioAvailable ? (
          <SettingsRow
            testID="settings-app-lock-bio-row"
            label={t('lock.biometricToggle')}
            subtitle={t('lock.biometricSubtitle')}
            trailing={
              <PillSwitch
                testID="settings-app-lock-bio-switch"
                accessibilityLabel={t('lock.biometricToggle')}
                value={bioOn}
                onValueChange={(next) => void toggleBioSetting(next)}
              />
            }
          />
        ) : null}
      </SettingsGroup>

      <Sheet
        testID="settings-app-lock-timeout-sheet"
        visible={timeoutOpen}
        onClose={() => setTimeoutOpen(false)}
        title={t('lock.timeoutLabel')}
      >
        <AppText variant="body" color="textSecondary">
          {t('lock.timeoutHint')}
        </AppText>
        <SettingsGroup>
          {TIMEOUT_CHOICES_SEC.map((sec) => {
            const selected = settings.appLockTimeoutSec === sec;
            return (
              <SettingsRow
                key={sec}
                testID={`settings-app-lock-timeout-${sec}`}
                label={timeoutLabel(sec)}
                accessibilityLabel={timeoutLabel(sec)}
                trailing={
                  selected ? (
                    <AppIcon name="check" size={20} color={theme.colors.accent} />
                  ) : undefined
                }
                onPress={() => {
                  hapticLight();
                  void updateSetting('appLockTimeoutSec', sec);
                  setTimeoutOpen(false);
                }}
              />
            );
          })}
        </SettingsGroup>
      </Sheet>

      <Sheet
        testID="settings-app-lock-sheet"
        visible={flow !== null}
        onClose={closeFlow}
        title={sheetTitle}
      >
        {flow !== null && step === 'verify' ? (
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="body" color="textSecondary" style={styles.center}>
              {t('lock.verifyBody')}
            </AppText>
            <PinEntryPanel
              testID="settings-app-lock-verify"
              title={t('lock.verifyTitle')}
              submitLabel={t('common.continue')}
              biometric={bioAvailable && bioOn}
              onBiometricInvalidated={() => setBioOn(false)}
              onSuccess={() => {
                if (flow === 'disable') {
                  void disable();
                } else if (flow === 'biometric') {
                  void enableBiometricVerified();
                } else if (flow === 'timeout') {
                  // Verified: swap the verify sheet for the timeout choices.
                  setFlow(null);
                  setTimeoutOpen(true);
                } else {
                  setPin('');
                  setStep('new');
                }
              }}
            />
            {error ? (
              <AppText variant="body" color="danger" style={styles.center}>
                {error}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {flow !== null && (step === 'new' || step === 'confirm') ? (
          <View style={{ gap: theme.spacing.lg }}>
            <AppText variant="title" style={styles.center}>
              {step === 'new' ? t('lock.setupChoose') : t('lock.setupAgain')}
            </AppText>
            <PinPad
              testID="settings-app-lock-pad"
              value={pin}
              onChange={(v) => {
                setPin(v);
                setError(null);
              }}
              shakeKey={shakeKey}
              errored={Boolean(error)}
            />
            {error ? (
              <AppText
                testID="settings-app-lock-error"
                variant="body"
                color="danger"
                style={styles.center}
                accessibilityLiveRegion="polite"
              >
                {error}
              </AppText>
            ) : null}
            <Button
              testID="settings-app-lock-continue"
              title={t('common.continue')}
              disabled={pin.length < PIN_MIN_LENGTH || saving}
              loading={saving}
              onPress={step === 'new' ? onNewContinue : onConfirmContinue}
            />
          </View>
        ) : null}

        {flow === 'enable' && step === 'options' ? (
          <View style={{ gap: theme.spacing.lg }}>
            <SettingsRow
              testID="settings-app-lock-setup-bio-row"
              label={t('lock.biometricToggle')}
              subtitle={t('lock.biometricSubtitle')}
              trailing={
                <PillSwitch
                  testID="settings-app-lock-setup-bio-switch"
                  accessibilityLabel={t('lock.biometricToggle')}
                  value={bioChoice}
                  onValueChange={setBioChoice}
                />
              }
            />
            {error ? (
              <AppText variant="body" color="danger" style={styles.center}>
                {error}
              </AppText>
            ) : null}
            <Button
              testID="settings-app-lock-turn-on"
              title={t('lock.turnOn')}
              loading={saving}
              onPress={() => void save(bioChoice)}
            />
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
