import type {StoredMeasurement} from '../../../storage/measurementRepository';
import {exportFileName, serializeMeasurementsCsv, serializeMeasurementsJson} from '../serialization';

const item: StoredMeasurement = {
  id: 'session-1', startedAt: '2026-09-30T18:00:00.000Z', finishedAt: '2026-09-30T18:01:00.000Z',
  latitude: -31.4201, longitude: -64.1888, locationAccuracyM: 12,
  locationTimestamp: '2026-09-30T18:01:00.000Z', connectionType: 'cellular',
  cellularGeneration: '4G', operator: 'Operador, "Norte"\nSur', signalDbm: -89,
  globalAvgRttMs: 28, globalJitterMs: 4, globalPacketLossPct: 0,
  downloadMbps: 72.4, uploadMbps: null, createdAt: '2026-09-30T18:01:02.000Z',
  targets: [{targetId: 'cloudflare', label: 'Cloudflare', host: 'one.one.one.one', port: 443,
    sent: 5, received: 5, lost: 0, packetLossPct: 0,
    minRttMs: 23, avgRttMs: 28, maxRttMs: 37, jitterMs: 5}],
};

describe('export serialization', () => {
  it('writes one CSV row per session with coordinates, score, null and correct escaping', () => {
    const csv = serializeMeasurementsCsv([item]);
    expect(csv.split('\r\n')).toHaveLength(3);
    expect(csv).toContain('id,startedAt,finishedAt,latitude,longitude,locationAccuracy');
    expect(csv).toContain('-31.4201,-64.1888,12');
    expect(csv).toContain('"Operador, ""Norte""\nSur"');
    expect(csv).toContain(',72.4,,');
    expect(csv).not.toContain('one.one.one.one');
  });

  it('keeps full targets and nulls in JSON without SQLite internals', () => {
    const result = JSON.parse(serializeMeasurementsJson([item], '2026-09-30T19:00:00.000Z'));
    expect(result.exportedAt).toBe('2026-09-30T19:00:00.000Z');
    expect(result.measurementCount).toBe(1);
    expect(result.measurements[0]).toMatchObject({id: 'session-1', operator: item.operator,
      latitude: item.latitude, uploadMbps: null, targets: [{targetId: 'cloudflare', avgRttMs: 28}]});
    expect(result.measurements[0].qualityScore).toEqual(expect.any(Number));
    expect(result.measurements[0]).not.toHaveProperty('created_at');
  });

  it('protects CSV from spreadsheet formulas in text fields', () => {
    const csv = serializeMeasurementsCsv([{...item, operator: '=HYPERLINK("x")'}]);
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
  });

  it('uses the required local filename shape', () => {
    const date = new Date(2026, 8, 30, 18, 20);
    expect(exportFileName('csv', date)).toBe('network-qos-2026-09-30-1820.csv');
    expect(exportFileName('json', date)).toBe('network-qos-2026-09-30-1820.json');
  });
});
