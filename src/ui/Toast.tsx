import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/ui/PressableScale';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

export interface ToastOptions {
  message: string;
  icon?: AppIconName;
  tone?: 'default' | 'accent' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ActiveToast extends ToastOptions {
  id: number;
}

export interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  hideToast: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export interface ToastViewProps {
  message: string;
  icon?: AppIconName;
  tone?: 'default' | 'accent' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  testID?: string;
}

export function ToastView({
  message,
  icon = 'circle-check',
  tone = 'accent',
  actionLabel,
  onAction,
  onDismiss,
  testID,
}: ToastViewProps) {
  const { theme } = useTheme();
  const isDarkSurface = theme.scheme === 'light';
  const bg = isDarkSurface ? '#151518' : theme.colors.surfaceRaised;
  const fg = isDarkSurface ? '#F4F4F5' : theme.colors.text;
  const iconColor =
    tone === 'danger'
      ? isDarkSurface
        ? '#F87171'
        : theme.colors.danger
      : tone === 'accent'
        ? '#34D399'
        : fg;

  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        theme.elevation.e3,
        {
          backgroundColor: bg,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <AppIcon name={icon} size={18} color={iconColor} />
      <AppText variant="label" style={[styles.msg, { color: fg }]} numberOfLines={2}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <PressableScale
          pressScale={0.94}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          onPress={() => {
            onAction();
            onDismiss?.();
          }}
          style={styles.actionBtn}
        >
          <AppText variant="label" style={{ color: '#34D399' }}>
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { reducedMotion } = useTheme();
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const id = Date.now();
    setToast({ ...options, id });
    timerRef.current = setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, options.durationMs ?? 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(180).springify()}
          exiting={reducedMotion ? undefined : FadeOutDown.duration(150)}
          pointerEvents="box-none"
          style={[styles.overlay, { bottom: Math.max(insets.bottom, 16) + 72 }]}
        >
          <ToastView
            message={toast.message}
            icon={toast.icon}
            tone={toast.tone}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
            onDismiss={hideToast}
          />
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 420,
  },
  msg: {
    flexShrink: 1,
  },
  actionBtn: {
    paddingLeft: 8,
    minHeight: 32,
    justifyContent: 'center',
  },
});
