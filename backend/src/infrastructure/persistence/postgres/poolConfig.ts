export const DEFAULT_PG_POOL_MAX = 10;
const MIN_PG_POOL_MAX = 1;
const MAX_PG_POOL_MAX = 100;

/**
 * Parses the PG_POOL_MAX env value: a positive integer clamped to 1..100.
 * Missing or invalid input (non-numeric, zero, negative, fractional) yields
 * the default so a typo can never produce a pool that cannot connect.
 */
export function parsePoolMax(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return DEFAULT_PG_POOL_MAX;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < MIN_PG_POOL_MAX) return DEFAULT_PG_POOL_MAX;
  return Math.min(parsed, MAX_PG_POOL_MAX);
}
