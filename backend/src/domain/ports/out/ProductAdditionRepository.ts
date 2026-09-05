import { ProductAddition } from '../../models/ProductAddition.js';

export interface ProductAdditionRepository {
  findById(id: string, restaurantId: string): Promise<ProductAddition | null>;
  findByRestaurantId(restaurantId: string): Promise<ProductAddition[]>;
  findByProductId(productId: string, restaurantId: string): Promise<ProductAddition[]>;
  save(addition: ProductAddition): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
