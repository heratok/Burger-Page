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

  async findBySlug(slug: string): Promise<Restaurant | null> {
    for (const restaurant of this.restaurants.values()) {
      if (restaurant.slug === slug) {
        return { ...restaurant };
      }
    }
    return null;
  }

  async findAll(): Promise<Restaurant[]> {
    return Array.from(this.restaurants.values()).map((r) => ({ ...r }));
  }

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;
    this.restaurants.set(restaurant.id, { ...restaurant, slug });
  }

  async delete(id: string): Promise<void> {
    const rest = this.restaurants.get(id);
    if (rest) {
      rest.isActive = false;
    }
  }

  async hardDelete(id: string): Promise<void> {
    this.restaurants.delete(id);
  }
}
