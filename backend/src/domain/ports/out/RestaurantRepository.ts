import { Restaurant } from '../../models/Restaurant.js';

export interface RestaurantRepository {
  findById(id: string): Promise<Restaurant | null>;
  save(restaurant: Restaurant): Promise<void>;
}
