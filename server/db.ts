import mysql from 'mysql2/promise';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';

export let db: any = null;
export let pool: any = null;

const mysqlUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.MYSQL_DATABASE_URL?.trim() ||
  process.env.MYSQL_URL?.trim() ||
  process.env.DB_URL?.trim();

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
      console.log('Connected to MySQL database');
      return;
    } catch (error: any) {
      const message = error?.message || String(error);
      console.error(`MySQL connection failed: ${message}`);
      throw new Error(
        `Unable to connect to MySQL database. Please verify DATABASE_URL and network access. Error: ${message}`,
      );
    }
  }

  throw new Error(
    'DATABASE_URL is not configured. Set DATABASE_URL to a valid MySQL connection string.',
  );
}
