import type {CellularGeneration, ConnectionType} from '../../types/network';
import type {StoredMeasurement} from '../../storage/measurementRepository';

export type GeoCenter = {id: string; latitude: number; longitude: number};
export type HistoryFilters = {
  connectionType: ConnectionType | null;
  cellularGeneration: CellularGeneration | null;
  fromDate: string | null;
  toDate: string | null;
  geoCenter: GeoCenter | null;
  radiusMeters: number;
};

export const GEO_RADII_METERS = [500, 1000, 5000, 10000] as const;

export const EMPTY_HISTORY_FILTERS: HistoryFilters = {
  connectionType: null,
  cellularGeneration: null,
  fromDate: null,
  toDate: null,
  geoCenter: null,
  radiusMeters: 1000,
};

const EARTH_RADIUS_METERS = 6_371_000;
const radians = (degrees: number): number => degrees * Math.PI / 180;

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function filterByGeographicRadius<T extends Pick<StoredMeasurement, 'latitude' | 'longitude'>>(
  items: T[], center: GeoCenter | null, radiusMeters: number,
): T[] {
  if (!center) {
    return items;
  }
  return items.filter(item =>
    distanceMeters(center.latitude, center.longitude, item.latitude, item.longitude) <= radiusMeters,
  );
}

export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Date inputs are interpreted as UTC calendar days, with an exclusive upper bound. */
export function utcDateBounds(fromDate: string | null, toDate: string | null): {
  startedAtFrom: string | null;
  startedAtBefore: string | null;
} {
  const upper = toDate && isValidDateInput(toDate)
    ? new Date(Date.parse(`${toDate}T00:00:00.000Z`) + 86_400_000).toISOString()
    : null;
  return {
    startedAtFrom: fromDate && isValidDateInput(fromDate) ? `${fromDate}T00:00:00.000Z` : null,
    startedAtBefore: upper,
  };
}

export function hasActiveFilters(filters: HistoryFilters): boolean {
  return Boolean(filters.connectionType || filters.cellularGeneration || filters.fromDate ||
    filters.toDate || filters.geoCenter);
}
