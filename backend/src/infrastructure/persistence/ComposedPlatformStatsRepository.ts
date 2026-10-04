import { PlatformStats, PlatformStatsFilter } from '../../domain/models/PlatformStats.js';
import { PlatformStatsRepository } from '../../domain/ports/out/PlatformStatsRepository.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';

/**
 * Platform stats for the in-process drivers (memory, sqlite), built from the
 * other repositories. Their data already lives in this process, so folding it
 * here costs nothing; the Postgres driver has its own single-statement
 * aggregate instead (PgPlatformStatsRepository). RestaurantRepository.findAll
 * lists live restaurants only, which is what excludes soft-deleted tenants and,
 * through them, their orders and customers.
 */
export class ComposedPlatformStatsRepository implements PlatformStatsRepository {
  constructor(
    private readonly restaurants: RestaurantRepository,
    private readonly orders: OrderRepository,
    private readonly customers: CustomerRepository
  ) {}

  async get(filter: PlatformStatsFilter): Promise<PlatformStats> {
    const from = filter.ordersFrom ? Date.parse(filter.ordersFrom) : undefined;
    const before = filter.ordersBefore ? Date.parse(filter.ordersBefore) : undefined;

    const live = await this.restaurants.findAll();
    const stats: PlatformStats = {
      totalRevenue: 0,
      totalOrders: 0,
      cancelledOrders: 0,
      totalCustomers: 0,
      totalRestaurants: live.length,
      activeRestaurants: live.filter((r) => r.isActive).length,
    };

    for (const restaurant of live) {
      const [orders, customers] = await Promise.all([
        this.orders.findByRestaurantId(restaurant.id),
        this.customers.findByRestaurantId(restaurant.id),
      ]);
      stats.totalCustomers += customers.length;
      for (const order of orders) {
        const at = new Date(order.createdAt).getTime();
        if (from !== undefined && at < from) continue;
        if (before !== undefined && at >= before) continue;
        if (order.status === 'cancelled') {
          stats.cancelledOrders += 1;
        } else {
          stats.totalOrders += 1;
          stats.totalRevenue += order.finalTotal;
        }
      }
    }
    return stats;
  }
}
