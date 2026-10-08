/* global jest */

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
    requestAuthorization: jest.fn(),
  },
}));

jest.mock('react-native-nitro-sqlite', () => ({
  open: jest.fn(),
}));

jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: () => null,
  Circle: () => null,
  Line: () => null,
  Polyline: () => null,
}));

jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: {createConnection: jest.fn()},
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {fs: {dirs: {CacheDir: '/tmp'}, writeFile: jest.fn().mockResolvedValue(undefined)}},
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {open: jest.fn().mockResolvedValue({success: true})},
}));

jest.mock('react-native-background-fetch', () => ({
  __esModule: true,
  default: {
    STATUS_AVAILABLE: 2,
    configure: jest.fn().mockResolvedValue(2),
    status: jest.fn().mockResolvedValue(2),
    stop: jest.fn().mockResolvedValue(true),
    finish: jest.fn(),
    registerHeadlessTask: jest.fn(),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  AndroidImportance: {DEFAULT: 3},
  AuthorizationStatus: {AUTHORIZED: 1, DENIED: 0, PROVISIONAL: 2},
  default: {
    getNotificationSettings: jest.fn().mockResolvedValue({authorizationStatus: 1}),
    requestPermission: jest.fn().mockResolvedValue({authorizationStatus: 1}),
    createChannel: jest.fn().mockResolvedValue('network-degradation'),
    displayNotification: jest.fn().mockResolvedValue('test'),
  },
}));

jest.mock('./src/native/specs/NativeCellularInfo', () => ({
  __esModule: true,
  default: {
    getCellularInfo: jest.fn().mockResolvedValue({
      available: false,
      operator: null,
      radioTechnology: null,
      generation: null,
      signalDbm: null,
      signalLevel: null,
      isRoaming: null,
      platform: 'ios',
    }),
  },
}));
