import type { PlatformStats } from '@burger-page/contracts';

export type { PlatformStats };

/**
 * Narrows the ORDERS that are counted (revenue and order total) to a
 * half-open window on created_at. Restaurant and customer totals are never
 * filtered by it.
 */
export interface PlatformStatsFilter {
  /** Inclusive lower bound, ISO 8601 timestamp. */
  ordersFrom?: string;
  /** Exclusive upper bound, ISO 8601 timestamp. */
  ordersBefore?: string;
}
