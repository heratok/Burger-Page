import pg from 'pg';
import type { UserRole } from '../../../domain/models/User.js';

import { parsePoolMax } from './poolConfig.js';

const { Pool } = pg;

// Pool hardening (H3): the previous config had NO limits, so a DB outage
// that did not fail fast at the TCP level made every DB-bound request block
// indefinitely (effective connectionTimeoutMillis: 0 — wait forever). These
// bring bounded concurrency, fail-fast pool acquisition, idle reaping and
// connection rotation. Values are exported so tests/observability can refer
// to the same numbers.
// Configurable through PG_POOL_MAX (1..100, default 10); read once at load.
export const PG_POOL_MAX = parsePoolMax(process.env.PG_POOL_MAX);
export const PG_CONNECTION_TIMEOUT_MS = 5000;
export const PG_IDLE_TIMEOUT_MS = 30000;
export const PG_MAX_USES = 7500;
// Sent as a server startup parameter on every pooled connection (pg supports
// statement_timeout in the client/Pool config — ConnectionParameters reads
// it and forwards it in the startup packet), so any single statement that
// runs longer than 15s is aborted by Postgres instead of hanging the request
// forever. Transaction-scoped via the server, so it needs no per-call SET.
export const PG_STATEMENT_TIMEOUT_MS = 15000;

let pool: pg.Pool | null = null;

/**
 * TLS options for the pool.
 *
 * - localhost / sslmode=disable: no TLS (local dev, CI service containers).
 * - DATABASE_SSL_CA set (PEM; literal "\n" sequences are accepted so it fits
 *   a one-line env var): the server certificate is verified against that CA.
 *   Supabase signs its database certificates with its own root CA, downloadable
 *   from the dashboard (Database settings > SSL Configuration).
 * - DATABASE_SSL_VERIFY=true without a CA: verified against the system CAs.
 * - Otherwise: encrypted but NOT verified (anyone on the path can impersonate
 *   the database). Kept as the default so existing deployments keep working;
 *   a warning is logged in production until a CA is configured.
 *
 * An sslmode=... parameter inside DATABASE_URL overrides these options (pg
 * gives the connection string precedence), so leave it out when using them.
 */
export function resolvePgSsl(
  connectionString: string,
  env: Record<string, string | undefined> = process.env
): pg.PoolConfig['ssl'] {
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const sslDisabled = connectionString.includes('sslmode=disable');
  if (sslDisabled || isLocalhost) return undefined;

  const ca = env.DATABASE_SSL_CA?.trim();
  if (ca) return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  if (env.DATABASE_SSL_VERIFY === 'true') return { rejectUnauthorized: true };

  if (env.NODE_ENV === 'production') {
    console.warn(
      '[PgClient] SECURITY: the database TLS certificate is NOT verified. ' +
        'Set DATABASE_SSL_CA (Supabase root CA) to protect the connection against interception.'
    );
  }
  return { rejectUnauthorized: false };
}

export function getPgPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('PgClient requires DATABASE_URL to be defined.');
    }
    pool = new Pool({
      connectionString,
      ssl: resolvePgSsl(connectionString),
      max: PG_POOL_MAX,
      connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: PG_IDLE_TIMEOUT_MS,
      maxUses: PG_MAX_USES,
      statement_timeout: PG_STATEMENT_TIMEOUT_MS,
    });
    // An idle client can be terminated server-side (restart, failover, or the
    // E2E database reset). Without a listener pg re-emits it as an uncaught
    // exception and kills the process; with one the pool discards the client
    // and opens a fresh connection on the next acquire.
    pool.on('error', (err) => {
      console.warn(`[PgClient] idle client error (discarded): ${err.message}`);
    });
  }
  return pool;
}

/**
 * Ends the lazy pool and clears the module reference so graceful shutdown
 * can wait for in-flight pool work before the process exits. Guarded and
 * idempotent: no-op when the pool was never created; the reference is
 * cleared before end() so a concurrent second call cannot double-end the
 * same pool. Rejects only if the pool fails to end cleanly (callers decide
 * whether that must fail the shutdown).
 */
export async function closePgPool(): Promise<void> {
  const p = pool;
  pool = null;
  if (!p) return;
  await p.end();
}

export async function verifyPgConnection(): Promise<{
  ok: boolean;
  host?: string;
  database?: string;
  user?: string;
  error?: string;
}> {
  try {
    const p = getPgPool();
    const res = await p.query(
      'SELECT current_user, current_database(), inet_server_addr() as host, inet_server_port() as port'
    );
    const row = res.rows[0];
    return {
      ok: true,
      user: row?.current_user,
      database: row?.current_database,
      host: row?.host || 'localhost',
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || String(err),
    };
  }
}

export interface TenantContext {
  restaurantId: string | null;
  /**
   * Public slug the anonymous storefront lookup declares (app.restaurant_slug).
   * Only meaningful with restaurantId null and no actorRole: the public read
   * policies expose just the active restaurant with this slug.
   */
  restaurantSlug?: string;
  actorRole?: UserRole;
  actor?: string;
}

/**
 * Runs fn inside a transaction with app.restaurant_id / app.restaurant_slug /
 * app.actor_role / app.actor set via SET LOCAL (transaction-scoped) on a client checked out
 * for the duration of the call.
 *
 * SET LOCAL only, never plain SET: the pool reuses physical connections
 * across calls, so a session-level GUC would leak one request's tenant
 * context into the next request that happens to reuse the same connection
 * (verified empirically — a session-level set_config leaked a prior tenant's
 * visibility into a request that never set app.restaurant_id at all).
 */
export async function withTenantContext<T>(
  context: TenantContext,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    // Every call explicitly represents its context GUCs ('' = no context),
    // including absent ones. PostgreSQL keeps a sticky '' placeholder for a
    // custom GUC once it has been SET in the session — SET LOCAL + COMMIT
    // leaves current_setting() returning '' on pooled reuse, and neither
    // set_config(name, NULL, ...) nor RESET restores NULL (probe-verified on
    // PG16). The schema policies therefore normalize '' to NULL via
    // NULLIF(current_setting(...), ''), and this explicit '' makes the
    // no-context state deterministic on fresh and reused pooled connections
    // alike.
    await client.query("SELECT set_config('app.restaurant_id', $1, true)", [context.restaurantId ?? '']);
    await client.query("SELECT set_config('app.restaurant_slug', $1, true)", [context.restaurantSlug ?? '']);
    await client.query("SELECT set_config('app.actor_role', $1, true)", [context.actorRole ?? '']);
    await client.query("SELECT set_config('app.actor', $1, true)", [context.actor ?? '']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
