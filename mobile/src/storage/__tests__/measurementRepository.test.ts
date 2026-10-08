jest.mock('../database', () => ({getDatabase: jest.fn()}));

import {getDatabase} from '../database';
import {
  deleteMeasurement,
  getMeasurementById,
  getMeasurementCount,
  getMeasurements,
  getMeasurementsForMap,
  getMeasurementsForCharts,
  getMeasurementsByFilters,
  getHistoryFilterOptions,
  getMeasurementsForExport,
  mapMapRow,
  mapChartRow,
  mapMeasurementRow,
  mapTarget,
  saveMeasurement,
} from '../measurementRepository';
import type {MeasurementSessionResult, TargetMeasurement} from '../../features/measurements/types';

const target: TargetMeasurement = {
  target: {id: 'cloudflare', label: 'Cloudflare', host: 'one.one.one.one', port: 443},
  probes: [], sent: 5, received: 5, lost: 0, packetLossPct: 0,
  minRttMs: 10, avgRttMs: 12, maxRttMs: 14, jitterMs: 2,
};

const session: MeasurementSessionResult = {
  startedAt: '2026-09-30T18:20:00.000Z',
  finishedAt: '2026-09-30T18:21:00.000Z',
  networkSnapshot: {connectionType: 'wifi', cellularGeneration: null, operator: null, signalDbm: null},
  latency: {startedAt: '2026-09-30T18:20:00.000Z', finishedAt: '2026-09-30T18:20:30.000Z', targets: [target], networkSnapshot: {connectionType: 'wifi', cellularGeneration: null, operator: null, signalDbm: null}, cancelled: false},
  throughput: {download: {bytes: 5_000_000, durationMs: 800, mbps: 50}, upload: {bytes: 2_000_000, durationMs: 500, mbps: 32}, error: null},
  cancelled: false,
};

const location = {latitude: -34.6, longitude: -58.4, accuracy: 12, timestamp: '2026-09-30T18:21:01.000Z'};
const storedRow = {
  id: 'id', started_at: session.startedAt, finished_at: session.finishedAt,
  latitude: location.latitude, longitude: location.longitude,
  location_accuracy_m: 12, location_timestamp: location.timestamp,
  connection_type: 'wifi' as const, cellular_generation: null, operator: null,
  signal_dbm: null, global_avg_rtt_ms: 12, global_jitter_ms: 2,
  global_packet_loss_pct: 0, download_mbps: 50, upload_mbps: 32,
  created_at: session.finishedAt,
};
const rowResult = <T,>(rows: T[]) => ({rows: {_array: rows, length: rows.length, item: (index: number) => rows[index]}});

