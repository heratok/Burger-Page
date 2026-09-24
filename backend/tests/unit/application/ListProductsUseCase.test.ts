import { describe, it, expect } from 'vitest';
import { ListProductsUseCase } from '../../../src/application/use-cases/ListProductsUseCase.js';
import { ProductRepository } from '../../../src/domain/ports/out/ProductRepository.js';
import { Product } from '../../../src/domain/models/Product.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';
import { ListOptions } from '../../../src/domain/ports/out/ListOptions.js';

class FakeProductRepository implements ProductRepository {
  findByRestaurantIdOptions: (ListOptions | undefined)[] = [];
  private list: Product[] = [];
  private total = 0;

  setList(products: Product[]): void {
    this.list = products;
    this.total = products.length;
  }

  setTotal(total: number): void {
    this.total = total;
  }

  async findById(): Promise<Product | null> {
    return null;
  }

  async findByRestaurantId(_restaurantId: string, options?: ListOptions): Promise<Product[]> {
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

  async delete(): Promise<void> {}
}

const makeProduct = (id: string, isAvailable = true): Product => ({
  id,
  restaurantId: 'rest-a',
  name: `Product ${id}`,
  description: 'desc',
  price: 10,
  category: 'Burgers',
  isAvailable,
  additions: [],
});

describe('ListProductsUseCase', () => {
  it('without options returns the plain array exactly as before', async () => {
    const list = [makeProduct('p1'), makeProduct('p2')];
    const repo = new FakeProductRepository();
    repo.setList(list);
    const useCase = new ListProductsUseCase(repo);

    const result = await useCase.execute('rest-a', false);

    expect(result).toEqual(list);
    expect(Array.isArray(result)).toBe(true);
    expect(repo.findByRestaurantIdOptions).toEqual([undefined]);
  });

  it('with page/limit options returns { items, total } with total from countByRestaurantId (isAvailableOnly before options)', async () => {
    const list = [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')];
    const repo = new FakeProductRepository();
    repo.setList(list);
    repo.setTotal(38); // count wins over slice length
    const useCase = new ListProductsUseCase(repo);

    const result = await useCase.execute('rest-a', false, { page: 1, limit: 2 });

    expect(result).toEqual({ items: [list[0], list[1]], total: 38 });
    expect(repo.findByRestaurantIdOptions).toEqual([{ page: 1, limit: 2 }]);
  });

  it('page 2 with limit returns the right slice', async () => {
    const list = [makeProduct('p1'), makeProduct('p2'), makeProduct('p3'), makeProduct('p4')];
    const repo = new FakeProductRepository();
    repo.setList(list);
    const useCase = new ListProductsUseCase(repo);

    const result = await useCase.execute('rest-a', false, { page: 2, limit: 2 });

    expect(result).toEqual({ items: [list[2], list[3]], total: 4 });
  });

  it('isAvailableOnly pagination filters BEFORE slicing so the page and total cover available products', async () => {
    const list = [
      makeProduct('p1', true),
      makeProduct('p2', false),
      makeProduct('p3', true),
      makeProduct('p4', false),
      makeProduct('p5', true),
    ];
    const repo = new FakeProductRepository();
    repo.setList(list);
    const useCase = new ListProductsUseCase(repo);

    const result = await useCase.execute('rest-a', true, { page: 1, limit: 2 });

    expect(result).toEqual({ items: [list[0], list[2]], total: 3 });
  });

  it('throws ValidationError on an empty restaurantId', async () => {
    const repo = new FakeProductRepository();
    const useCase = new ListProductsUseCase(repo);

    await expect(useCase.execute('')).rejects.toThrow(ValidationError);
  });
});