import { describe, it, expect } from 'vitest';
import { ListCustomersUseCase } from '../../../src/application/use-cases/ListCustomersUseCase.js';
import { CustomerRepository } from '../../../src/domain/ports/out/CustomerRepository.js';
import { Customer } from '../../../src/domain/models/Customer.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';
import { ListOptions } from '../../../src/domain/ports/out/ListOptions.js';

class FakeCustomerRepository implements CustomerRepository {
  findByRestaurantIdOptions: (ListOptions | undefined)[] = [];
  private list: Customer[] = [];
  private total = 0;

  setList(customers: Customer[]): void {
    this.list = customers;
    this.total = customers.length;
  }

  setTotal(total: number): void {
    this.total = total;
  }

  async findById(): Promise<Customer | null> {
    return null;
  }

  async findByRestaurantId(_restaurantId: string, options?: ListOptions): Promise<Customer[]> {
    this.findByRestaurantIdOptions.push(options);
    if (options?.limit === undefined) return this.list;
    const page = options.page && options.page >= 1 ? options.page : 1;
    const start = (page - 1) * options.limit;
    return this.list.slice(start, start + options.limit);
  }

  async countByRestaurantId(): Promise<number> {
    return this.total;
  }

  async findByPhone(): Promise<Customer | null> {
    return null;
  }

  async save(): Promise<void> {}

  async delete(): Promise<void> {}
}

const makeCustomer = (id: string): Customer => new Customer(id, 'rest-a', `Customer ${id}`, '555-0100');

describe('ListCustomersUseCase', () => {
  it('without options returns the plain array exactly as before', async () => {
    const list = [makeCustomer('c1'), makeCustomer('c2')];
    const repo = new FakeCustomerRepository();
    repo.setList(list);
    const useCase = new ListCustomersUseCase(repo);

    const result = await useCase.execute('rest-a');

    expect(result).toEqual(list);
    expect(Array.isArray(result)).toBe(true);
    expect(repo.findByRestaurantIdOptions).toEqual([undefined]);
  });

  it('with page/limit options returns { items, total } with total from countByRestaurantId', async () => {
    const list = [makeCustomer('c1'), makeCustomer('c2'), makeCustomer('c3')];
    const repo = new FakeCustomerRepository();
    repo.setList(list);
    repo.setTotal(42); // count wins over slice length
    const useCase = new ListCustomersUseCase(repo);

    const result = await useCase.execute('rest-a', { page: 1, limit: 2 });

    expect(result).toEqual({ items: [list[0], list[1]], total: 42 });
    expect(repo.findByRestaurantIdOptions).toEqual([{ page: 1, limit: 2 }]);
  });

  it('page 2 with limit returns the right slice', async () => {
    const list = [makeCustomer('c1'), makeCustomer('c2'), makeCustomer('c3'), makeCustomer('c4')];
    const repo = new FakeCustomerRepository();
    repo.setList(list);
    const useCase = new ListCustomersUseCase(repo);

    const result = await useCase.execute('rest-a', { page: 2, limit: 2 });

    expect(result).toEqual({ items: [list[2], list[3]], total: 4 });
  });

  it('throws ValidationError on an empty restaurantId', async () => {
    const repo = new FakeCustomerRepository();
    const useCase = new ListCustomersUseCase(repo);

    await expect(useCase.execute('')).rejects.toThrow(ValidationError);
  });
});