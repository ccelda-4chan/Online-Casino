import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '@shared/schema';

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.MYSQL_DATABASE_URL?.trim() ||
  process.env.MYSQL_URL?.trim() ||
  process.env.DB_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or MYSQL_DATABASE_URL must be set. If you're deploying to Render, add this value in the service Environment variables section.",
  );
}

export const pool = mysql.createPool(databaseUrl);
export const db = drizzle(pool, { schema, mode: 'default' });
