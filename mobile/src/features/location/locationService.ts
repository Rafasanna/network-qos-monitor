import {Platform, PermissionsAndroid} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
};

export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'TIMEOUT'
  | 'POSITION_UNAVAILABLE'
  | 'INVALID_POSITION';

export class LocationError extends Error {
  constructor(readonly code: LocationErrorCode) {
    super(code);
    this.name = 'LocationError';
  }
}

const LOCATION_TIMEOUT_MS = 15_000;
const MAX_ACCEPTABLE_ACCURACY_M = 500;

async function ensureLocationPermission(): Promise<void> {
  if (Platform.OS === 'android') {
    const permissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    const granted = Object.values(permissions).some(
      value => value === PermissionsAndroid.RESULTS.GRANTED,
    );
    if (!granted) {
      throw new LocationError('PERMISSION_DENIED');
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    Geolocation.requestAuthorization(
      () => resolve(),
      () => reject(new LocationError('PERMISSION_DENIED')),
    );
  });
}

export async function getCurrentLocation(): Promise<LocationFix> {
  await ensureLocationPermission();

  const position = await new Promise<{
    coords: {latitude: number; longitude: number; accuracy: number | null};
    timestamp: number;
  }>((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, error => {
      reject(
        new LocationError(
          error.code === 1
            ? 'PERMISSION_DENIED'
            : error.code === 3
              ? 'TIMEOUT'
              : 'POSITION_UNAVAILABLE',
        ),
      );
    }, {
      enableHighAccuracy: true,
      timeout: LOCATION_TIMEOUT_MS,
      maximumAge: 0,
    });
  });

  const {latitude, longitude, accuracy} = position.coords;
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 || longitude > 180 ||
    accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 ||
    accuracy > MAX_ACCEPTABLE_ACCURACY_M ||
    !Number.isFinite(position.timestamp)
  ) {
    throw new LocationError('INVALID_POSITION');
  }

  return {
    latitude,
    longitude,
    accuracy,
    timestamp: new Date(position.timestamp).toISOString(),
  };
}
