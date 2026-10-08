import {distanceMeters, filterByGeographicRadius, hasActiveFilters, isValidDateInput, utcDateBounds, EMPTY_HISTORY_FILTERS} from '../historyFilters';

const center = {id: 'a', latitude: -31.4201, longitude: -64.1888};
const places = [
  {id: 'a', latitude: -31.4201, longitude: -64.1888},
  {id: 'b', latitude: -31.425, longitude: -64.1888},
  {id: 'c', latitude: -31.5, longitude: -64.1888},
];

describe('history filters', () => {
  it('calculates Haversine meters and zero distance', () => {
    expect(distanceMeters(-31.4201, -64.1888, -31.4201, -64.1888)).toBe(0);
    expect(distanceMeters(0, 0, 0, 1)).toBeCloseTo(111_195, -2);
    expect(distanceMeters(0, 0, 0, 1)).toBeCloseTo(distanceMeters(0, 1, 0, 0));
  });
  it('returns all without center, nearby with radius, and zero when no match', () => {
    expect(filterByGeographicRadius(places, null, 500)).toHaveLength(3);
    expect(filterByGeographicRadius(places, center, 1000).map(p => p.id)).toEqual(['a', 'b']);
    expect(filterByGeographicRadius(places, {...center, latitude: 0}, 500)).toEqual([]);
  });
  it('validates UTC date inputs and inclusive final day', () => {
    expect(isValidDateInput('2026-02-29')).toBe(false);
    expect(isValidDateInput('2024-02-29')).toBe(true);
    expect(isValidDateInput('30/09/2026')).toBe(false);
    expect(utcDateBounds('2026-09-01', '2026-09-30')).toEqual({
      startedAtFrom: '2026-09-01T00:00:00.000Z',
      startedAtBefore: '2026-10-01T00:00:00.000Z',
    });
  });
  it('detects combined active filters', () => {
    expect(hasActiveFilters(EMPTY_HISTORY_FILTERS)).toBe(false);
    expect(hasActiveFilters({...EMPTY_HISTORY_FILTERS, connectionType: 'wifi', geoCenter: center})).toBe(true);
  });
});
