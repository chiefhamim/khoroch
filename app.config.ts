import type { ConfigContext, ExpoConfig } from 'expo/config';

export interface AppConfigOptions {
  appVariant?: string;
  releaseSigning?: string;
}

export function buildAppConfig(
  baseConfig: Partial<ExpoConfig> = {},
  options: AppConfigOptions = {
    appVariant: process.env.APP_VARIANT,
    releaseSigning: process.env.BUDGET_RELEASE_SIGNING,
  }
): ExpoConfig {
  const isDev = options.appVariant === 'dev';
  const useNewReleaseSigning = options.releaseSigning === 'new';

  const plugins: NonNullable<ExpoConfig['plugins']> = [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: isDev ? '#16A34A' : '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-sqlite',
    'expo-notifications',
    'expo-speech-recognition',
    '@react-native-community/datetimepicker',
    'expo-sharing',
  ];

  if (useNewReleaseSigning) {
    plugins.push('./plugins/withReleaseSigning');
  }

  return {
    ...baseConfig,
    name: isDev ? 'Khoroch Dev' : 'Khoroch',
    slug: 'budget-app',
    version: '1.1.0',
    orientation: 'portrait',
    icon: isDev ? './assets/images/icon-dev.png' : './assets/images/icon.png',
    scheme: isDev ? 'budgetapp-dev' : 'budgetapp',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
      bundleIdentifier: isDev ? 'com.hamim.budgetapp.dev' : 'com.hamim.budgetapp',
    },
    android: {
      package: isDev ? 'com.hamim.budgetapp.dev' : 'com.hamim.budgetapp',
      adaptiveIcon: {
        backgroundColor: isDev ? '#DCFCE7' : '#E6F4FE',
        foregroundImage: isDev
          ? './assets/images/android-icon-foreground-dev.png'
          : './assets/images/android-icon-foreground.png',
        backgroundImage: isDev
          ? './assets/images/android-icon-background-dev.png'
          : './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      blockedPermissions: [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins,
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      ...(baseConfig.extra ?? {}),
      appVariant: isDev ? 'dev' : 'prod',
      isDev,
    },
  };
}

export default ({ config }: ConfigContext): ExpoConfig => buildAppConfig(config);
