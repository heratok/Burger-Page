import { ProductAddition } from '../../models/ProductAddition.js';
import { ListOptions } from './ListOptions.js';

export interface ProductAdditionRepository {
  findById(id: string, restaurantId: string): Promise<ProductAddition | null>;
  findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<ProductAddition[]>;
  /** Tenant-scoped total count for pagination (optional so test fakes may omit it). */
  countByRestaurantId?(restaurantId: string): Promise<number>;
  findByProductId(productId: string, restaurantId: string): Promise<ProductAddition[]>;
  save(addition: ProductAddition): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
