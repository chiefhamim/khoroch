import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

export interface InfoModalProps {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}

export function InfoModal({ visible, title, body, onClose }: InfoModalProps) {
  const { theme } = useTheme();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          { padding: theme.spacing.xl, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        ]}
      >
        <Card style={[styles.dialog, { gap: theme.spacing.md }]}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="body" color="textMuted">
            {body}
          </AppText>
          <Button title={t('overview.gotIt')} onPress={onClose} />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
  },
});
