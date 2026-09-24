import { describe, it, expect } from 'vitest';
import { UpdateOrderReceiptUseCase } from '../../../src/application/use-cases/UpdateOrderReceiptUseCase.js';
import { OrderRepository } from '../../../src/domain/ports/out/OrderRepository.js';
import { Order, OrderStatus } from '../../../src/domain/models/Order.js';
import { UserRole } from '../../../src/domain/models/User.js';
import {
  EntityNotFoundError,
  ValidationError,
} from '../../../src/domain/errors/DomainErrors.js';

// Hand-rolled fake (no mocking framework) for the receipt update use case.
// Review finding T1. It shares the same tenant-toggling fallback pattern as the
// other order use cases and persists through updateReceipt(id, url, restId).

class FakeOrderRepository implements OrderRepository {
  findByIdCalls: Array<{ id: string; restaurantId: string }> = [];
  updateReceiptCalls: Array<{ id: string; receiptUrl: string; restaurantId: string }> = [];

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

  async updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void> {
    this.updateReceiptCalls.push({ id, receiptUrl, restaurantId });
  }

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

describe('UpdateOrderReceiptUseCase', () => {
  it('calls updateReceipt with the resolved tenant and returns the order carrying the receiptUrl', async () => {
    const order = makeOrder();
    const repo = new FakeOrderRepository([order]);
    const useCase = new UpdateOrderReceiptUseCase(repo);

    const result = await useCase.execute('ord-1', { receiptUrl: 'https://cdn/receipt.png' }, 'rest-a');

    expect(result.receiptUrl).toBe('https://cdn/receipt.png');
    expect(repo.findByIdCalls).toEqual([{ id: 'ord-1', restaurantId: 'rest-a' }]);
    expect(repo.updateReceiptCalls).toEqual([
      { id: 'ord-1', receiptUrl: 'https://cdn/receipt.png', restaurantId: 'rest-a' },
    ]);
  });

  it('resolves the tenant through the rest- prefix fallback and persists under the resolved id', async () => {
    const order = makeOrder({ restaurantId: 'a' });
    const repo = new FakeOrderRepository([order]);
    const useCase = new UpdateOrderReceiptUseCase(repo);

    const result = await useCase.execute('ord-1', { receiptUrl: 'https://cdn/r.png' }, 'rest-a');

    expect(result.receiptUrl).toBe('https://cdn/r.png');
    expect(repo.findByIdCalls).toEqual([
      { id: 'ord-1', restaurantId: 'rest-a' },
      { id: 'ord-1', restaurantId: 'a' },
    ]);
    expect(repo.updateReceiptCalls[0].restaurantId).toBe('a');
  });

  it('throws EntityNotFoundError when the order is missing in both tenants and never writes', async () => {
    const repo = new FakeOrderRepository([]);
    const useCase = new UpdateOrderReceiptUseCase(repo);

    await expect(
      useCase.execute('ord-ghost', { receiptUrl: 'https://cdn/x.png' }, 'rest-a')
    ).rejects.toThrow(EntityNotFoundError);
    expect(repo.updateReceiptCalls).toEqual([]);
  });

  it('throws ValidationError on an empty restaurantId without touching the repository', async () => {
    const repo = new FakeOrderRepository([]);
    const useCase = new UpdateOrderReceiptUseCase(repo);

    await expect(useCase.execute('ord-1', { receiptUrl: 'https://cdn/x.png' }, '')).rejects.toThrow(
      ValidationError
    );
    expect(repo.findByIdCalls).toEqual([]);
    expect(repo.updateReceiptCalls).toEqual([]);
  });
});
