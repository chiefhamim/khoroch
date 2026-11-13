describe('speech recognition S10 on-device hardening', () => {
  function setupSpeechMocks(onDeviceSupported: boolean) {
    const startMock = jest.fn();
    const stopMock = jest.fn();
    const abortMock = jest.fn();
    const addListenerMock = jest.fn(() => ({ remove: jest.fn() }));
    const supportsOnDeviceMock = jest.fn(() => onDeviceSupported);

    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment: 'bare' },
      ExecutionEnvironment: { StoreClient: 'storeClient' },
    }));
    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: jest.fn(() => ({})),
    }));
    jest.doMock('expo-speech-recognition', () => ({
      ExpoSpeechRecognitionModule: {
        supportsOnDeviceRecognition: supportsOnDeviceMock,
        start: startMock,
        stop: stopMock,
        abort: abortMock,
        addListener: addListenerMock,
      },
    }));

    return { startMock, supportsOnDeviceMock };
  }

  afterEach(() => {
    jest.dontMock('react-native');
    jest.dontMock('expo-constants');
    jest.dontMock('expo-modules-core');
    jest.dontMock('expo-speech-recognition');
    jest.resetModules();
  });

  it('passes requiresOnDeviceRecognition: true when on-device recognition is supported', () => {
    const { startMock } = setupSpeechMocks(true);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const speech = require('./speech') as typeof import('./speech');

    expect(speech.supportsOnDeviceRecognition()).toBe(true);
    const session = speech.startListening({
      onResult: jest.fn(),
      onError: jest.fn(),
      onEnd: jest.fn(),
    });
    expect(session).not.toBeNull();
    expect(startMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requiresOnDeviceRecognition: true,
      })
    );
  });

  it('omits requiresOnDeviceRecognition when on-device recognition is not supported', () => {
    const { startMock } = setupSpeechMocks(false);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const speech = require('./speech') as typeof import('./speech');

    expect(speech.supportsOnDeviceRecognition()).toBe(false);
    const session = speech.startListening({
      onResult: jest.fn(),
      onError: jest.fn(),
      onEnd: jest.fn(),
    });
    expect(session).not.toBeNull();
    const arg = startMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty('requiresOnDeviceRecognition');
  });
});
