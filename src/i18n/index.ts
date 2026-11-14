import { useSyncExternalStore } from 'react';
import { bn } from './bn';
import { en, type TranslationKey } from './en';

export type Locale = 'en' | 'bn';

let currentLocale: Locale = 'en';
const listeners = new Set<() => void>();

function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLocale(locale: Locale): void {
  const next: Locale = locale === 'bn' ? 'bn' : 'en';
  if (next === currentLocale) return;
  currentLocale = next;
  for (const listener of listeners) {
    listener();
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
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
