import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { getLocale, t, useLocale } from '@/i18n';
import { containsBengali, mapFontToBangla } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/ui/PressableScale';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  errorTestID?: string;
  leftIcon?: AppIconName;
  onClear?: () => void;
  pill?: boolean;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function Field({
  label,
  hint,
  error,
  errorTestID,
  leftIcon,
  onClear,
  pill = false,
  inputRef,
  value,
  placeholder,
  multiline,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: FieldProps) {
  const { theme } = useTheme();
  useLocale();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.accent
      : 'transparent';

  const useBanglaFont =
    getLocale() === 'bn' ||
    containsBengali(value ?? '') ||
    containsBengali(placeholder ?? '');

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
          ref={inputRef}
          value={value}
          placeholder={placeholder}
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
            Platform.OS === 'web'
              ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle)
              : null,
            { color: theme.colors.text },
            multiline ? { textAlignVertical: 'top', minHeight: 68 } : null,
            inputStyle,
            useBanglaFont
              ? {
                  fontFamily: mapFontToBangla(
                    theme.typography.body.fontFamily,
                    undefined,
                    theme.banglaFont
                  ),
                  letterSpacing: 0,
                }
              : null,
          ]}
          {...rest}
        />
        {onClear && value && value.length > 0 ? (
          <PressableScale
            pressScale={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('common.clear')}
            hitSlop={10}
            onPress={onClear}
            style={styles.clearBtn}
          >
            <AppIcon name="x" size={16} color={theme.colors.textSecondary} />
          </PressableScale>
        ) : null}
      </View>
      {error ? (
        <AppText testID={errorTestID} variant="caption" color="danger">
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
