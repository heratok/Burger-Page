import { describe, it, expect } from 'vitest';
import { DeleteOrderUseCase } from '../../../src/application/use-cases/DeleteOrderUseCase.js';
import { OrderRepository } from '../../../src/domain/ports/out/OrderRepository.js';
import { Order, OrderStatus } from '../../../src/domain/models/Order.js';
import { UserRole } from '../../../src/domain/models/User.js';
import {
  EntityNotFoundError,
  ValidationError,
} from '../../../src/domain/errors/DomainErrors.js';

// Hand-rolled fake (no mocking framework) for the order delete use case.
// Review finding T1. Pinned behavior: a missing order is NOT a silent no-op —
// the use case throws EntityNotFoundError after trying both tenants.

class FakeOrderRepository implements OrderRepository {
  findByIdCalls: Array<{ id: string; restaurantId: string }> = [];
  deleteCalls: Array<{ id: string; restaurantId: string }> = [];

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

  async delete(id: string, restaurantId: string): Promise<void> {
    this.deleteCalls.push({ id, restaurantId });
  }

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

describe('DeleteOrderUseCase', () => {
  it('deletes the order under the given tenant and returns it', async () => {
    const order = makeOrder();
    const repo = new FakeOrderRepository([order]);
    const useCase = new DeleteOrderUseCase(repo);

    const result = await useCase.execute('ord-1', 'rest-a');

    expect(result).toBe(order);
    expect(repo.deleteCalls).toEqual([{ id: 'ord-1', restaurantId: 'rest-a' }]);
    expect(repo.findByIdCalls).toEqual([{ id: 'ord-1', restaurantId: 'rest-a' }]);
  });

  it('deletes under the resolved tenant when the rest- prefix fallback finds the order', async () => {
    const order = makeOrder({ restaurantId: 'a' });
    const repo = new FakeOrderRepository([order]);
    const useCase = new DeleteOrderUseCase(repo);

    const result = await useCase.execute('ord-1', 'rest-a');

    expect(result).toBe(order);
    expect(repo.findByIdCalls).toEqual([
      { id: 'ord-1', restaurantId: 'rest-a' },
      { id: 'ord-1', restaurantId: 'a' },
    ]);
    expect(repo.deleteCalls).toEqual([{ id: 'ord-1', restaurantId: 'a' }]);
  });

  it('throws EntityNotFoundError when the order is missing in both tenants and never deletes', async () => {
    const repo = new FakeOrderRepository([]);
    const useCase = new DeleteOrderUseCase(repo);

    await expect(useCase.execute('ord-ghost', 'rest-a')).rejects.toThrow(EntityNotFoundError);
    expect(repo.deleteCalls).toEqual([]);
  });

  it('throws ValidationError on an empty restaurantId without touching the repository', async () => {
    const repo = new FakeOrderRepository([]);
    const useCase = new DeleteOrderUseCase(repo);

    await expect(useCase.execute('ord-1', '')).rejects.toThrow(ValidationError);
    expect(repo.findByIdCalls).toEqual([]);
    expect(repo.deleteCalls).toEqual([]);
  });
});