import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { Customer } from '../../domain/models/Customer.js';
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

  async findByRestaurantId(restaurantId: string): Promise<Customer[]> {
    return Array.from(this.customers.values())
      .filter((c) => c.restaurantId === restaurantId)
      .map((c) => new Customer(
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
