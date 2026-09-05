import { Customer } from '../../models/Customer.js';

export interface CustomerRepository {
  findById(id: string, restaurantId: string): Promise<Customer | null>;
  findByRestaurantId(restaurantId: string): Promise<Customer[]>;
  findByPhone(phone: string, restaurantId: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
