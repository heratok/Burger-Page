/**
 * Canonical storage-driver selection (D3 hygiene).
 *
 * The precedence rule used to live — with drift — in buildDependencies(),
 * the /health route and src/index.ts. This module is the single source of
 * truth so every call site resolves the same driver:
 *
 *   1. explicit argument
 *   2. `process.env.STORAGE_DRIVER` (must be one of the four lowercase names;
 *      anything else, uppercase included, falls through)
 *   3. `SUPABASE_URL` set -> 'supabase'
 *   4. `DATABASE_URL` set -> 'postgres'
 *   5. 'memory'
 */

export type StorageDriver = 'memory' | 'sqlite' | 'supabase' | 'postgres';

const VALID_DRIVERS: readonly StorageDriver[] = ['memory', 'sqlite', 'supabase', 'postgres'];

export function resolveStorageDriver(explicit?: StorageDriver): StorageDriver {
  if (explicit !== undefined) return explicit;
  const env = process.env.STORAGE_DRIVER;
  if (env !== undefined && (VALID_DRIVERS as readonly string[]).includes(env)) {
    return env as StorageDriver;
  }
  if (process.env.SUPABASE_URL) return 'supabase';
  if (process.env.DATABASE_URL) return 'postgres';
  return 'memory';
}

/**
 * True when the resolved driver runs every data query through the Postgres
 * pooler. Since S5 both 'postgres' and 'supabase' share that pool (they
 * differ only in where files are stored).
 */
export function dataRunsOnPostgres(driver: StorageDriver): boolean {
  return driver === 'postgres' || driver === 'supabase';
}