import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';

export let db: any = null;
export let pool: any = null;
export let isSqliteFallback = false;

const mysqlUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.MYSQL_DATABASE_URL?.trim() ||
  process.env.MYSQL_URL?.trim() ||
  process.env.DB_URL?.trim();

const sqlitePath = process.env.SQLITE_DATABASE_PATH?.trim() || 'data/database.sqlite';

const fallbackNetworkErrors = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'EADDRNOTAVAIL',
  'EAI_AGAIN',
]);

async function tryMysqlConnection(url: string) {
  const poolInstance = mysql.createPool(url);
  const connection = await poolInstance.getConnection();
  await connection.ping();
  connection.release();
  return poolInstance;
}

export async function initDatabase() {
  if (mysqlUrl) {
    try {
      pool = await tryMysqlConnection(mysqlUrl);
      const schema = await import('@shared/schema');
      db = drizzleMysql(pool, { schema, mode: 'default' });
      isSqliteFallback = false;
      console.log('Connected to MySQL database');
      return;
    } catch (error: any) {
      const code = error?.code || error?.errno || '';
      const message = error?.message || String(error);
      const shouldFallback = fallbackNetworkErrors.has(code) || /ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|EAI_AGAIN/.test(message);

      if (!shouldFallback) {
        throw error;
      }

      console.warn(`MySQL connection failed (${message}). Falling back to local SQLite storage.`);
    }
  }

  process.env.DB_TYPE = 'sqlite';
  const schema = await import('@shared/schema');
  const { default: Database } = await import('better-sqlite3');
  const { drizzle: drizzleSqlite } = await import('drizzle-orm/better-sqlite3');
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const sqliteDb = new Database(sqlitePath);
  db = drizzleSqlite(sqliteDb, { schema, mode: 'default' });
  isSqliteFallback = true;
  console.log(`Using SQLite fallback database at ${sqlitePath}`);
}
