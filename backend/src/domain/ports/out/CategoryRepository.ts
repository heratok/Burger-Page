import { Category } from '../../models/Category.js';

export interface CategoryRepository {
  findById(id: string, restaurantId: string): Promise<Category | null>;
  findByRestaurantId(restaurantId: string): Promise<Category[]>;
  findByName(name: string, restaurantId: string): Promise<Category | null>;
  save(category: Category): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
