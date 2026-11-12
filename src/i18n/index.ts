import { bn } from './bn';
import { en, type TranslationKey } from './en';

export type Locale = 'en' | 'bn';

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = currentLocale === 'bn' ? bn : en;
  let template: string = dict[key] ?? en[key] ?? key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }
  }
  return template;
}

export type { TranslationKey };
