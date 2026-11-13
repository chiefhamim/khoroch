import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Surface } from './Surface';

export interface SettingsGroupProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SettingsGroup({
  title,
  footer,
  children,
  style,
  testID,
}: SettingsGroupProps) {
  const { theme } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View testID={testID} style={[{ gap: theme.spacing.sm }, style]}>
      {title ? (
        <AppText
          variant="caption"
          color="textSecondary"
          style={[styles.sectionTitle, { paddingHorizontal: theme.spacing.xs }]}
        >
          {title.toUpperCase()}
        </AppText>
      ) : null}
      <Surface padded={false}>
        {items.map((child, idx) => (
          <View key={idx}>
            {idx > 0 ? (
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.colors.separator,
                  marginLeft: theme.spacing.lg,
                  marginRight: theme.spacing.lg,
                }}
              />
            ) : null}
            {child}
          </View>
        ))}
      </Surface>
      {footer ? (
        <AppText
          variant="caption"
          color="textSecondary"
          style={{ paddingHorizontal: theme.spacing.xs }}
        >
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    letterSpacing: 0.7,
  },
});
