import type {CellularGeneration, ConnectionType} from '../types/network';
import type {LocationFix} from '../features/location/locationService';
import {summarizeSession} from '../features/measurements/statistics';
import type {MeasurementSessionResult, TargetMeasurement} from '../features/measurements/types';
import {getDatabase} from './database';

export type StoredTarget = {
  targetId: string;
  label: string;
  host: string;
  port: number;
  sent: number;
  received: number;
  lost: number;
  packetLossPct: number;
  minRttMs: number | null;
  avgRttMs: number | null;
  maxRttMs: number | null;
  jitterMs: number | null;
};

export type StoredMeasurement = {
  id: string;
  startedAt: string;
  finishedAt: string;
  latitude: number;
  longitude: number;
  locationAccuracyM: number;
  locationTimestamp: string;
  connectionType: ConnectionType;
  cellularGeneration: CellularGeneration | null;
  operator: string | null;
  signalDbm: number | null;
  globalAvgRttMs: number | null;
  globalJitterMs: number | null;
  globalPacketLossPct: number;
  downloadMbps: number | null;
  uploadMbps: number | null;
  createdAt: string;
  targets: StoredTarget[];
};

export type MapMeasurement = Pick<
  StoredMeasurement,
  | 'id' | 'startedAt' | 'latitude' | 'longitude' | 'connectionType'
  | 'cellularGeneration' | 'globalAvgRttMs' | 'globalJitterMs'
  | 'globalPacketLossPct' | 'downloadMbps' | 'uploadMbps'
>;

export type ChartMeasurement = Pick<
  StoredMeasurement,
  | 'startedAt' | 'globalAvgRttMs' | 'globalJitterMs'
  | 'globalPacketLossPct' | 'downloadMbps' | 'uploadMbps'
  | 'connectionType'
>;

export type HistoryQuery = {
  connectionType?: ConnectionType | null;
  cellularGeneration?: CellularGeneration | null;
  startedAtFrom?: string | null;
  startedAtBefore?: string | null;
};

export type HistoryFilterOptions = {
  connectionTypes: ConnectionType[];
  cellularGenerations: CellularGeneration[];
};

type MeasurementRow = {
  id: string;
  started_at: string;
  finished_at: string;
  latitude: number;
  longitude: number;
  location_accuracy_m: number;
  location_timestamp: string;
  connection_type: ConnectionType;
  cellular_generation: CellularGeneration | null;
  operator: string | null;
  signal_dbm: number | null;
  global_avg_rtt_ms: number | null;
  global_jitter_ms: number | null;
  global_packet_loss_pct: number;
  download_mbps: number | null;
  upload_mbps: number | null;
  created_at: string;
};

type TargetRow = {
  target_id: string;
  label: string;
  host: string;
  port: number;
  sent: number;
  received: number;
  lost: number;
  packet_loss_pct: number;
  min_rtt_ms: number | null;
  avg_rtt_ms: number | null;
  max_rtt_ms: number | null;
  jitter_ms: number | null;
};

type MapRow = {
  id: string;
  started_at: string;
  latitude: number;
  longitude: number;
  connection_type: ConnectionType;
  cellular_generation: CellularGeneration | null;
  global_avg_rtt_ms: number | null;
  global_jitter_ms: number | null;
  global_packet_loss_pct: number;
  download_mbps: number | null;
  upload_mbps: number | null;
};

type ChartRow = Pick<
  MapRow,
  | 'started_at' | 'global_avg_rtt_ms' | 'global_jitter_ms'
  | 'global_packet_loss_pct' | 'download_mbps' | 'upload_mbps'
  | 'connection_type'
>;

export function mapMapRow(row: MapRow): MapMeasurement {
  return {
    id: row.id,
    startedAt: row.started_at,
    latitude: row.latitude,
    longitude: row.longitude,
    connectionType: row.connection_type,
    cellularGeneration: row.cellular_generation,
    globalAvgRttMs: row.global_avg_rtt_ms,
    globalJitterMs: row.global_jitter_ms,
    globalPacketLossPct: row.global_packet_loss_pct,
    downloadMbps: row.download_mbps,
    uploadMbps: row.upload_mbps,
  };
}

export function mapChartRow(row: ChartRow): ChartMeasurement {
  return {
    startedAt: row.started_at,
    globalAvgRttMs: row.global_avg_rtt_ms,
    globalJitterMs: row.global_jitter_ms,
    globalPacketLossPct: row.global_packet_loss_pct,
    downloadMbps: row.download_mbps,
    uploadMbps: row.upload_mbps,
    connectionType: row.connection_type,
  };
}

