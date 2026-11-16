import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

export interface CapturedNotification {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  postedAt: number;
}

export interface SharedPayload {
  kind: 'text' | 'image';
  value: string;
}

interface NativeFinanceCaptureInterface {
  isNotificationListenerEnabled?: () => Promise<boolean>;
  openNotificationListenerSettings?: () => Promise<boolean>;
  drainCapturedNotifications?: () => Promise<CapturedNotification[]>;
  consumePendingShare?: () => Promise<SharedPayload | null>;
  extractPdfText?: (uriString: string) => Promise<string>;
  recognizeImageText?: (uriString: string) => Promise<string>;
}

function getNativeModule(): NativeFinanceCaptureInterface | null {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules.FinanceCapture as NativeFinanceCaptureInterface | undefined;
  return mod ?? null;
}

export function isNativeCaptureSupported(): boolean {
  return getNativeModule() !== null;
}

export async function isNotificationListenerEnabled(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod?.isNotificationListenerEnabled) return false;
  try {
    return Boolean(await mod.isNotificationListenerEnabled());
  } catch {
    return false;
  }
}

export async function openNotificationListenerSettings(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod?.openNotificationListenerSettings) return false;
  try {
    return Boolean(await mod.openNotificationListenerSettings());
  } catch {
    return false;
  }
}

export async function drainCapturedNotifications(): Promise<CapturedNotification[]> {
  const mod = getNativeModule();
  if (!mod?.drainCapturedNotifications) return [];
  try {
    const list = await mod.drainCapturedNotifications();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function consumePendingShare(): Promise<SharedPayload | null> {
  const mod = getNativeModule();
  if (!mod?.consumePendingShare) return null;
  try {
    return await mod.consumePendingShare();
  } catch {
    return null;
  }
}

export async function extractPdfText(uriString: string): Promise<string> {
  const mod = getNativeModule();
  if (!mod?.extractPdfText) {
    throw new Error('pdf_native_unavailable');
  }
  return mod.extractPdfText(uriString);
}

export async function recognizeImageText(uriString: string): Promise<string> {
  const mod = getNativeModule();
  if (!mod?.recognizeImageText) {
    throw new Error('ocr_native_unavailable');
  }
  return mod.recognizeImageText(uriString);
}

export function subscribeCaptureEvents(onCapture: () => void): () => void {
  if (Platform.OS !== 'android') return () => {};
  const sub1 = DeviceEventEmitter.addListener('KhorochCaptureEvent', onCapture);
  const sub2 = DeviceEventEmitter.addListener('KhorochShareEvent', onCapture);
  return () => {
    sub1.remove();
    sub2.remove();
  };
}
