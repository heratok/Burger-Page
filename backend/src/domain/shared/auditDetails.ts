/**
 * Audit details are free-form JSON written from the application layer. This
 * module is the single choke point that keeps credentials out of them.
 */

/** Keys whose VALUES must never be stored (matched case-insensitively). */
const SECRET_KEY = /pass(word|wd)?|hash|secret|token|authorization|api[-_]?key|credential/i;
const MAX_DEPTH = 5;
const MAX_STRING = 500;

function clean(value: unknown, depth: number): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + '…' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => clean(v, depth + 1)).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) continue;
      const c = clean(v, depth + 1);
      if (c !== undefined) out[key] = c;
    }
    return out;
  }
  return undefined; // functions, symbols, bigint, undefined
}

/** Drops secret-looking keys at any depth, truncates long strings and caps nesting. */
export function sanitizeAuditDetails(details: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!details) return {};
  return (clean(details, 0) as Record<string, unknown>) ?? {};
}

const isScalar = (v: unknown): boolean => v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v);

/**
 * Compares the listed fields of two records. Every changed field is named in
 * `changedFields`; only scalar fields also carry their before/after values
 * (schedules, category lists and other structures are named, not dumped).
 */
export function diffFields(
  before: Record<string, any>,
  after: Record<string, any>,
  fields: readonly string[]
): { changedFields: string[]; changes: Record<string, { from: unknown; to: unknown }> } {
  const changedFields: string[] = [];
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    const from = before[field];
    const to = after[field];
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;
    changedFields.push(field);
    if (isScalar(from) && isScalar(to)) changes[field] = { from: from ?? null, to: to ?? null };
  }
  return { changedFields, changes };
}
