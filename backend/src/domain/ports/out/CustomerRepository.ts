import { Customer } from '../../models/Customer.js';
import { ListOptions } from './ListOptions.js';

export interface CustomerRepository {
  findById(id: string, restaurantId: string): Promise<Customer | null>;
  findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Customer[]>;
  /** Tenant-scoped total count for pagination (optional so test fakes may omit it). */
  countByRestaurantId?(restaurantId: string): Promise<number>;
  findByPhone(phone: string, restaurantId: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
