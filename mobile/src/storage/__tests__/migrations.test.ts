import {migrateDatabase} from '../migrations';
import type {NitroSQLiteConnection} from 'react-native-nitro-sqlite';

function result<Row>(rows: Row[]) {
  return {rows: {_array: rows, length: rows.length, item: (index: number) => rows[index]}};
}

describe('database migrations', () => {
  it('enables foreign keys and creates schemas 1 and 2 transactionally', async () => {
    const statements: string[] = [];
    const tx = {
      executeAsync: jest.fn(async (sql: string) => { statements.push(sql); return {}; }),
    };
    const db = {
      executeAsync: jest.fn(async (sql: string) => {
        statements.push(sql);
        return sql === 'PRAGMA user_version' ? result([{user_version: 0}]) : {};
      }),
      transaction: jest.fn(async (work: (transaction: typeof tx) => Promise<void>) => work(tx)),
    } as unknown as NitroSQLiteConnection;

    await migrateDatabase(db);

    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(statements[0]).toBe('PRAGMA foreign_keys = ON');
    expect(statements.join('\n')).toContain('CREATE TABLE measurements');
    expect(statements.join('\n')).toContain('CREATE TABLE measurement_targets');
    expect(statements.join('\n')).toContain('ON DELETE CASCADE');
    expect(statements.join('\n')).toContain('CREATE INDEX idx_measurements_started_at');
    expect(statements.join('\n')).toContain('CREATE INDEX idx_measurements_connection_type');
    expect(statements.join('\n')).toContain('CREATE TABLE background_monitor_settings');
    expect(statements.at(-1)).toBe('PRAGMA user_version = 2');
  });

  it('does not rerun an already-applied migration', async () => {
    const db = {
      executeAsync: jest.fn(async (sql: string) => sql === 'PRAGMA user_version'
        ? result([{user_version: 2}]) : {}),
      transaction: jest.fn(),
    } as unknown as NitroSQLiteConnection;
    await migrateDatabase(db);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('upgrades existing schema 1 without touching saved measurements', async () => {
    const statements: string[] = [];
    const tx = {executeAsync: jest.fn(async (sql: string) => {statements.push(sql); return {};})};
    const db = {
      executeAsync: jest.fn(async (sql: string) => sql === 'PRAGMA user_version'
        ? result([{user_version: 1}]) : {}),
      transaction: jest.fn(async (work: (transaction: typeof tx) => Promise<void>) => work(tx)),
    } as unknown as NitroSQLiteConnection;
    await migrateDatabase(db);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(statements.join('\n')).toContain('CREATE TABLE background_monitor_settings');
    expect(statements.join('\n')).not.toContain('CREATE TABLE measurements');
    expect(statements.at(-1)).toBe('PRAGMA user_version = 2');
  });
});
