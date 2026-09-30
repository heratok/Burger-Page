import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { Restaurant, omitAdminPassword } from '../../domain/models/Restaurant.js';

export class ListRestaurantsUseCase {
  constructor(
    private restaurantRepo: RestaurantRepository,
    private categoryRepo?: CategoryRepository
  ) {}

  async execute(): Promise<Restaurant[]> {
    const restaurants = await this.restaurantRepo.findAll();
    if (this.categoryRepo) {
      const enriched = await Promise.all(
        restaurants.map(async (r) => {
          try {
            const dbCats = await this.categoryRepo!.findByRestaurantId(r.id);
            const active = dbCats.filter((c) => c.isActive !== false).map((c) => c.name);
            if (active.length > 0) {
              return { ...r, categories: active };
            }
          } catch {}
          return r;
        })
      );
      return enriched.map(omitAdminPassword);
    }
    // SUS-20: one-time admin credentials must never leave through read paths.
    return restaurants.map(omitAdminPassword);
  }
}
