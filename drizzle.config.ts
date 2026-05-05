import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.DB_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL or POSTGRES_DATABASE_URL must be set. Ensure the database is provisioned and the env var is configured.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgres",
  dbCredentials: {
    url: databaseUrl,
  },
});
