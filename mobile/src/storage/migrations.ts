import type {NitroSQLiteConnection} from 'react-native-nitro-sqlite';

export const DATABASE_SCHEMA_VERSION = 2;

export async function migrateDatabase(db: NitroSQLiteConnection): Promise<void> {
  await db.executeAsync('PRAGMA foreign_keys = ON');
  const versionResult = await db.executeAsync<{user_version: number}>(
    'PRAGMA user_version',
  );
  const currentVersion = versionResult.rows._array[0]?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.transaction(async tx => {
      await tx.executeAsync(`
        CREATE TABLE measurements (
          id TEXT PRIMARY KEY NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          location_accuracy_m REAL,
          location_timestamp TEXT,
          connection_type TEXT,
          cellular_generation TEXT,
          operator TEXT,
          signal_dbm REAL,
          global_avg_rtt_ms REAL,
          global_jitter_ms REAL,
          global_packet_loss_pct REAL,
          download_mbps REAL,
          upload_mbps REAL,
          created_at TEXT NOT NULL
        )
      `);
      await tx.executeAsync(`
        CREATE TABLE measurement_targets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          measurement_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          label TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER NOT NULL,
          sent INTEGER NOT NULL,
          received INTEGER NOT NULL,
          lost INTEGER NOT NULL,
          packet_loss_pct REAL NOT NULL,
          min_rtt_ms REAL,
          avg_rtt_ms REAL,
          max_rtt_ms REAL,
          jitter_ms REAL,
          FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE CASCADE
        )
      `);
      await tx.executeAsync(
        'CREATE INDEX idx_measurements_started_at ON measurements(started_at)',
      );
      await tx.executeAsync(
        'CREATE INDEX idx_measurements_connection_type ON measurements(connection_type)',
      );
      await tx.executeAsync('PRAGMA user_version = 1');
    });
  }

  if (currentVersion < 2) {
    await db.transaction(async tx => {
      await tx.executeAsync(`
        CREATE TABLE background_monitor_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          enabled INTEGER NOT NULL DEFAULT 0,
          last_run_at TEXT,
          last_status TEXT,
          last_avg_rtt_ms REAL,
          last_packet_loss_pct REAL,
          last_notification_at TEXT
        )
      `);
      await tx.executeAsync('INSERT INTO background_monitor_settings (id, enabled) VALUES (1, 0)');
      await tx.executeAsync('PRAGMA user_version = 2');
    });
  }

  if (currentVersion > DATABASE_SCHEMA_VERSION) {
    throw new Error(`Unsupported database schema version: ${currentVersion}`);
  }
}
