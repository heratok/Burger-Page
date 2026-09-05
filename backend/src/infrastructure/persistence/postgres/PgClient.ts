import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('PgClient requires DATABASE_URL to be defined.');
    }
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const sslDisabled = connectionString.includes('sslmode=disable');
    pool = new Pool({
      connectionString,
      ssl: sslDisabled || isLocalhost ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
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
  actorRole?: 'super_admin' | 'restaurant_admin';
  actor?: string;
}

/**
 * Runs fn inside a transaction with app.restaurant_id / app.actor_role /
 * app.actor set via SET LOCAL (transaction-scoped) on a client checked out
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
    if (context.restaurantId !== null) {
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [context.restaurantId]);
    }
    if (context.actorRole) {
      await client.query("SELECT set_config('app.actor_role', $1, true)", [context.actorRole]);
    }
    if (context.actor) {
      await client.query("SELECT set_config('app.actor', $1, true)", [context.actor]);
    }
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