function uuidFromDatabase(randomHex: string): string {
  return `${randomHex.slice(0, 8)}-${randomHex.slice(8, 12)}-4${randomHex.slice(13, 16)}-a${randomHex.slice(17, 20)}-${randomHex.slice(20, 32)}`;
}

export function mapTarget(target: TargetMeasurement): StoredTarget {
  return {
    targetId: target.target.id,
    label: target.target.label,
    host: target.target.host,
    port: target.target.port,
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

export function mapMeasurementRow(row: MeasurementRow, targets: TargetRow[] = []): StoredMeasurement {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAccuracyM: row.location_accuracy_m,
    locationTimestamp: row.location_timestamp,
    connectionType: row.connection_type,
    cellularGeneration: row.cellular_generation,
    operator: row.operator,
    signalDbm: row.signal_dbm,
    globalAvgRttMs: row.global_avg_rtt_ms,
    globalJitterMs: row.global_jitter_ms,
    globalPacketLossPct: row.global_packet_loss_pct,
    downloadMbps: row.download_mbps,
    uploadMbps: row.upload_mbps,
    createdAt: row.created_at,
    targets: targets.map(target => ({
      targetId: target.target_id,
      label: target.label,
      host: target.host,
      port: target.port,
      sent: target.sent,
      received: target.received,
      lost: target.lost,
      packetLossPct: target.packet_loss_pct,
      minRttMs: target.min_rtt_ms,
      avgRttMs: target.avg_rtt_ms,
      maxRttMs: target.max_rtt_ms,
      jitterMs: target.jitter_ms,
    })),
  };
}

export async function saveMeasurement(
  session: MeasurementSessionResult,
  location: LocationFix,
): Promise<string> {
  if (session.cancelled) {
    throw new Error('Cancelled sessions cannot be persisted');
  }
  const db = await getDatabase();
  const idResult = await db.executeAsync<{id: string}>(
    "SELECT lower(hex(randomblob(16))) AS id",
  );
  const id = uuidFromDatabase(idResult.rows._array[0]?.id ?? '');
  const summary = summarizeSession(session.latency.targets);
  const createdAt = new Date().toISOString();
  const download = session.throughput?.download?.mbps ?? null;
  const upload = session.throughput?.upload?.mbps ?? null;

  await db.transaction(async tx => {
    await tx.executeAsync(
      `INSERT INTO measurements (
        id, started_at, finished_at, latitude, longitude, location_accuracy_m,
        location_timestamp, connection_type, cellular_generation, operator,
        signal_dbm, global_avg_rtt_ms, global_jitter_ms, global_packet_loss_pct,
        download_mbps, upload_mbps, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, session.startedAt, session.finishedAt, location.latitude,
        location.longitude, location.accuracy, location.timestamp,
        session.networkSnapshot.connectionType,
        session.networkSnapshot.cellularGeneration,
        session.networkSnapshot.operator, session.networkSnapshot.signalDbm,
        summary.avgRttMs, summary.jitterMs, summary.packetLossPct,
        download, upload, createdAt],
    );

    for (const measurement of session.latency.targets) {
      const target = mapTarget(measurement);
      await tx.executeAsync(
        `INSERT INTO measurement_targets (
          measurement_id, target_id, label, host, port, sent, received, lost,
          packet_loss_pct, min_rtt_ms, avg_rtt_ms, max_rtt_ms, jitter_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, target.targetId, target.label, target.host, target.port,
          target.sent, target.received, target.lost, target.packetLossPct,
          target.minRttMs, target.avgRttMs, target.maxRttMs, target.jitterMs],
      );
    }
  });
  return id;
}

const measurementColumns = `id, started_at, finished_at, latitude, longitude,
  location_accuracy_m, location_timestamp, connection_type, cellular_generation,
  operator, signal_dbm, global_avg_rtt_ms, global_jitter_ms,
  global_packet_loss_pct, download_mbps, upload_mbps, created_at`;
const targetColumns = `target_id, label, host, port, sent, received, lost,
  packet_loss_pct, min_rtt_ms, avg_rtt_ms, max_rtt_ms, jitter_ms`;

export async function getMeasurements(): Promise<StoredMeasurement[]> {
  const db = await getDatabase();
  const result = await db.executeAsync<MeasurementRow>(
    `SELECT ${measurementColumns} FROM measurements ORDER BY started_at DESC`,
  );
  return result.rows._array.map(row => mapMeasurementRow(row));
}

