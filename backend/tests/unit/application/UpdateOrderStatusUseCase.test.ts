import { describe, it, expect } from 'vitest';
import { UpdateOrderStatusUseCase } from '../../../src/application/use-cases/UpdateOrderStatusUseCase.js';
import { OrderRepository } from '../../../src/domain/ports/out/OrderRepository.js';
import { Order, OrderStatus } from '../../../src/domain/models/Order.js';
import { UserRole } from '../../../src/domain/models/User.js';
import {
  EntityNotFoundError,
  InvalidOrderStateError,
  ValidationError,
} from '../../../src/domain/errors/DomainErrors.js';

// Hand-rolled fake (no mocking framework) pinning the order status use case.
// Review finding T1: the order state-machine/CAS behavior shipped untested.
// Key contract (comment M1 in the use case): the repo receives the PREVIOUS
// status as expectedStatus, so a concurrent write is rejected by CAS.

interface UpdateStatusCall {
  id: string;
  status: OrderStatus;
  restaurantId: string;
  actorId?: string;
  actorRole?: UserRole;
  expectedStatus?: OrderStatus;
}

class FakeOrderRepository implements OrderRepository {
  findByIdCalls: Array<{ id: string; restaurantId: string }> = [];
  updateStatusCalls: UpdateStatusCall[] = [];
  updateReceiptCalls: Array<{ id: string; receiptUrl: string; restaurantId: string }> = [];
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
    id: string,
    status: OrderStatus,
    restaurantId: string,
    actorId?: string,
    actorRole?: UserRole,
    expectedStatus?: OrderStatus
  ): Promise<void> {
    this.updateStatusCalls.push({ id, status, restaurantId, actorId, actorRole, expectedStatus });
  }

  async updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void> {
    this.updateReceiptCalls.push({ id, receiptUrl, restaurantId });
  }

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

describe('UpdateOrderStatusUseCase', () => {
  it('persists via updateStatus with the six CAS arguments and returns the transitioned order', async () => {
    const order = makeOrder({ status: 'pending' });
    const repo = new FakeOrderRepository([order]);
    const useCase = new UpdateOrderStatusUseCase(repo);

    const result = await useCase.execute('ord-1', { status: 'cooking' }, 'rest-a', 'usr-1', 'restaurant_admin');

    expect(result.status).toBe('cooking');
    expect(repo.findByIdCalls).toEqual([{ id: 'ord-1', restaurantId: 'rest-a' }]);
    // M1: expectedStatus is the PREVIOUS status ('pending'), not the target.
    expect(repo.updateStatusCalls).toEqual([
      {
        id: 'ord-1',
        status: 'cooking',
        restaurantId: 'rest-a',
        actorId: 'usr-1',
        actorRole: 'restaurant_admin',
        expectedStatus: 'pending',
      },
    ]);
  });

  it('toggles a rest- prefixed restaurant id to resolve the tenant and persists under the resolved id', async () => {
    const order = makeOrder({ restaurantId: 'a', status: 'pending' });
    const repo = new FakeOrderRepository([order]);
    const useCase = new UpdateOrderStatusUseCase(repo);

    const result = await useCase.execute('ord-1', { status: 'cooking' }, 'rest-a', undefined, undefined);

    expect(result.status).toBe('cooking');
    // Primary lookup fails, then the rest- prefix is stripped.
    expect(repo.findByIdCalls).toEqual([
      { id: 'ord-1', restaurantId: 'rest-a' },
      { id: 'ord-1', restaurantId: 'a' },
    ]);
    expect(repo.updateStatusCalls[0].restaurantId).toBe('a');
    expect(repo.updateStatusCalls[0].expectedStatus).toBe('pending');
  });

  it('toggles a bare restaurant id to a rest- prefix as the fallback lookup', async () => {
    const order = makeOrder({ restaurantId: 'rest-a', status: 'cooking' });
    const repo = new FakeOrderRepository([order]);
    const useCase = new UpdateOrderStatusUseCase(repo);

    const result = await useCase.execute('ord-1', { status: 'delivering' }, 'a');

    expect(result.status).toBe('delivering');
    expect(repo.findByIdCalls).toEqual([
      { id: 'ord-1', restaurantId: 'a' },
      { id: 'ord-1', restaurantId: 'rest-a' },
    ]);
    expect(repo.updateStatusCalls[0].restaurantId).toBe('rest-a');
    expect(repo.updateStatusCalls[0].expectedStatus).toBe('cooking');
  });

  it('throws EntityNotFoundError when the order is missing in both tenants and never writes', async () => {
    const repo = new FakeOrderRepository([]);
    const useCase = new UpdateOrderStatusUseCase(repo);

    await expect(
      useCase.execute('ord-ghost', { status: 'cooking' }, 'rest-a')
    ).rejects.toThrow(EntityNotFoundError);
    expect(repo.updateStatusCalls).toEqual([]);
  });

  it('throws ValidationError on an empty restaurantId without touching the repository', async () => {
    const repo = new FakeOrderRepository([]);
    const useCase = new UpdateOrderStatusUseCase(repo);

    await expect(useCase.execute('ord-1', { status: 'cooking' }, '')).rejects.toThrow(ValidationError);
    expect(repo.findByIdCalls).toEqual([]);
    expect(repo.updateStatusCalls).toEqual([]);
  });

  it('throws InvalidOrderStateError on an illegal transition and leaves the order untouched in the repo', async () => {
    const order = makeOrder({ status: 'delivered' });
    const repo = new FakeOrderRepository([order]);
    const useCase = new UpdateOrderStatusUseCase(repo);

    await expect(
      useCase.execute('ord-1', { status: 'cooking' }, 'rest-a')
    ).rejects.toThrow(InvalidOrderStateError);

    // The domain rejected the transition before any persistence call.
    expect(repo.updateStatusCalls).toEqual([]);
    expect(order.status).toBe('delivered');
  });
});
