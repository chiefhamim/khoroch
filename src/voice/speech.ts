import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export type SpeechPermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface SpeechSessionHandlers {
  lang?: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

export interface SpeechSessionHandle {
  stop: () => void;
  abort: () => void;
}

type SpeechModuleType = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

function loadSpeechModule(): SpeechModuleType | null {
  // Expo Go does not include custom native binary for expo-speech-recognition.
  if (
    Platform.OS !== 'web' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule?: SpeechModuleType;
    };
    return pkg.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns true only when on-device / browser speech recognition is genuinely supported
 * in the current runtime (false in Expo Go, headless browsers without Web Speech, or Jest).
 */
export function isAvailable(): boolean {
  const mod = loadSpeechModule();
  if (!mod) return false;
  try {
    return Boolean(mod.isRecognitionAvailable());
  } catch {
    return false;
  }
}

export async function getSpeechPermissionStatus(): Promise<SpeechPermissionState> {
  const mod = loadSpeechModule();
  if (!mod) return 'unavailable';
  try {
    const res = await mod.getPermissionsAsync();
    if (res.granted) return 'granted';
    if (!res.canAskAgain) return 'denied';
    return 'undetermined';
  } catch {
    return 'unavailable';
  }
}

export async function requestSpeechPermission(): Promise<'granted' | 'denied'> {
  const mod = loadSpeechModule();
  if (!mod) return 'denied';
  try {
    const res = await mod.requestPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

function mapSpeechErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. You can type your entry instead.';
    case 'no-speech':
    case 'speech-timeout':
      return 'No speech was detected. Try speaking again or type your entry.';
    case 'network':
      return 'Speech service could not connect. You can type your entry offline anytime.';
    case 'audio-capture':
      return 'Could not access microphone input. You can type your entry instead.';
    default:
      return 'Voice input could not complete. Please type or edit your entry below.';
  }
}

export function startListening(handlers: SpeechSessionHandlers): SpeechSessionHandle | null {
  const mod = loadSpeechModule();
  if (!mod) {
    handlers.onError('Speech recognition is not available on this device.');
    return null;
  }

  const subs: { remove: () => void }[] = [];
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const sub of subs) {
      try {
        sub.remove();
      } catch {
        // Ignore cleanup errors on already-disposed listeners.
      }
    }
  };

  try {
    subs.push(
      mod.addListener('result', (event) => {
        const transcript = event.results?.[0]?.transcript ?? '';
        if (transcript.trim().length > 0 || event.isFinal) {
          handlers.onResult(transcript, Boolean(event.isFinal));
        }
      })
    );

    subs.push(
      mod.addListener('error', (event) => {
        if (event.error === 'aborted') {
          cleanup();
          return;
        }
        handlers.onError(mapSpeechErrorMessage(event.error));
        cleanup();
      })
    );

    subs.push(
      mod.addListener('end', () => {
        handlers.onEnd();
        cleanup();
      })
    );

    mod.start({
      lang: handlers.lang ?? 'en-US',
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
    });

    return {
      stop: () => {
        try {
          mod.stop();
        } catch {
          cleanup();
        }
      },
      abort: () => {
        try {
          mod.abort();
        } finally {
          cleanup();
        }
      },
    };
  } catch {
    cleanup();
    handlers.onError('Could not start speech recognition. Please type your entry instead.');
    return null;
  }
}
