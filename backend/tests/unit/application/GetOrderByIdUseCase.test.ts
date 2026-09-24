import { describe, it, expect } from 'vitest';
import { GetOrderByIdUseCase } from '../../../src/application/use-cases/GetOrderByIdUseCase.js';
import { OrderRepository } from '../../../src/domain/ports/out/OrderRepository.js';
import { Order, OrderStatus } from '../../../src/domain/models/Order.js';
import { UserRole } from '../../../src/domain/models/User.js';
import {
  EntityNotFoundError,
  ValidationError,
} from '../../../src/domain/errors/DomainErrors.js';

// Hand-rolled fake (no mocking framework) for the get-by-id use case.
// Review finding T1. It implements the rest- prefix fallback (stripping for
// 'rest-x', prefixing for bare 'x') but never persists, so the fallback is
// read-only: it returns whatever order the alternate tenant lookup found.

class FakeOrderRepository implements OrderRepository {
  findByIdCalls: Array<{ id: string; restaurantId: string }> = [];

  constructor(private readonly orders: Order[] = []) {}

  private findStored(id: string, restaurantId: string): Order | null {
    return this.orders.find((o) => o.id === id && o.restaurantId === restaurantId) ?? null;
  }

  async findById(id: string, restaurantId: string): Promise<Order | null> {
    this.findByIdCalls.push({ id, restaurantId });
    return this.findStored(id, restaurantId);
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    return this.orders.filter((o) => o.restaurantId === restaurantId);
  }

  async save(): Promise<void> {}

  async updateStatus(
    _id: string,
    _status: OrderStatus,
    _restaurantId: string,
    _actorId?: string,
    _actorRole?: UserRole,
    _expectedStatus?: OrderStatus
  ): Promise<void> {}

  async updateReceipt(): Promise<void> {}

  async delete(): Promise<void> {}

  async update(order: Order): Promise<Order> {
    return order;
  }
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const order = new Order(
    'ord-1',
    'rest-a',
    undefined,
    [],
    'pending',
    new Date('2024-01-01T00:00:00.000Z')
  );
  return Object.assign(order, overrides);
}

describe('GetOrderByIdUseCase', () => {
  it('returns the order for the given tenant', async () => {
    const order = makeOrder();
    const repo = new FakeOrderRepository([order]);
    const useCase = new GetOrderByIdUseCase(repo);

    const result = await useCase.execute('ord-1', 'rest-a');

    expect(result).toBe(order);
    expect(repo.findByIdCalls).toEqual([{ id: 'ord-1', restaurantId: 'rest-a' }]);
  });

  it('falls back to the rest- stripped tenant id without persisting anything', async () => {
    const order = makeOrder({ restaurantId: 'a' });
    const repo = new FakeOrderRepository([order]);
    const useCase = new GetOrderByIdUseCase(repo);

    const result = await useCase.execute('ord-1', 'rest-a');

    expect(result).toBe(order);
    expect(repo.findByIdCalls).toEqual([
      { id: 'ord-1', restaurantId: 'rest-a' },
      { id: 'ord-1', restaurantId: 'a' },
    ]);
  });

  it('falls back to the rest- prefixed tenant id for a bare restaurant id', async () => {
    const order = makeOrder({ restaurantId: 'rest-a' });
    const repo = new FakeOrderRepository([order]);
    const useCase = new GetOrderByIdUseCase(repo);

    const result = await useCase.execute('ord-1', 'a');

    expect(result).toBe(order);
    expect(repo.findByIdCalls).toEqual([
      { id: 'ord-1', restaurantId: 'a' },
      { id: 'ord-1', restaurantId: 'rest-a' },
    ]);
  });

  it('throws EntityNotFoundError when the order is missing in both tenants', async () => {
    const repo = new FakeOrderRepository([]);
    const useCase = new GetOrderByIdUseCase(repo);

    await expect(useCase.execute('ord-ghost', 'rest-a')).rejects.toThrow(EntityNotFoundError);
    expect(repo.findByIdCalls).toEqual([
      { id: 'ord-ghost', restaurantId: 'rest-a' },
      { id: 'ord-ghost', restaurantId: 'a' },
    ]);
  });

  it('throws ValidationError on an empty restaurantId without touching the repository', async () => {
    const repo = new FakeOrderRepository([]);
    const useCase = new GetOrderByIdUseCase(repo);

    await expect(useCase.execute('ord-1', '')).rejects.toThrow(ValidationError);
    expect(repo.findByIdCalls).toEqual([]);
  });
});