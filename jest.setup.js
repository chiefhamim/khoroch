// Reanimated/worklets need the native UI thread. Jest gets a small synchronous stand-in
// covering the API the app uses (animations resolve to their final value immediately).
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const identity = (v) => v;
  const builder = () => {
    const b = {};
    ['duration', 'delay', 'springify', 'damping', 'stiffness', 'mass', 'easing', 'withInitialValues'].forEach(
      (k) => (b[k] = () => b)
    );
    return b;
  };
  const Animated = {
    View: RN.View,
    Text: RN.Text,
    ScrollView: RN.ScrollView,
    FlatList: RN.FlatList,
    createAnimatedComponent: identity,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (v) => {
      const sv = { value: v };
      sv.get = () => sv.value;
      sv.set = (n) => {
        sv.value = typeof n === 'function' ? n(sv.value) : n;
      };
      return sv;
    },
    useAnimatedStyle: (fn) => fn(),
    useDerivedValue: (fn) => ({ value: fn() }),
    useAnimatedReaction: () => {},
    isSharedValue: (v) => !!v && typeof v === 'object' && typeof v.get === 'function' && 'value' in v,
    useEvent: () => () => {},
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
    makeMutable: (v) => ({ value: v, get: () => v, set: () => {} }),
    withSpring: (v, _cfg, cb) => {
      if (cb) cb(true);
      return v;
    },
    withTiming: (v, _cfg, cb) => {
      if (cb) cb(true);
      return v;
    },
    withDelay: (_d, v) => v,
    withSequence: (...v) => v[v.length - 1],
    interpolate: (x, input, output) => output[0] + ((x - input[0]) / (input[1] - input[0] || 1)) * (output[1] - output[0]),
    interpolateColor: (_x, _i, output) => output[0],
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: { out: identity, in: identity, inOut: identity, cubic: identity, quad: identity, bezier: () => identity },
    runOnJS: (fn) => fn,
    scheduleOnRN: (fn, ...args) => fn(...args),
    cancelAnimation: () => {},
    useReducedMotion: () => false,
    FadeIn: builder(),
    FadeOut: builder(),
    FadeInDown: builder(),
    LinearTransition: builder(),
  };
});

// Gesture Handler ships its own Jest mocks for the native module.
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  const { ScrollView, View } = require('react-native');
  return {
    KeyboardProvider: ({ children }) => React.createElement(View, null, children),
    KeyboardAwareScrollView: ScrollView,
  };
});
