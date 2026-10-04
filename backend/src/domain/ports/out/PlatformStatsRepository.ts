import { PlatformStats, PlatformStatsFilter } from '../../models/PlatformStats.js';

/**
 * Read-only platform-wide aggregates for the super admin. Implementations
 * count live restaurants only (soft-deleted ones and their orders/customers
 * are excluded) and must not need every tenant's rows loaded in memory.
 */
export interface PlatformStatsRepository {
  get(filter: PlatformStatsFilter): Promise<PlatformStats>;
}
