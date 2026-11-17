import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { LockedScope } from '@/state/LockContext';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Field } from './Field';
import { PinEntryPanel } from './PinEntryPanel';
import { Sheet } from './Sheet';

export interface LockScreenProps {
  biometric: boolean;
  onUnlocked: () => void;
  /** Erases all app data on this device. Omit to hide the forgotten-PIN path. */
  onEraseAll?: () => Promise<void>;
}

/** Plain, calm lock screen: app name, PIN circles, keypad, biometric button. */
export function LockScreen({ biometric, onUnlocked, onEraseAll }: LockScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [forgotOpen, setForgotOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [erasing, setErasing] = useState(false);
  const [eraseFailed, setEraseFailed] = useState(false);

  const canErase = confirmText.trim().toUpperCase() === 'DELETE' && !erasing;

  const erase = async () => {
    if (!onEraseAll || !canErase) return;
    setErasing(true);
    setEraseFailed(false);
    try {
      await onEraseAll();
      setForgotOpen(false);
      setConfirmText('');
    } catch {
      setEraseFailed(true);
    } finally {
      setErasing(false);
    }
  };

  return (
    <View
      testID="lock-screen"
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.bg,
          paddingTop: insets.top + theme.spacing.xxl,
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
      ]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.geometry.screenMargin,
          gap: theme.spacing.xxl,
        }}
      >
        <AppText variant="headline" style={styles.centerText} accessibilityRole="header">
          {t('app.name')}
        </AppText>
        <PinEntryPanel
          title={t('lock.enterPin')}
          submitLabel={t('lock.unlock')}
          onSuccess={onUnlocked}
          biometric={biometric}
          autoBiometric={biometric}
          onForgot={onEraseAll ? () => setForgotOpen(true) : undefined}
        />
      </ScrollView>

      {onEraseAll ? (
        <LockedScope>
        <Sheet
          testID="lock-forgot-sheet"
          visible={forgotOpen}
          onClose={() => {
            if (!erasing) setForgotOpen(false);
          }}
          title={t('lock.forgotTitle')}
        >
          <AppText variant="body" color="textSecondary">
            {t('lock.forgotBody')}
          </AppText>
          <Field
            testID="lock-forgot-input"
            label={t('settings.deleteAllTypePrompt')}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={t('settings.deleteAllTypePlaceholder')}
            autoCapitalize="characters"
            error={eraseFailed ? t('settings.actionError') : null}
          />
          <Button
            testID="lock-forgot-confirm"
            title={t('lock.eraseConfirm')}
            variant="danger"
            loading={erasing}
            disabled={!canErase}
            onPress={() => void erase()}
          />
        </Sheet>
        </LockedScope>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centerText: { textAlign: 'center' },
});
