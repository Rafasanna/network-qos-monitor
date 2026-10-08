import {open} from 'react-native-nitro-sqlite';
import type {NitroSQLiteConnection} from 'react-native-nitro-sqlite';

import {migrateDatabase} from './migrations';

let databasePromise: Promise<NitroSQLiteConnection> | null = null;

export function getDatabase(): Promise<NitroSQLiteConnection> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = open({name: 'network-qos-monitor.sqlite'});
      await migrateDatabase(db);
      return db;
    })().catch(error => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}
