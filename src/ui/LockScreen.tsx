import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { EraseAllSheet } from './EraseAllSheet';
import { PinEntryPanel } from './PinEntryPanel';

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
        <EraseAllSheet
          visible={forgotOpen}
          onClose={() => setForgotOpen(false)}
          onEraseAll={onEraseAll}
          title={t('lock.forgotTitle')}
          body={t('lock.forgotBody')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centerText: { textAlign: 'center' },
});