export async function getMeasurementsByFilters(filters: HistoryQuery): Promise<StoredMeasurement[]> {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  if (filters.connectionType) {
    conditions.push('connection_type = ?');
    values.push(filters.connectionType);
  }
  if (filters.cellularGeneration) {
    conditions.push('cellular_generation = ?');
    values.push(filters.cellularGeneration);
  }
  if (filters.startedAtFrom) {
    conditions.push('started_at >= ?');
    values.push(filters.startedAtFrom);
  }
  if (filters.startedAtBefore) {
    conditions.push('started_at < ?');
    values.push(filters.startedAtBefore);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const db = await getDatabase();
  const result = await db.executeAsync<MeasurementRow>(
    `SELECT ${measurementColumns} FROM measurements${where} ORDER BY started_at DESC`, values,
  );
  return result.rows._array.map(row => mapMeasurementRow(row));
}

export async function getHistoryFilterOptions(): Promise<HistoryFilterOptions> {
  const db = await getDatabase();
  const result = await db.executeAsync<{
    connection_type: ConnectionType;
    cellular_generation: CellularGeneration | null;
  }>('SELECT DISTINCT connection_type, cellular_generation FROM measurements');
  return {
    connectionTypes: [...new Set(result.rows._array.map(row => row.connection_type))],
    cellularGenerations: [...new Set(result.rows._array.map(row => row.cellular_generation)
      .filter((value): value is CellularGeneration => value !== null))],
  };
}

/** Loads full details only for the visible rows. Batches keep SQLite's bind count bounded. */
export async function getMeasurementsForExport(ids: string[]): Promise<StoredMeasurement[]> {
  if (ids.length === 0) {
    return [];
  }
  const db = await getDatabase();
  const byId = new Map<string, StoredMeasurement>();
  for (let offset = 0; offset < ids.length; offset += 400) {
    const batch = ids.slice(offset, offset + 400);
    const placeholders = batch.map(() => '?').join(', ');
    const [measurements, targets] = await Promise.all([
      db.executeAsync<MeasurementRow>(
        `SELECT ${measurementColumns} FROM measurements WHERE id IN (${placeholders})`, batch,
      ),
      db.executeAsync<TargetRow & {measurement_id: string}>(
        `SELECT measurement_id, ${targetColumns} FROM measurement_targets WHERE measurement_id IN (${placeholders}) ORDER BY id ASC`, batch,
      ),
    ]);
    const targetsById = new Map<string, TargetRow[]>();
    for (const target of targets.rows._array) {
      const group = targetsById.get(target.measurement_id) ?? [];
      group.push(target);
      targetsById.set(target.measurement_id, group);
    }
    for (const row of measurements.rows._array) {
      byId.set(row.id, mapMeasurementRow(row, targetsById.get(row.id) ?? []));
    }
  }
  return ids.flatMap(id => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export async function getMeasurementsForMap(): Promise<MapMeasurement[]> {
  const db = await getDatabase();
  const result = await db.executeAsync<MapRow>(`
    SELECT id, started_at, latitude, longitude, connection_type,
      cellular_generation, global_avg_rtt_ms, global_jitter_ms,
      global_packet_loss_pct, download_mbps, upload_mbps
    FROM measurements ORDER BY started_at DESC
  `);
  return result.rows._array.map(mapMapRow);
}

export async function getMeasurementsForCharts(): Promise<ChartMeasurement[]> {
  const db = await getDatabase();
  const result = await db.executeAsync<ChartRow>(`
    SELECT started_at, global_avg_rtt_ms, global_jitter_ms,
      global_packet_loss_pct, download_mbps, upload_mbps, connection_type
    FROM measurements ORDER BY started_at ASC
  `);
  return result.rows._array.map(mapChartRow);
}

export async function getMeasurementById(id: string): Promise<StoredMeasurement | null> {
  const db = await getDatabase();
  const result = await db.executeAsync<MeasurementRow>(
    `SELECT ${measurementColumns} FROM measurements WHERE id = ? LIMIT 1`, [id],
  );
  const row = result.rows._array[0];
  if (!row) {
    return null;
  }
  const targetResult = await db.executeAsync<TargetRow>(
    `SELECT ${targetColumns} FROM measurement_targets WHERE measurement_id = ? ORDER BY id ASC`, [id],
  );
  return mapMeasurementRow(row, targetResult.rows._array);
}

export async function deleteMeasurement(id: string): Promise<void> {
  const db = await getDatabase();
  await db.executeAsync('DELETE FROM measurements WHERE id = ?', [id]);
}

export async function getMeasurementCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.executeAsync<{count: number}>(
    'SELECT COUNT(*) AS count FROM measurements',
  );
  return result.rows._array[0]?.count ?? 0;
}
