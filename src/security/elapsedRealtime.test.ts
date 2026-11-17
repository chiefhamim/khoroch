import { NativeModules, Platform } from 'react-native';
import { readElapsedRealtimeMs } from './elapsedRealtime';

const mutableModules = NativeModules as Record<string, unknown>;
const originalOs = Platform.OS;

function setOs(os: string) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

describe('readElapsedRealtimeMs', () => {
  afterEach(() => {
    delete mutableModules.FinanceCapture;
    setOs(originalOs);
  });

  it('returns the native value on Android', async () => {
    setOs('android');
    mutableModules.FinanceCapture = { getElapsedRealtime: async () => 123_456 };
    expect(await readElapsedRealtimeMs()).toBe(123_456);
  });

  it('returns null when the module or the method is missing', async () => {
    setOs('android');
    expect(await readElapsedRealtimeMs()).toBeNull();
    mutableModules.FinanceCapture = { drainCapturedNotifications: async () => [] };
    expect(await readElapsedRealtimeMs()).toBeNull();
  });

  it('returns null when the call fails or returns nonsense', async () => {
    setOs('android');
    mutableModules.FinanceCapture = {
      getElapsedRealtime: async () => {
        throw new Error('boom');
      },
    };
    expect(await readElapsedRealtimeMs()).toBeNull();
    mutableModules.FinanceCapture = { getElapsedRealtime: async () => Number.NaN };
    expect(await readElapsedRealtimeMs()).toBeNull();
    mutableModules.FinanceCapture = { getElapsedRealtime: async () => -5 };
    expect(await readElapsedRealtimeMs()).toBeNull();
  });

  it('returns null off Android', async () => {
    setOs('web');
    mutableModules.FinanceCapture = { getElapsedRealtime: async () => 5 };
    expect(await readElapsedRealtimeMs()).toBeNull();
  });
});
