import "server-only";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_ESTATE;

if (!connectionString) {
  throw new Error("DATABASE_URL/POSTGRES_URL не задан для подключения к Postgres");
}

type PoolGlobal = typeof globalThis & { __craftyPgPool?: Pool };

const pool =
  (globalThis as PoolGlobal).__craftyPgPool ||
  new Pool({
    connectionString
  });

if (process.env.NODE_ENV !== "production") {
  (globalThis as PoolGlobal).__craftyPgPool = pool;
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
