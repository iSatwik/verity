import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { SCHEMA_SQL, RLS_SQL } from "./schema";

/**
 * Tiny database layer.
 * - In production we connect to Supabase Postgres through DATABASE_URL (postgres.js).
 * - Without DATABASE_URL (local dev, quick tests) we use PGlite, an in-process Postgres.
 * Both speak the same SQL, so the rest of the app only uses `q()` and `tx()`.
 */

type Row = Record<string, unknown>;
/** Who a query runs as. "system" = the app itself (schema, seeding, sign-in), not limited by RLS. */
export type Actor = { kind: "system" } | { kind: "user"; role: string; uid: string };
type Run = (text: string, params?: unknown[]) => Promise<Row[]>;
interface Driver {
  query<T = Row>(text: string, params?: unknown[], actor?: Actor): Promise<T[]>;
  /** One transaction as this person, for a whole action (one round trip per query instead of four). */
  transaction<T>(actor: Actor & { kind: "user" }, fn: (run: Run) => Promise<T>): Promise<T>;
}
const SYSTEM: Actor = { kind: "system" };
const ANON: Actor = { kind: "user", role: "anon", uid: "" };
// set_config('role', ...) is SET LOCAL ROLE: the rest of the transaction runs as verity_rls, which cannot bypass RLS.
const SET_ACTOR = "SELECT set_config('role', 'verity_rls', true), set_config('verity.role', $1, true), set_config('verity.uid', $2, true)";

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
      query<T>(text: string, params: unknown[] = [], actor: Actor = SYSTEM) {
        // postgres.js would JSON-encode a string bound to a jsonb parameter a second time; send it as text and let Postgres parse it.
        const sqlText = text.replace(/(\$\d+)::jsonb/g, "$1::text::jsonb");
        const run = chain.then(() =>
          actor.kind === "system"
            ? sql.unsafe(sqlText, params as never[])
            : sql.begin(async (tx) => {
                await tx.unsafe(SET_ACTOR, [actor.role, actor.uid]);
                return tx.unsafe(sqlText, params as never[]);
              }),
        );
        chain = run.catch(() => undefined);
        return run as unknown as Promise<T[]>;
      },
      transaction<T>(actor: Actor & { kind: "user" }, fn: (run: Run) => Promise<T>) {
        const run = chain.then(() =>
          sql.begin(async (tx) => {
            await tx.unsafe(SET_ACTOR, [actor.role, actor.uid]);
            return fn((text, params = []) => tx.unsafe(text.replace(/(\$\d+)::jsonb/g, "$1::text::jsonb"), params as never[]) as unknown as Promise<Row[]>);
          }),
        );
        chain = run.catch(() => undefined);
        return run as Promise<T>;
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? (process.env.VERCEL ? "memory://" : "./.data/pglite");
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    async query<T>(text: string, params: unknown[] = [], actor: Actor = SYSTEM) {
      if (actor.kind === "system") return (await db.query(text, params)).rows as T[];
      return db.transaction(async (tx) => {
        await tx.query(SET_ACTOR, [actor.role, actor.uid]);
        return (await tx.query(text, params)).rows as T[];
      });
    },
    transaction<T>(actor: Actor & { kind: "user" }, fn: (run: Run) => Promise<T>) {
      return db.transaction(async (tx) => {
        await tx.query(SET_ACTOR, [actor.role, actor.uid]);
        return fn(async (text, params = []) => (await tx.query(text, params)).rows as Row[]);
      });
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
      for (const stmt of RLS_SQL) await d.query(stmt);
      const { seedIfEmpty, ensureAccounts } = await import("./seed");
      await seedIfEmpty();
      await ensureAccounts();
    })().catch((e) => {
      g.__verityReady = undefined;
      throw e;
    });
  }
  return g.__verityReady;
}

const systemScope = new AsyncLocalStorage<true>();
const txScope = new AsyncLocalStorage<Run>();
/** Run `fn` as the app itself (seeding, reset, sign-in). Only call after checking permissions in code. */
export function asSystem<T>(fn: () => Promise<T>): Promise<T> {
  if (txScope.getStore()) throw new Error("asSystem() can't run inside a user transaction");
  return systemScope.run(true, fn);
}

async function currentActor(): Promise<Actor> {
  if (systemScope.getStore()) return SYSTEM;
  let session: typeof import("./session");
  try {
    session = await import("./session");
  } catch {
    return SYSTEM; // scripts and tests outside Next
  }
  try {
    const u = await session.sessionUser();
    return u ? { kind: "user", role: u.role, uid: u.id } : ANON;
  } catch {
    // no request (build step, background work): nothing user-facing runs here
    return SYSTEM;
  }
}

/**
 * Run a whole action in one transaction as the signed-in person: faster (the role is set once),
 * and all-or-nothing (if anything fails, nothing is saved).
 */
export async function withUserTx<T>(fn: () => Promise<T>): Promise<T> {
  if (txScope.getStore() || systemScope.getStore()) return fn();
  await ready();
  const actor = await currentActor();
  if (actor.kind !== "user") return fn();
  const d = await driver();
  return d.transaction(actor, (run) => txScope.run(run, fn));
}

/** Run a query as the signed-in person (database access limits apply), after making sure the schema and demo data exist. */
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const tx = txScope.getStore();
  if (tx && !systemScope.getStore()) return (await tx(text, params)) as T[];
  await ready();
  const d = await driver();
  return d.query<T>(text, params, await currentActor());
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
