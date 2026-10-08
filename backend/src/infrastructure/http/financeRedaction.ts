import type { FastifyRequest } from 'fastify';

/**
 * Server-side money redaction (finance.view). Users without it keep the
 * per-order amounts needed to run orders and print tickets (subtotal, fees,
 * totals, payment), but never cost data or any aggregate. Today the only
 * non-order money field returned by tenant endpoints is the inventory unit
 * cost; the customer API has no spend aggregates and platform-stats / the
 * audit log are super_admin only. Permissions come from the session resolved
 * from storage on this request, never from the token.
 */
export function canViewFinance(req: FastifyRequest): boolean {
  return req.authContext?.permissions.includes('finance.view') === true;
}

/** Drops the unit cost from an inventory response unless finance is allowed. */
export function redactInventoryItem<T extends { costPerUnit?: number }>(item: T, finance: boolean): Omit<T, 'costPerUnit'> | T {
  if (finance) return item;
  const { costPerUnit: _cost, ...rest } = item;
  return rest;
}

/** Removes the cost from a write body so a user without finance.view can neither set nor overwrite it. */
export function omitCostForNonFinance<T extends { costPerUnit?: unknown }>(body: T, finance: boolean): Omit<T, 'costPerUnit'> | T {
  if (finance) return body;
  const { costPerUnit: _cost, ...rest } = body;
  return rest;
}
