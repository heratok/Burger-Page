import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { assertSafeToReset, type ResetTarget } from './db-reset-guard';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const SQL_FILES = ['01_schema.sql', '02_seed.sql'].map((f) => path.join(repoRoot, 'database', f));

/**
 * Resolves the URL the Playwright webServer backend will connect to, in the
 * same precedence the backend uses: an explicit E2E override, then the
 * process environment (which `process.loadEnvFile` never overrides), then
 * backend/.env.
 */
export function resolveE2eDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.E2E_DATABASE_URL?.trim()) return env.E2E_DATABASE_URL;
  if (env.DATABASE_URL?.trim()) return env.DATABASE_URL;
  const envFile = path.join(repoRoot, 'backend', '.env');
  if (!existsSync(envFile)) return undefined;
  return parseEnv(readFileSync(envFile, 'utf8')).DATABASE_URL;
}

/** Drops and recreates the guarded database, then loads schema + seed. */
export async function resetDatabase(target: ResetTarget, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  // The backend connects as the non-owner app_user (RLS), which cannot drop the
  // database, so DDL runs as a local admin role. Host and port always come from
  // the guarded target, so the admin credentials can never reach another host.
  const connection = {
    host: target.host,
    port: target.port,
    user: env.E2E_PG_ADMIN_USER ?? 'postgres',
    password: env.E2E_PG_ADMIN_PASSWORD ?? 'postgres',
  };
  const admin = new pg.Client({ ...connection, database: 'postgres' });
  await admin.connect();
  try {
    // Identifiers cannot be parameterised; the name is allowlisted by the guard.
    await admin.query(`DROP DATABASE IF EXISTS "${target.database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${target.database}"`);
  } finally {
    await admin.end();
  }

  const db = new pg.Client({ ...connection, database: target.database });
  await db.connect();
  try {
    for (const file of SQL_FILES) {
      await db.query(readFileSync(file, 'utf8'));
    }
  } finally {
    await db.end();
  }
}

/** Entry point shared by the Playwright globalSetup. */
export async function resetDatabaseForRun(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env.E2E_SKIP_DB_RESET === '1') {
    console.log('[e2e] E2E_SKIP_DB_RESET=1: keeping the current database.');
    return;
  }
  if (env.CI) {
    // CI provisions a fresh Postgres service per job; nothing to reset.
    console.log('[e2e] CI detected: the database is already fresh, skipping reset.');
    return;
  }
  const target = assertSafeToReset(resolveE2eDatabaseUrl(env));
  console.log(`[e2e] Resetting ${target.database} on ${target.host}:${target.port} from database/01_schema.sql + 02_seed.sql`);
  await resetDatabase(target, env);
}
