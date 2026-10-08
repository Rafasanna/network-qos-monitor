import type {MapMeasurement} from '../../storage/measurementRepository';
import {calculateQualityScore, getQualityCategory, QUALITY_COLORS} from './qualityScore';

export type Region = {
  latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number;
};

export type MapMetric = 'quality' | 'latency' | 'download';
export type MapMarkerModel = MapMeasurement & {
  score: number | null;
  category: ReturnType<typeof getQualityCategory>;
  color: string;
};
export type HeatmapPoint = {latitude: number; longitude: number; weight: number};

const UNKNOWN_COLOR = '#667085';

export function measurementToMarkerModel(measurement: MapMeasurement): MapMarkerModel {
  const score = calculateQualityScore(measurement);
  const category = getQualityCategory(score);
  return {
    ...measurement,
    score,
    category,
    color: category === null ? UNKNOWN_COLOR : QUALITY_COLORS[category],
  };
}

/** Weighted heatmaps show relative density; higher weight means a worse hotspot. */
export function measurementToHeatmapPoint(
  measurement: MapMeasurement,
  metric: MapMetric = 'quality',
): HeatmapPoint | null {
  const score = metric === 'quality'
    ? calculateQualityScore(measurement)
    : metric === 'latency'
      ? measurement.globalAvgRttMs
      : measurement.downloadMbps;
  if (score === null || !Number.isFinite(score) || score < 0) {
    return null;
  }
  const severity = metric === 'quality'
    ? (100 - score) / 100
    : metric === 'latency'
      ? Math.min(score / 200, 1)
      : 1 - Math.min(score / 100, 1);
  return {
    latitude: measurement.latitude,
    longitude: measurement.longitude,
    weight: Math.max(0.05, severity),
  };
}

/** Uses only saved coordinates; a single point gets a small, useful viewport. */
export function regionForMeasurements(items: readonly MapMeasurement[]): Region | null {
  if (items.length === 0) {
    return null;
  }
  const bounds = items.reduce(
    (current, item) => ({
      south: Math.min(current.south, item.latitude),
      north: Math.max(current.north, item.latitude),
      west: Math.min(current.west, item.longitude),
      east: Math.max(current.east, item.longitude),
    }),
    {south: 90, north: -90, west: 180, east: -180},
  );
  const {south, north, west, east} = bounds;
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.max(0.015, (north - south) * 1.35),
    longitudeDelta: Math.max(0.015, (east - west) * 1.35),
  };
}
