import { PlatformStats, PlatformStatsFilter } from '../../../domain/models/PlatformStats.js';
import { PlatformStatsRepository } from '../../../domain/ports/out/PlatformStatsRepository.js';
import { withTenantContext } from './PgClient.js';

// Platform data: RLS only lets a super_admin session read across tenants, so
// the aggregate runs under that role. The route guard decides who gets here.
const PLATFORM = { restaurantId: null, actorRole: 'super_admin' as const };

/**
 * Every total comes from one statement (a single round trip) so the numbers
 * are consistent with each other and nothing is summed in application memory.
 * Soft-deleted restaurants are dropped once in `live`; their orders and
 * customers disappear with them through the joins. Counts and sums are cast to
 * int/float8 so the driver returns numbers instead of bigint/numeric strings.
 */
const SQL = `
  WITH live AS (
    SELECT id, is_active FROM public.restaurants WHERE deleted_at IS NULL
  ),
  o AS (
    SELECT COALESCE(SUM(ord.final_total) FILTER (WHERE ord.status <> 'cancelled'), 0)::float8 AS revenue,
           COUNT(*)::int AS orders
      FROM public.orders ord
      JOIN live ON live.id = ord.restaurant_id
     WHERE ($1::timestamptz IS NULL OR ord.created_at >= $1::timestamptz)
       AND ($2::timestamptz IS NULL OR ord.created_at <  $2::timestamptz)
  ),
  c AS (
    SELECT COUNT(*)::int AS customers
      FROM public.customers cus
      JOIN live ON live.id = cus.restaurant_id
  ),
  r AS (
    SELECT COUNT(*)::int AS restaurants,
           (COUNT(*) FILTER (WHERE is_active))::int AS active
      FROM live
  )
  SELECT o.revenue, o.orders, c.customers, r.restaurants, r.active
    FROM o, c, r`;

export class PgPlatformStatsRepository implements PlatformStatsRepository {
  async get(filter: PlatformStatsFilter): Promise<PlatformStats> {
    const row = await withTenantContext(PLATFORM, async (client) => {
      const { rows } = await client.query(SQL, [filter.ordersFrom ?? null, filter.ordersBefore ?? null]);
      return rows[0];
    });
    return {
      totalRevenue: row.revenue,
      totalOrders: row.orders,
      totalCustomers: row.customers,
      totalRestaurants: row.restaurants,
      activeRestaurants: row.active,
    };
  }
}
