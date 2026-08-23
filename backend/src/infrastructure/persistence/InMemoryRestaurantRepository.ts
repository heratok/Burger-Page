import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { defaultRestaurant } from './seedData.js';

export class InMemoryRestaurantRepository implements RestaurantRepository {
  private restaurants: Map<string, Restaurant> = new Map();

  constructor() {
    this.restaurants.set(defaultRestaurant.id, { ...defaultRestaurant });
  }

  async findById(id: string): Promise<Restaurant | null> {
    return this.restaurants.get(id) || null;
  }

  async save(restaurant: Restaurant): Promise<void> {
    this.restaurants.set(restaurant.id, { ...restaurant });
  }
}
