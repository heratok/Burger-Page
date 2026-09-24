import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { Customer } from '../../domain/models/Customer.js';
import { ListOptions } from '../../domain/ports/out/ListOptions.js';
import { initialCustomers } from './seedData.js';

export class InMemoryCustomerRepository implements CustomerRepository {
  private customers: Map<string, Customer> = new Map();

  constructor() {
    for (const c of initialCustomers) {
      this.customers.set(c.id, new Customer(
        c.id,
        c.restaurantId,
        c.name,
        c.phone,
        c.address,
        c.barrio,
        c.notes,
        c.email,
        c.createdAt,
        c.updatedAt
      ));
    }
  }

  async findById(id: string, restaurantId: string): Promise<Customer | null> {
    const customer = this.customers.get(id);
    if (!customer) return null;
    if (customer.restaurantId !== restaurantId) return null;
    return new Customer(
      customer.id,
      customer.restaurantId,
      customer.name,
      customer.phone,
      customer.address,
      customer.barrio,
      customer.notes,
      customer.email,
      customer.createdAt,
      customer.updatedAt
    );
  }

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Customer[]> {
    const filtered = Array.from(this.customers.values()).filter((c) => c.restaurantId === restaurantId);
    const limit = options?.limit;
    const clone = (c: Customer): Customer => new Customer(
      c.id,
      c.restaurantId,
      c.name,
      c.phone,
      c.address,
      c.barrio,
      c.notes,
      c.email,
      c.createdAt,
      c.updatedAt
    );
    if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
      const page = options?.page && Number.isInteger(options.page) && options.page >= 1 ? options.page : 1;
      const start = (page - 1) * limit;
      return filtered.slice(start, start + limit).map(clone);
    }
    return filtered.map(clone);
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return Array.from(this.customers.values()).filter((c) => c.restaurantId === restaurantId).length;
  }

  async findByPhone(phone: string, restaurantId: string): Promise<Customer | null> {
    const customer = Array.from(this.customers.values()).find(
      (c) => c.phone === phone && c.restaurantId === restaurantId
    );
    if (!customer) return null;
    return new Customer(
      customer.id,
      customer.restaurantId,
      customer.name,
      customer.phone,
      customer.address,
      customer.barrio,
      customer.notes,
      customer.email,
      customer.createdAt,
      customer.updatedAt
    );
  }

  async save(customer: Customer): Promise<void> {
    this.customers.set(customer.id, new Customer(
      customer.id,
      customer.restaurantId,
      customer.name,
      customer.phone,
      customer.address,
      customer.barrio,
      customer.notes,
      customer.email,
      customer.createdAt,
      customer.updatedAt
    ));
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const customer = this.customers.get(id);
    if (customer && customer.restaurantId === restaurantId) {
      this.customers.delete(id);
    }
  }

  clear(): void {
    this.customers.clear();
  }
}
