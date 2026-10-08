import {getDatabase} from './database';
import type {BackgroundMonitorState, DegradationEvaluation} from '../features/background/types';

type SettingsRow = {
  enabled: number;
  last_run_at: string | null;
  last_status: BackgroundMonitorState['lastStatus'];
  last_avg_rtt_ms: number | null;
  last_packet_loss_pct: number | null;
  last_notification_at: string | null;
};

export async function getBackgroundMonitorState(): Promise<BackgroundMonitorState> {
  const db = await getDatabase();
  const result = await db.executeAsync<SettingsRow>(
    'SELECT enabled, last_run_at, last_status, last_avg_rtt_ms, last_packet_loss_pct, last_notification_at FROM background_monitor_settings WHERE id = 1',
  );
  const row = result.rows._array[0];
  if (!row) {
    throw new Error('Background settings missing');
  }
  return {
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastAvgRttMs: row.last_avg_rtt_ms,
    lastPacketLossPct: row.last_packet_loss_pct,
    lastNotificationAt: row.last_notification_at,
  };
}

export async function setBackgroundMonitorEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.executeAsync('UPDATE background_monitor_settings SET enabled = ? WHERE id = 1', [enabled ? 1 : 0]);
}

export async function recordBackgroundRun(evaluation: DegradationEvaluation): Promise<void> {
  const db = await getDatabase();
  await db.executeAsync(
    'UPDATE background_monitor_settings SET last_run_at = ?, last_status = ?, last_avg_rtt_ms = ?, last_packet_loss_pct = ? WHERE id = 1',
    [new Date().toISOString(), evaluation.level, evaluation.avgRttMs, evaluation.packetLossPct],
  );
}

export async function recordBackgroundNotification(): Promise<void> {
  const db = await getDatabase();
  await db.executeAsync(
    'UPDATE background_monitor_settings SET last_notification_at = ? WHERE id = 1',
    [new Date().toISOString()],
  );
}
