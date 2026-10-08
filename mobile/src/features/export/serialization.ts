import type {StoredMeasurement, StoredTarget} from '../../storage/measurementRepository';
import {calculateQualityScore} from '../map/qualityScore';

export type ExportFormat = 'csv' | 'json';

const CSV_HEADERS = [
  'id', 'startedAt', 'finishedAt', 'latitude', 'longitude', 'locationAccuracy',
  'connectionType', 'cellularGeneration', 'operator', 'signalDbm',
  'avgRttMs', 'jitterMs', 'packetLossPct', 'downloadMbps', 'uploadMbps', 'qualityScore',
] as const;

function csvCell(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  let text = String(value);
  // Text fields can originate from the network operator; prevent spreadsheet formula execution.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function serializeMeasurementsCsv(items: StoredMeasurement[]): string {
  const rows = items.map(item => [
    item.id, item.startedAt, item.finishedAt, item.latitude, item.longitude,
    item.locationAccuracyM, item.connectionType, item.cellularGeneration,
    item.operator, item.signalDbm, item.globalAvgRttMs, item.globalJitterMs,
    item.globalPacketLossPct, item.downloadMbps, item.uploadMbps,
    calculateQualityScore(item),
  ].map(csvCell).join(','));
  return [CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n';
}

function exportedTarget(target: StoredTarget) {
  return {
    targetId: target.targetId,
    label: target.label,
    host: target.host,
    port: target.port,
    sent: target.sent,
    received: target.received,
    lost: target.lost,
    packetLossPct: target.packetLossPct,
    minRttMs: target.minRttMs,
    avgRttMs: target.avgRttMs,
    maxRttMs: target.maxRttMs,
    jitterMs: target.jitterMs,
  };
}

export function serializeMeasurementsJson(items: StoredMeasurement[], exportedAt: string): string {
  return JSON.stringify({
    exportedAt,
    measurementCount: items.length,
    measurements: items.map(item => ({
      id: item.id,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      latitude: item.latitude,
      longitude: item.longitude,
      locationAccuracy: item.locationAccuracyM,
      locationTimestamp: item.locationTimestamp,
      connectionType: item.connectionType,
      cellularGeneration: item.cellularGeneration,
      operator: item.operator,
      signalDbm: item.signalDbm,
      avgRttMs: item.globalAvgRttMs,
      jitterMs: item.globalJitterMs,
      packetLossPct: item.globalPacketLossPct,
      downloadMbps: item.downloadMbps,
      uploadMbps: item.uploadMbps,
      qualityScore: calculateQualityScore(item),
      targets: item.targets.map(exportedTarget),
    })),
  }, null, 2);
}

export function exportFileName(format: ExportFormat, date: Date): string {
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  return `network-qos-${local}.${format}`;
}
