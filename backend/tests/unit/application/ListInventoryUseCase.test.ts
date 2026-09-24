import { describe, it, expect } from 'vitest';
import { ListInventoryUseCase } from '../../../src/application/use-cases/ListInventoryUseCase.js';
import { InventoryRepository } from '../../../src/domain/ports/out/InventoryRepository.js';
import { Inventory } from '../../../src/domain/models/Inventory.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';
import { ListOptions } from '../../../src/domain/ports/out/ListOptions.js';

class FakeInventoryRepository implements InventoryRepository {
  findByRestaurantIdOptions: (ListOptions | undefined)[] = [];
  private list: Inventory[] = [];
  private total = 0;

  setList(items: Inventory[]): void {
    this.list = items;
    this.total = items.length;
  }

  setTotal(total: number): void {
    this.total = total;
  }

  async findById(): Promise<Inventory | null> {
    return null;
  }

  async findByRestaurantId(_restaurantId: string, options?: ListOptions): Promise<Inventory[]> {
    this.findByRestaurantIdOptions.push(options);
    if (options?.limit === undefined) return this.list;
    const page = options.page && options.page >= 1 ? options.page : 1;
    const start = (page - 1) * options.limit;
    return this.list.slice(start, start + options.limit);
  }

  async countByRestaurantId(): Promise<number> {
    return this.total;
  }

  async save(): Promise<void> {}

  async adjustStock(id: string, restaurantId: string, delta: number): Promise<Inventory> {
    return this.list[0];
  }

  async delete(): Promise<void> {}
}

const makeItem = (id: string): Inventory => ({
  id,
  restaurantId: 'rest-a',
  name: `Item ${id}`,
  category: 'ingredients',
  quantity: 10,
  unit: 'unidades',
  minStockAlert: 5,
  alertThreshold: 5,
  costPerUnit: 1000,
});

describe('ListInventoryUseCase', () => {
  it('without options returns the plain array exactly as before', async () => {
    const list = [makeItem('i1'), makeItem('i2')];
    const repo = new FakeInventoryRepository();
    repo.setList(list);
    const useCase = new ListInventoryUseCase(repo);

    const result = await useCase.execute('rest-a');

    expect(result).toEqual(list);
    expect(Array.isArray(result)).toBe(true);
    expect(repo.findByRestaurantIdOptions).toEqual([undefined]);
  });

  it('with page/limit options returns { items, total } with total from countByRestaurantId', async () => {
    const list = [makeItem('i1'), makeItem('i2'), makeItem('i3')];
    const repo = new FakeInventoryRepository();
    repo.setList(list);
    repo.setTotal(7); // count wins over slice length
    const useCase = new ListInventoryUseCase(repo);

    const result = await useCase.execute('rest-a', { page: 1, limit: 2 });

    expect(result).toEqual({ items: [list[0], list[1]], total: 7 });
    expect(repo.findByRestaurantIdOptions).toEqual([{ page: 1, limit: 2 }]);
  });

  it('page 2 with limit returns the right slice', async () => {
    const list = [makeItem('i1'), makeItem('i2'), makeItem('i3'), makeItem('i4')];
    const repo = new FakeInventoryRepository();
    repo.setList(list);
    const useCase = new ListInventoryUseCase(repo);

    const result = await useCase.execute('rest-a', { page: 2, limit: 2 });

    expect(result).toEqual({ items: [list[2], list[3]], total: 4 });
  });

  it('throws ValidationError on an empty restaurantId', async () => {
    const repo = new FakeInventoryRepository();
    const useCase = new ListInventoryUseCase(repo);

    await expect(useCase.execute('')).rejects.toThrow(ValidationError);
  });
});