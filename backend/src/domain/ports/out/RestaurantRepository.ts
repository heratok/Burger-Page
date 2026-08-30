import { Restaurant } from '../../models/Restaurant.js';

export interface RestaurantRepository {
  findById(id: string): Promise<Restaurant | null>;
  findBySlug(slug: string): Promise<Restaurant | null>;
  findAll(): Promise<Restaurant[]>;
  save(restaurant: Restaurant): Promise<void>;
  delete(id: string): Promise<void>;
}
