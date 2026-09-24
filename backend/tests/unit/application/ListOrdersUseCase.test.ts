import { describe, it, expect } from 'vitest';
import { ListOrdersUseCase } from '../../../src/application/use-cases/ListOrdersUseCase.js';
import { OrderRepository } from '../../../src/domain/ports/out/OrderRepository.js';
import { Order, OrderStatus } from '../../../src/domain/models/Order.js';
import { UserRole } from '../../../src/domain/models/User.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';
import { ListOptions } from '../../../src/domain/ports/out/ListOptions.js';

// Hand-rolled fake (no mocking framework) for the order list use case.
// Review finding T1. Unlike the mutation use cases there is NO rest- prefix
// fallback here: the tenant passed in is forwarded verbatim to the repo.
// Simulates the driver slice contract: with `options.limit` it returns the
// page slice and exposes a configurable tenant-scoped total.

class FakeOrderRepository implements OrderRepository {
  findByRestaurantIdCalls: string[] = [];
  findByRestaurantIdOptions: (ListOptions | undefined)[] = [];

  private listResult: Order[] = [];

  private total = 0;

  setListResult(orders: Order[]): void {
    this.listResult = orders;
    this.total = orders.length;
  }

  setTotal(total: number): void {
    this.total = total;
  }

  async findById(): Promise<Order | null> {
    return null;
  }

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Order[]> {
    this.findByRestaurantIdCalls.push(restaurantId);
    this.findByRestaurantIdOptions.push(options);
    if (options?.limit === undefined) return this.listResult;
    const page = options.page && options.page >= 1 ? options.page : 1;
    const start = (page - 1) * options.limit;
    return this.listResult.slice(start, start + options.limit);
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return this.total;
  }

  async save(): Promise<void> {}

  async updateStatus(): Promise<void> {}

  async updateReceipt(): Promise<void> {}

  async delete(): Promise<void> {}

  async update(order: Order): Promise<Order> {
    return order;
  }
}

const makeOrder = (id: string): Order => {
  const order = new Order(id, 'rest-a', undefined, [], 'pending', new Date());
  (order as any).orderNumber = 0;
  return order;
};

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

  it('with page/limit options returns { items, total } with total from countByRestaurantId', async () => {
    const orders = [makeOrder('ord-1'), makeOrder('ord-2'), makeOrder('ord-3')];
    const repo = new FakeOrderRepository();
    repo.setListResult(orders);
    repo.setTotal(99); // DB-scoped count must win, not the slice length
    const useCase = new ListOrdersUseCase(repo);

    const result = await useCase.execute('rest-a', { page: 1, limit: 2 });

    expect(result).toEqual({ items: [orders[0], orders[1]], total: 99 });
    expect(repo.findByRestaurantIdCalls).toEqual(['rest-a']);
    expect(repo.findByRestaurantIdOptions).toEqual([{ page: 1, limit: 2 }]);
  });

  it('page 2 with limit returns the right slice', async () => {
    const orders = [makeOrder('ord-1'), makeOrder('ord-2'), makeOrder('ord-3'), makeOrder('ord-4'), makeOrder('ord-5')];
    const repo = new FakeOrderRepository();
    repo.setListResult(orders);
    const useCase = new ListOrdersUseCase(repo);

    const result = await useCase.execute('rest-a', { page: 2, limit: 2 });

    expect(result).toEqual({ items: [orders[2], orders[3]], total: 5 });
  });
});