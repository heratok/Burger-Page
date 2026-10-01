import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDir = resolve(__dirname, '../../../../../database/migrations');

/**
 * Returns the SQL of one "-- ── T<n>." section of a migration file (up to the
 * next "-- ── T<n>." marker), so the data logic of a single hardening task can
 * be executed against a scratch database.
 */
export function migrationSection(file: string, id: string): string {
  const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
  const start = sql.indexOf(`-- ── ${id}.`);
  if (start < 0) throw new Error(`section ${id} not found in ${file}`);
  const rest = sql.slice(start + 1);
  const next = rest.search(/\n-- ── T\d+\./);
  return next < 0 ? sql.slice(start) : sql.slice(start, start + 1 + next);
}

export const upSection = (id: string) => migrationSection('0000000000008_db_hardening.up.sql', id);
export const downSection = (id: string) => migrationSection('0000000000008_db_hardening.down.sql', id);
