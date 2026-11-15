import "server-only";
import { SCHEMA_SQL } from "./schema";

/**
 * Tiny database layer.
 * - In production we connect to Supabase Postgres through DATABASE_URL (postgres.js).
 * - Without DATABASE_URL (local dev, quick tests) we use PGlite, an in-process Postgres.
 * Both speak the same SQL, so the rest of the app only uses `q()` and `tx()`.
 */

type Row = Record<string, unknown>;
interface Driver {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

const g = globalThis as unknown as {
  __verityDriver?: Promise<Driver>;
  __verityReady?: Promise<void>;
};

async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    // Supabase's transaction pooler can drop answers to queries pipelined on one connection,
    // so each server instance sends one query at a time (a simple promise queue).
    const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 15 });
    let chain: Promise<unknown> = Promise.resolve();
    return {
      query<T>(text: string, params: unknown[] = []) {
        // postgres.js would JSON-encode a string bound to a jsonb parameter a second time; send it as text and let Postgres parse it.
        const sqlText = text.replace(/(\$\d+)::jsonb/g, "$1::text::jsonb");
        const run = chain.then(() => sql.unsafe(sqlText, params as never[]));
        chain = run.catch(() => undefined);
        return run as unknown as Promise<T[]>;
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? (process.env.VERCEL ? "memory://" : "./.data/pglite");
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await db.query(text, params);
      return res.rows as T[];
    },
  };
}

async function driver(): Promise<Driver> {
  if (!g.__verityDriver) g.__verityDriver = createDriver();
  return g.__verityDriver;
}

async function ready(): Promise<void> {
  if (!g.__verityReady) {
    g.__verityReady = (async () => {
      const d = await driver();
      for (const stmt of SCHEMA_SQL.split(";\n").map((s) => s.trim()).filter(Boolean)) {
        await d.query(stmt);
      }
      const { seedIfEmpty } = await import("./seed");
      await seedIfEmpty();
    })().catch((e) => {
      g.__verityReady = undefined;
      throw e;
    });
  }
  return g.__verityReady;
}

/** Run a query after making sure the schema and demo data exist. */
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const d = await driver();
  return d.query<T>(text, params);
}

/** Raw query without the ready() guard — only used by the seeder itself. */
export async function rawQ<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const d = await driver();
  return d.query<T>(text, params);
}

export async function q1<T = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await q<T>(text, params);
  return rows[0];
}

export function dbMode(): "supabase" | "local" {
  return process.env.DATABASE_URL ? "supabase" : "local";
}
