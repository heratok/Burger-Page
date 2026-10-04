import { describe, it, expect } from 'vitest';
import { ComposedPlatformStatsRepository } from '../../src/infrastructure/persistence/ComposedPlatformStatsRepository.js';
import type { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import type { OrderRepository } from '../../src/domain/ports/out/OrderRepository.js';
import type { CustomerRepository } from '../../src/domain/ports/out/CustomerRepository.js';

const order = (status: string, finalTotal: number, createdAt: string) => ({ status, finalTotal, createdAt: new Date(createdAt) });

function build() {
  // findAll() is the port's "live restaurants" listing: soft-deleted ones never come back.
  const restaurants = [
    { id: 'r1', isActive: true },
    { id: 'r2', isActive: false },
  ];
  const orders: Record<string, ReturnType<typeof order>[]> = {
    r1: [
      order('delivered', 100, '2026-01-10T10:00:00Z'),
      order('cancelled', 900, '2026-01-11T10:00:00Z'),
      order('pending', 50, '2026-02-01T00:00:00Z'),
    ],
    r2: [order('delivered', 25, '2026-01-31T23:59:59.999Z')],
    deleted: [order('delivered', 7777, '2026-01-10T10:00:00Z')],
  };
  const customers: Record<string, unknown[]> = { r1: [{}, {}], r2: [{}], deleted: [{}, {}, {}] };

  const restaurantRepo = { findAll: async () => restaurants } as unknown as RestaurantRepository;
  const orderRepo = { findByRestaurantId: async (id: string) => orders[id] ?? [] } as unknown as OrderRepository;
  const customerRepo = { findByRestaurantId: async (id: string) => customers[id] ?? [] } as unknown as CustomerRepository;
  return new ComposedPlatformStatsRepository(restaurantRepo, orderRepo, customerRepo);
}

describe('ComposedPlatformStatsRepository (memory/sqlite drivers)', () => {
  it('totals live restaurants only; revenue skips cancelled orders but the order count keeps them', async () => {
    expect(await build().get({})).toEqual({
      totalRevenue: 175,
      totalOrders: 4,
      totalCustomers: 3,
      totalRestaurants: 2,
      activeRestaurants: 1,
    });
  });

  it('applies the half-open orders window and leaves restaurant and customer totals alone', async () => {
    const stats = await build().get({ ordersFrom: '2026-01-11T00:00:00.000Z', ordersBefore: '2026-02-01T00:00:00.000Z' });
    // cancelled r1 order (counted, no money) + r2 order on the last millisecond; the Feb-1 order is excluded
    expect(stats).toEqual({ totalRevenue: 25, totalOrders: 2, totalCustomers: 3, totalRestaurants: 2, activeRestaurants: 1 });
  });

  it('is all zeros on an empty platform', async () => {
    const empty = new ComposedPlatformStatsRepository(
      { findAll: async () => [] } as unknown as RestaurantRepository,
      {} as OrderRepository,
      {} as CustomerRepository
    );
    expect(await empty.get({})).toEqual({ totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalRestaurants: 0, activeRestaurants: 0 });
  });
});
