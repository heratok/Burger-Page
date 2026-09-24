import { describe, it, expect } from 'vitest';
import { ListOrdersUseCase } from '../../../src/application/use-cases/ListOrdersUseCase.js';
import { OrderRepository } from '../../../src/domain/ports/out/OrderRepository.js';
import { Order, OrderStatus } from '../../../src/domain/models/Order.js';
import { UserRole } from '../../../src/domain/models/User.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';

// Hand-rolled fake (no mocking framework) for the order list use case.
// Review finding T1. Unlike the mutation use cases there is NO rest- prefix
// fallback here: the tenant passed in is forwarded verbatim to the repo.

class FakeOrderRepository implements OrderRepository {
  findByRestaurantIdCalls: string[] = [];

  private listResult: Order[] = [];

  setListResult(orders: Order[]): void {
    this.listResult = orders;
  }

  async findById(): Promise<Order | null> {
    return null;
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    this.findByRestaurantIdCalls.push(restaurantId);
    return this.listResult;
  }

  async save(): Promise<void> {}

  async updateStatus(): Promise<void> {}

  async updateReceipt(): Promise<void> {}

  async delete(): Promise<void> {}

  async update(order: Order): Promise<Order> {
    return order;
  }
}

describe('ListOrdersUseCase', () => {
  it('returns the repository result and forwards the tenant id verbatim', async () => {
    const a = new Order('ord-1', 'rest-a', undefined, [], 'pending', new Date());
    const b = new Order('ord-2', 'rest-a', undefined, [], 'cooking', new Date());
    const repo = new FakeOrderRepository();
    repo.setListResult([a, b]);
    const useCase = new ListOrdersUseCase(repo);

    const result = await useCase.execute('rest-a');

    expect(result).toEqual([a, b]);
    expect(repo.findByRestaurantIdCalls).toEqual(['rest-a']);
  });

  it('passes an empty list through unchanged', async () => {
    const repo = new FakeOrderRepository();
    repo.setListResult([]);
    const useCase = new ListOrdersUseCase(repo);

    const result = await useCase.execute('rest-b');

    expect(result).toEqual([]);
    expect(repo.findByRestaurantIdCalls).toEqual(['rest-b']);
  });

  it('throws ValidationError on an empty restaurantId without touching the repository', async () => {
    const repo = new FakeOrderRepository();
    const useCase = new ListOrdersUseCase(repo);

    await expect(useCase.execute('')).rejects.toThrow(ValidationError);
    expect(repo.findByRestaurantIdCalls).toEqual([]);
  });
});