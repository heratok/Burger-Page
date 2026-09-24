import { describe, it, expect } from 'vitest';
import { ListProductAdditionsUseCase } from '../../../src/application/use-cases/ListProductAdditionsUseCase.js';
import { ProductAdditionRepository } from '../../../src/domain/ports/out/ProductAdditionRepository.js';
import { ProductAddition } from '../../../src/domain/models/ProductAddition.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';
import { ListOptions } from '../../../src/domain/ports/out/ListOptions.js';

class FakeAdditionRepository implements ProductAdditionRepository {
  findByRestaurantIdCalls: (string | undefined)[] = [];
  findByProductIdCalls: (string | undefined)[] = [];
  private list: ProductAddition[] = [];
  private total = 0;

  setList(additions: ProductAddition[]): void {
    this.list = additions;
    this.total = additions.length;
  }

  setTotal(total: number): void {
    this.total = total;
  }

  async findById(): Promise<ProductAddition | null> {
    return null;
  }

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<ProductAddition[]> {
    this.findByRestaurantIdCalls.push(restaurantId, options === undefined ? undefined : JSON.stringify(options));
    if (options?.limit === undefined) return this.list;
    const page = options.page && options.page >= 1 ? options.page : 1;
    const start = (page - 1) * options.limit;
    return this.list.slice(start, start + options.limit);
  }

  async countByRestaurantId(): Promise<number> {
    return this.total;
  }

  async findByProductId(productId: string, _restaurantId: string): Promise<ProductAddition[]> {
    this.findByProductIdCalls.push(productId);
    return this.list;
  }

  async save(): Promise<void> {}

  async delete(): Promise<void> {}
}

const makeAddition = (id: string, productId?: string): ProductAddition =>
  new ProductAddition(id, 'rest-a', `Addition ${id}`, 2000, true, productId, 0);

describe('ListProductAdditionsUseCase', () => {
  it('without options returns the plain array exactly as before', async () => {
    const list = [makeAddition('add-1'), makeAddition('add-2')];
    const repo = new FakeAdditionRepository();
    repo.setList(list);
    const useCase = new ListProductAdditionsUseCase(repo);

    const result = await useCase.execute('rest-a');

    expect(result).toEqual(list);
    expect(Array.isArray(result)).toBe(true);
  });

  it('with page/limit options returns { items, total } with total from countByRestaurantId (productId before options)', async () => {
    const list = [makeAddition('add-1'), makeAddition('add-2'), makeAddition('add-3')];
    const repo = new FakeAdditionRepository();
    repo.setList(list);
    repo.setTotal(12); // count wins over slice length
    const useCase = new ListProductAdditionsUseCase(repo);

    const result = await useCase.execute('rest-a', undefined, { page: 1, limit: 2 });

    expect(result).toEqual({ items: [list[0], list[1]], total: 12 });
  });

  it('page 2 with limit returns the right slice', async () => {
    const list = [makeAddition('add-1'), makeAddition('add-2'), makeAddition('add-3'), makeAddition('add-4')];
    const repo = new FakeAdditionRepository();
    repo.setList(list);
    const useCase = new ListProductAdditionsUseCase(repo);

    const result = await useCase.execute('rest-a', undefined, { page: 2, limit: 2 });

    expect(result).toEqual({ items: [list[2], list[3]], total: 4 });
  });

  it('with productId the page slice and total cover the per-product filtered set', async () => {
    const list = [makeAddition('add-1', 'prod-1'), makeAddition('add-2', 'prod-1'), makeAddition('add-3', 'prod-1')];
    const repo = new FakeAdditionRepository();
    repo.setList(list);
    const useCase = new ListProductAdditionsUseCase(repo);

    const result = await useCase.execute('rest-a', 'prod-1', { page: 1, limit: 2 });

    expect(repo.findByProductIdCalls).toEqual(['prod-1']);
    expect(result.items).toEqual([list[0], list[1]]);
    expect((result as { total: number }).total).toBe(3);
  });

  it('throws ValidationError on an empty restaurantId', async () => {
    const repo = new FakeAdditionRepository();
    const useCase = new ListProductAdditionsUseCase(repo);

    await expect(useCase.execute('')).rejects.toThrow(ValidationError);
  });
});