describe('measurementRepository mapping and transaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps target metrics without losing per-target values', () => {
    expect(mapTarget(target)).toMatchObject({targetId: 'cloudflare', avgRttMs: 12, packetLossPct: 0});
    expect(mapMeasurementRow(storedRow, []).targets).toEqual([]);
  });

  it('writes the session and target through the same SQLite transaction', async () => {
    const txExecute = jest.fn().mockResolvedValue({});
    const database = {
      executeAsync: jest.fn().mockResolvedValue({rows: {_array: [{id: '00112233445566778899aabbccddeeff'}]}}),
      transaction: jest.fn(async (work: (tx: {executeAsync: typeof txExecute}) => Promise<unknown>) => work({executeAsync: txExecute})),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);

    const id = await saveMeasurement(session, location);

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(txExecute).toHaveBeenCalledTimes(2);
    expect(txExecute.mock.calls[0][0]).toContain('INSERT INTO measurements');
    expect(txExecute.mock.calls[1][0]).toContain('INSERT INTO measurement_targets');
    expect(txExecute.mock.calls[1][1]).toContain('cloudflare');
  });

  it('propagates a target insert error so SQLite can roll back the transaction', async () => {
    const expected = new Error('target insert failed');
    const txExecute = jest.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(expected);
    const database = {
      executeAsync: jest.fn().mockResolvedValue({rows: {_array: [{id: '00112233445566778899aabbccddeeff'}]}}),
      transaction: jest.fn(async (work: (tx: {executeAsync: typeof txExecute}) => Promise<unknown>) => work({executeAsync: txExecute})),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);
    await expect(saveMeasurement(session, location)).rejects.toBe(expected);
    expect(database.transaction).toHaveBeenCalledTimes(1);
  });

  it('loads history newest-first and loads one session with its targets', async () => {
    const database = {
      executeAsync: jest.fn()
        .mockResolvedValueOnce(rowResult([storedRow]))
        .mockResolvedValueOnce(rowResult([storedRow]))
        .mockResolvedValueOnce(rowResult([{target_id: 'cloudflare', label: 'Cloudflare', host: 'one.one.one.one', port: 443, sent: 5, received: 5, lost: 0, packet_loss_pct: 0, min_rtt_ms: 10, avg_rtt_ms: 12, max_rtt_ms: 14, jitter_ms: 2}])),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);
    await expect(getMeasurements()).resolves.toHaveLength(1);
    expect(database.executeAsync.mock.calls[0][0]).toContain('ORDER BY started_at DESC');
    await expect(getMeasurementById('id')).resolves.toMatchObject({id: 'id', targets: [{targetId: 'cloudflare'}]});
    expect(database.executeAsync.mock.calls[2][1]).toEqual(['id']);
  });

  it('deletes by primary key and reports measurement count', async () => {
    const database = {
      executeAsync: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(rowResult([{count: 3}])),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);
    await deleteMeasurement('id');
    expect(database.executeAsync.mock.calls[0]).toEqual(['DELETE FROM measurements WHERE id = ?', ['id']]);
    await expect(getMeasurementCount()).resolves.toBe(3);
  });

  it('uses narrow queries and maps map/chart rows without loading targets', async () => {
    const mapRow = {
      id: 'one', started_at: '2026-09-30T18:20:00Z', latitude: -31.42,
      longitude: -64.18, connection_type: 'wifi' as const,
      cellular_generation: null, global_avg_rtt_ms: 28, global_jitter_ms: 4,
      global_packet_loss_pct: 0, download_mbps: 70, upload_mbps: 20,
    };
    const chartRow = {
      started_at: mapRow.started_at, connection_type: 'wifi' as const,
      global_avg_rtt_ms: 28, global_jitter_ms: 4,
      global_packet_loss_pct: 0, download_mbps: 70, upload_mbps: null,
    };
    const database = {
      executeAsync: jest.fn()
        .mockResolvedValueOnce(rowResult([mapRow]))
        .mockResolvedValueOnce(rowResult([chartRow])),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);

    expect(mapMapRow(mapRow)).toMatchObject({id: 'one', latitude: -31.42, globalAvgRttMs: 28});
    expect(mapChartRow(chartRow)).toMatchObject({startedAt: mapRow.started_at, uploadMbps: null});
    await expect(getMeasurementsForMap()).resolves.toHaveLength(1);
    await expect(getMeasurementsForCharts()).resolves.toHaveLength(1);
    expect(database.executeAsync.mock.calls[0][0]).toContain('ORDER BY started_at DESC');
    expect(database.executeAsync.mock.calls[1][0]).toContain('ORDER BY started_at ASC');
    expect(database.executeAsync.mock.calls[0][0]).not.toContain('measurement_targets');
    expect(database.executeAsync.mock.calls[1][0]).not.toContain('measurement_targets');
  });

  it('parameterizes combined network, generation and date filters', async () => {
    const database = {executeAsync: jest.fn().mockResolvedValue(rowResult([storedRow]))};
    (getDatabase as jest.Mock).mockResolvedValue(database);
    await expect(getMeasurementsByFilters({
      connectionType: 'cellular', cellularGeneration: '4G',
      startedAtFrom: '2026-09-01T00:00:00.000Z',
      startedAtBefore: '2026-10-01T00:00:00.000Z',
    })).resolves.toHaveLength(1);
    expect(database.executeAsync.mock.calls[0][0]).toContain('connection_type = ? AND cellular_generation = ? AND started_at >= ? AND started_at < ?');
    expect(database.executeAsync.mock.calls[0][1]).toEqual([
      'cellular', '4G', '2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z',
    ]);
  });

  it('returns only real network filter options present in SQLite', async () => {
    const database = {executeAsync: jest.fn().mockResolvedValue(rowResult([
      {connection_type: 'wifi', cellular_generation: null},
      {connection_type: 'cellular', cellular_generation: '4G'},
      {connection_type: 'cellular', cellular_generation: '4G'},
    ]))};
    (getDatabase as jest.Mock).mockResolvedValue(database);
    await expect(getHistoryFilterOptions()).resolves.toEqual({
      connectionTypes: ['wifi', 'cellular'], cellularGenerations: ['4G'],
    });
  });

  it('loads full targets for only visible export IDs and preserves visible order', async () => {
    const second = {...storedRow, id: 'second'};
    const targetRow = {measurement_id: 'id', target_id: 'cloudflare', label: 'Cloudflare', host: 'one.one.one.one',
      port: 443, sent: 5, received: 5, lost: 0, packet_loss_pct: 0,
      min_rtt_ms: 10, avg_rtt_ms: 12, max_rtt_ms: 14, jitter_ms: 2};
    const database = {executeAsync: jest.fn()
      .mockResolvedValueOnce(rowResult([storedRow, second]))
      .mockResolvedValueOnce(rowResult([targetRow]))};
    (getDatabase as jest.Mock).mockResolvedValue(database);
    const result = await getMeasurementsForExport(['second', 'id']);
    expect(result.map(item => item.id)).toEqual(['second', 'id']);
    expect(result[0].targets).toEqual([]);
    expect(result[1].targets).toMatchObject([{targetId: 'cloudflare'}]);
    expect(database.executeAsync.mock.calls[0][1]).toEqual(['second', 'id']);
    await expect(getMeasurementsForExport([])).resolves.toEqual([]);
  });
});
