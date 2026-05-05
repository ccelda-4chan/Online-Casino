import path from 'path';
import { readFile } from 'fs/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export let db: any = null;
export let pool: Pool | null = null;

const postgresUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.DB_URL?.trim();

async function tryPostgresConnection(url: string) {
  const poolInstance = new Pool({
    connectionString: url,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await poolInstance.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
  return poolInstance;
}

async function applySchemaIfNeeded(poolInstance: Pool) {
  try {
    const schemaPath = path.resolve(process.cwd(), 'mysql-schema.sql');
    const sql = await readFile(schemaPath, 'utf8');
    await poolInstance.query(sql);
    console.log('Database schema ensured from mysql-schema.sql');
  } catch (error: any) {
    console.error('Failed to apply database schema:', error);
    throw error;
  }
}

export async function initDatabase() {
  if (postgresUrl) {
    try {
      pool = await tryPostgresConnection(postgresUrl);
      await applySchemaIfNeeded(pool);
      const schema = await import('@shared/schema');
      db = drizzle(pool, { schema });
      console.log('Connected to PostgreSQL database');
      return;
    } catch (error: any) {
      const message = error?.message || String(error);
      console.error(`PostgreSQL connection failed: ${message}`);
      throw new Error(
        `Unable to connect to PostgreSQL database. Please verify DATABASE_URL and network access. Error: ${message}`,
      );
    }
  }

  throw new Error(
    'DATABASE_URL is not configured. Set DATABASE_URL to a valid PostgreSQL connection string.',
  );
}
