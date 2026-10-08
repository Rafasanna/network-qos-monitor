const mockGetCurrentPosition = jest.fn();
const mockRequestAuthorization = jest.fn();

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: (...args: unknown[]) => mockGetCurrentPosition(...args),
    requestAuthorization: (...args: unknown[]) => mockRequestAuthorization(...args),
  },
}));

import {getCurrentLocation, LocationError} from '../locationService';

describe('getCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestAuthorization.mockImplementation((success: () => void) => success());
    mockGetCurrentPosition.mockImplementation((success: (value: unknown) => void) => {
      success({
        coords: {latitude: -34.6, longitude: -58.4, accuracy: 12},
        timestamp: 1_800_000_000_000,
      });
    });
  });

  it('returns a current fix in normalized units', async () => {
    await expect(getCurrentLocation()).resolves.toEqual({
      latitude: -34.6,
      longitude: -58.4,
      accuracy: 12,
      timestamp: new Date(1_800_000_000_000).toISOString(),
    });
    expect(mockGetCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });

  it('normalizes permission denial', async () => {
    mockRequestAuthorization.mockImplementation((_success: () => void, error: () => void) => error());
    await expect(getCurrentLocation()).rejects.toMatchObject({code: 'PERMISSION_DENIED'});
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('normalizes timeout', async () => {
    mockGetCurrentPosition.mockImplementation((_success: unknown, error: (value: {code: number}) => void) => error({code: 3}));
    await expect(getCurrentLocation()).rejects.toMatchObject({code: 'TIMEOUT'});
  });

  it('rejects invalid or too imprecise coordinates', async () => {
    mockGetCurrentPosition.mockImplementation((success: (value: unknown) => void) => {
      success({coords: {latitude: 91, longitude: 0, accuracy: 10}, timestamp: 0});
    });
    await expect(getCurrentLocation()).rejects.toBeInstanceOf(LocationError);
    mockGetCurrentPosition.mockImplementation((success: (value: unknown) => void) => {
      success({coords: {latitude: 0, longitude: 0, accuracy: 700}, timestamp: 0});
    });
    await expect(getCurrentLocation()).rejects.toMatchObject({code: 'INVALID_POSITION'});
  });
});
