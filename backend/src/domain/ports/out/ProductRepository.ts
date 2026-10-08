import { Product } from '../../models/Product.js';
import { ListOptions } from './ListOptions.js';

export interface ProductRepository {
  findById(id: string, restaurantId: string): Promise<Product | null>;
  /** Batched tenant-scoped lookup; missing ids are simply absent (optional so test fakes may omit it). */
  findByIds?(ids: string[], restaurantId: string): Promise<Product[]>;
  findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Product[]>;
  /** Tenant-scoped total count for pagination (optional so test fakes may omit it). */
  countByRestaurantId?(restaurantId: string): Promise<number>;
  save(product: Product): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
