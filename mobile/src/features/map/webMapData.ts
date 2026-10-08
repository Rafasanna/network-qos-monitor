import type {MapMeasurement} from '../../storage/measurementRepository';
import {measurementToHeatmapPoint, measurementToMarkerModel} from './mapData';
import type {QualityCategory} from './qualityScore';

export type WebMapPoint = MapMeasurement & {
  qualityScore: number | null;
  qualityCategory: QualityCategory | null;
  color: string;
  heatWeight: number | null;
};

export type WebMapMessage =
  | {type: 'ready'}
  | {type: 'tilesLoaded'}
  | {type: 'openDetail'; id: string}
  | {type: 'error'; message: string};

export function toWebMapPoints(measurements: readonly MapMeasurement[]): WebMapPoint[] {
  return measurements
    .filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) &&
      Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180)
    .map(item => {
      const marker = measurementToMarkerModel(item);
      const heat = measurementToHeatmapPoint(item);
      return {
        id: item.id,
        latitude: item.latitude,
        longitude: item.longitude,
        startedAt: item.startedAt,
        connectionType: item.connectionType,
        cellularGeneration: item.cellularGeneration,
        globalAvgRttMs: item.globalAvgRttMs,
        globalJitterMs: item.globalJitterMs,
        globalPacketLossPct: item.globalPacketLossPct,
        downloadMbps: item.downloadMbps,
        uploadMbps: item.uploadMbps,
        qualityScore: marker.score,
        qualityCategory: marker.category,
        color: marker.color,
        heatWeight: heat?.weight ?? null,
      };
    });
}

/** Safe to interpolate as a JavaScript literal in WebView.injectJavaScript. */
export function serializeWebMapPoints(points: readonly WebMapPoint[]): string {
  return JSON.stringify(points)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function parseWebMapMessage(raw: string): WebMapMessage | null {
  if (raw.length > 1024) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('type' in value)) return null;
    if (value.type === 'ready' || value.type === 'tilesLoaded') return {type: value.type};
    if (value.type === 'openDetail' && 'id' in value &&
      typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 256) {
      return {type: 'openDetail', id: value.id};
    }
    if (value.type === 'error' && 'message' in value && typeof value.message === 'string') {
      return {type: 'error', message: value.message.slice(0, 160)};
    }
  } catch {
    return null;
  }
  return null;
}
