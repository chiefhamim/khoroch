import React, { useState } from 'react';
import { isErasedThenFailed } from '@/data/eraseError';
import { t } from '@/i18n';
import { LockedScope } from '@/state/LockContext';
import { AppText } from './AppText';
import { Button } from './Button';
import { Field } from './Field';
import { Sheet } from './Sheet';

export interface EraseAllSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Erases all app data on this device. Rejects when it could not finish. */
  onEraseAll: () => Promise<void>;
  title: string;
  body: string;
}

/**
 * Typed-confirmation erase path shown above the lock (forgotten PIN, or a PIN that can never be
 * read). Enabled only after the word DELETE is typed.
 */
export function EraseAllSheet({ visible, onClose, onEraseAll, title, body }: EraseAllSheetProps) {
  const [confirmText, setConfirmText] = useState('');
  const [erasing, setErasing] = useState(false);
  const [eraseFailed, setEraseFailed] = useState<'none' | 'generic' | 'erased'>('none');

  const canErase = confirmText.trim().toUpperCase() === 'DELETE' && !erasing;

  const erase = async () => {
    if (!canErase) return;
    setErasing(true);
    setEraseFailed('none');
    try {
      await onEraseAll();
      onClose();
      setConfirmText('');
    } catch (e) {
      // Data already wiped but the lock cleanup failed: say so, and point at the Try again button.
      setEraseFailed(isErasedThenFailed(e) ? 'erased' : 'generic');
    } finally {
      setErasing(false);
    }
  };

  return (
    <LockedScope>
      <Sheet
        testID="lock-forgot-sheet"
        visible={visible}
        onClose={() => {
          if (!erasing) onClose();
        }}
        title={title}
      >
        <AppText variant="body" color="textSecondary">
          {body}
        </AppText>
        <Field
          testID="lock-forgot-input"
          label={t('settings.deleteAllTypePrompt')}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={t('settings.deleteAllTypePlaceholder')}
          autoCapitalize="characters"
          error={
            eraseFailed === 'erased'
              ? t('lock.erasePartial')
              : eraseFailed === 'generic'
                ? t('settings.actionError')
                : null
          }
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
  );
}
