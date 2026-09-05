import { Product } from '../../models/Product.js';

export interface ProductRepository {
  findById(id: string, restaurantId: string): Promise<Product | null>;
  findByRestaurantId(restaurantId: string): Promise<Product[]>;
  save(product: Product): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
