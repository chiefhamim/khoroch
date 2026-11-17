import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { t } from '@/i18n';
import { appLock as defaultLock } from '@/security/appLock';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, monotonicMs } from '@/security/pin';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { PinPad } from './PinPad';

type LockApi = Pick<
  typeof defaultLock,
  'checkPin' | 'getLockoutRemainingSec' | 'biometricUnlock'
>;

export interface PinEntryPanelProps {
  title: string;
  submitLabel: string;
  onSuccess: () => void;
  /** Offer the fingerprint or face button. */
  biometric?: boolean;
  /** Prompt for biometrics once as soon as the panel appears. */
  autoBiometric?: boolean;
  /** Called when the phone's fingerprints or face changed and biometric unlock was turned off. */
  onBiometricInvalidated?: () => void;
  onForgot?: () => void;
  lock?: LockApi;
  testID?: string;
}

const ANNOUNCE_EVERY_SEC = 10;

export function PinEntryPanel({
  title,
  submitLabel,
  onSuccess,
  biometric = false,
  autoBiometric = false,
  onBiometricInvalidated,
  onForgot,
  lock = defaultLock,
  testID = 'pin-entry',
}: PinEntryPanelProps) {
  const { theme } = useTheme();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  // The countdown runs on the monotonic clock, so changing the device clock cannot end it.
  const [waitEndsAt, setWaitEndsAt] = useState(0);
  const [tick, setTick] = useState(() => monotonicMs());
  const [bioOff, setBioOff] = useState(false);
  const successRef = useRef(onSuccess);
  const invalidatedRef = useRef(onBiometricInvalidated);
  useEffect(() => {
    successRef.current = onSuccess;
    invalidatedRef.current = onBiometricInvalidated;
  });

  const remainingSec = waitEndsAt > 0 ? Math.max(0, Math.ceil((waitEndsAt - tick) / 1000)) : 0;
  const waiting = remainingSec > 0;

  const startWait = useCallback((sec: number) => {
    const at = monotonicMs();
    setTick(at);
    setWaitEndsAt(at + sec * 1000);
  }, []);

  // A wait that started before an app restart is still running.
  useEffect(() => {
    let alive = true;
    void lock.getLockoutRemainingSec().then((sec) => {
      if (alive && sec > 0) startWait(sec);
    });
    return () => {
      alive = false;
    };
  }, [lock, startWait]);

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setTick(monotonicMs()), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  useEffect(() => {
    if (!waiting) return;
    if (remainingSec % ANNOUNCE_EVERY_SEC === 0 || remainingSec <= 3) {
      AccessibilityInfo.announceForAccessibility(
        t('lock.waitMessage', { seconds: remainingSec }),
      );
    }
  }, [waiting, remainingSec]);

  const submit = useCallback(
    async (value: string) => {
      if (busy || waiting || value.length < PIN_MIN_LENGTH) return;
      setBusy(true);
      try {
        const res = await lock.checkPin(value);
        if (res.status === 'ok') {
          successRef.current();
          return;
        }
        setPin('');
        setShakeKey((k) => k + 1);
        if (res.status === 'locked') {
          startWait(res.remainingSec);
          setErrorText(null);
          return;
        }
        if (res.status === 'wrong' && res.lockedSec > 0) {
          startWait(res.lockedSec);
          setErrorText(null);
          AccessibilityInfo.announceForAccessibility(
            t('lock.waitMessage', { seconds: res.lockedSec }),
          );
          return;
        }
        const msg =
          res.status === 'wrong'
            ? t('lock.wrongPinLeft', { count: res.attemptsLeft })
            : res.status === 'error'
              ? t('lock.storageError')
              : t('lock.wrongPin');
        setErrorText(msg);
        AccessibilityInfo.announceForAccessibility(msg);
      } finally {
        setBusy(false);
      }
    },
    [busy, waiting, lock, startWait],
  );

  const onChange = (next: string) => {
    setPin(next);
    setErrorText(null);
    if (next.length === PIN_MAX_LENGTH) void submit(next);
  };

  const tryBiometric = useCallback(async () => {
    const res = await lock.biometricUnlock(t('lock.biometricPrompt'));
    if (res === 'ok') {
      successRef.current();
    } else if (res === 'invalidated') {
      setBioOff(true);
      setErrorText(t('lock.biometricChanged'));
      invalidatedRef.current?.();
    } else if (res === 'off') {
      setBioOff(true);
    } else if (res === 'error') {
      setErrorText(t('lock.storageError'));
    }
  }, [lock]);

  const showBiometric = biometric && !bioOff;

  const autoDone = useRef(false);
  useEffect(() => {
    if (autoBiometric && showBiometric && !autoDone.current) {
      autoDone.current = true;
      void tryBiometric();
    }
  }, [autoBiometric, showBiometric, tryBiometric]);

  const message = waiting ? t('lock.waitMessage', { seconds: remainingSec }) : errorText;

  return (
    <View testID={testID} style={[styles.root, { gap: theme.spacing.xl }]}>
      <AppText variant="title" style={styles.centerText}>
        {title}
      </AppText>
      <PinPad
        testID={`${testID}-pad`}
        value={pin}
        onChange={onChange}
        disabled={busy || waiting}
        errored={Boolean(message)}
        shakeKey={shakeKey}
      />
      <View style={[styles.messageSlot, { minHeight: theme.touch.min }]}>
        {message ? (
          <View style={[styles.messageRow, { gap: theme.spacing.sm }]}>
            <AppIcon name="circle-alert" size={18} color={theme.colors.danger} />
            <AppText
              testID={`${testID}-message`}
              variant="body"
              color="danger"
              style={styles.centerText}
              accessibilityLiveRegion={waiting ? 'none' : 'polite'}
            >
              {message}
            </AppText>
          </View>
        ) : null}
      </View>
      <Button
        testID={`${testID}-submit`}
        title={submitLabel}
        onPress={() => void submit(pin)}
        disabled={busy || waiting || pin.length < PIN_MIN_LENGTH}
      />
      {showBiometric ? (
        <Button
          testID={`${testID}-biometric`}
          title={t('lock.biometricButton')}
          variant="ghost"
          onPress={() => void tryBiometric()}
        />
      ) : null}
      {onForgot ? (
        <Button
          testID={`${testID}-forgot`}
          title={t('lock.forgot')}
          variant="ghost"
          onPress={onForgot}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  centerText: { textAlign: 'center' },
  messageSlot: { alignItems: 'center', justifyContent: 'center' },
  messageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
