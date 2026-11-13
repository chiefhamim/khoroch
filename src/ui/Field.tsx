import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  leftIcon?: AppIconName;
  onClear?: () => void;
  pill?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function Field({
  label,
  hint,
  error,
  leftIcon,
  onClear,
  pill = false,
  value,
  multiline,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: FieldProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.accent
      : 'transparent';

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label ? (
        <AppText variant="label" color="textSecondary">
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.box,
          {
            minHeight: multiline ? 88 : theme.touch.min,
            borderRadius: pill ? theme.radius.pill : theme.radius.input,
            backgroundColor: theme.colors.surfaceSunken,
            borderColor,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: multiline ? theme.spacing.sm : 0,
            gap: theme.spacing.sm,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {leftIcon ? (
          <View style={multiline ? { paddingTop: theme.spacing.xs } : null}>
            <AppIcon name={leftIcon} size={18} color={theme.colors.textTertiary} />
          </View>
        ) : null}
        <TextInput
          value={value}
          multiline={multiline}
          placeholderTextColor={theme.colors.textTertiary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            theme.typography.body,
            styles.input,
            Platform.OS === 'web' ? ({ outlineWidth: 0 } as TextStyle) : null,
            { color: theme.colors.text },
            multiline ? { textAlignVertical: 'top', minHeight: 68 } : null,
            inputStyle,
          ]}
          {...rest}
        />
        {onClear && value && value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear"
            hitSlop={10}
            onPress={onClear}
            style={styles.clearBtn}
          >
            <AppIcon name="x" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="textSecondary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
  },
  clearBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
