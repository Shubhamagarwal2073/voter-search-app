import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// Declare global cache for persistent SQLite instances in Next.js / Node
declare global {
  var _votersDbPromise: Promise<Database> | undefined;
  var _authDbPromise: Promise<Database> | undefined;
}

const votersDbPath = path.resolve(process.cwd(), 'data', 'voters.db');
const authDbPath = path.resolve(process.cwd(), 'data', 'auth.db');

/**
 * Returns a persistent singleton connection to voters.db with WAL mode enabled.
 * Reuses the same connection across all API requests to prevent lock contention.
 */
export async function getVotersDb(): Promise<Database> {
  if (!global._votersDbPromise) {
    global._votersDbPromise = open({
      filename: votersDbPath,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec('PRAGMA journal_mode = WAL;');
      await db.exec('PRAGMA busy_timeout = 5000;');
      return db;
    }).catch((err) => {
      global._votersDbPromise = undefined;
      throw err;
    });
  }
  return global._votersDbPromise;
}

/**
 * Returns a persistent singleton connection to auth.db with WAL mode enabled.
 * Reuses the same connection across all API requests.
 */
export async function getAuthDb(): Promise<Database> {
  if (!global._authDbPromise) {
    global._authDbPromise = open({
      filename: authDbPath,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec('PRAGMA journal_mode = WAL;');
      await db.exec('PRAGMA busy_timeout = 5000;');
      return db;
    }).catch((err) => {
      global._authDbPromise = undefined;
      throw err;
    });
  }
  return global._authDbPromise;
}
