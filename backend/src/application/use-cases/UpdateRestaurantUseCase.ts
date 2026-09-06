import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { UpdateRestaurantInput } from '@burger-page/contracts';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateRestaurantUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(id: string, input: UpdateRestaurantInput): Promise<Restaurant> {
    const restaurant = (await this.restaurantRepo.findById(id)) || (await this.restaurantRepo.findBySlug(id));
    if (!restaurant) {
      throw new EntityNotFoundError(`Restaurant "${id}" not found`);
    }

    let slug = restaurant.slug;
    if (input.slug !== undefined) {
      const cleanSlug = input.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');
      if (!cleanSlug) {
        throw new ValidationError('A valid slug is required');
      }
      if (cleanSlug !== restaurant.slug) {
        const existing = await this.restaurantRepo.findBySlug(cleanSlug);
        if (existing && existing.id !== restaurant.id) {
          throw new ValidationError(`Restaurant with slug "${cleanSlug}" already exists`);
        }
        slug = cleanSlug;
      }
    }

    const updated: Restaurant = {
      ...restaurant,
      id: restaurant.id,
      slug,
      name: input.name !== undefined ? input.name.trim() : restaurant.name,
      tagline: input.tagline !== undefined ? input.tagline : restaurant.tagline,
      whatsappNumber: input.whatsappNumber !== undefined ? input.whatsappNumber : restaurant.whatsappNumber,
      adminPassword: input.adminPassword !== undefined ? input.adminPassword : restaurant.adminPassword,
      primaryColor: input.primaryColor !== undefined ? input.primaryColor : restaurant.primaryColor,
      theme: input.theme !== undefined ? input.theme : restaurant.theme,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : restaurant.isActive,
      categories: input.categories !== undefined ? input.categories : restaurant.categories,
      config: {
        ...(restaurant.config || {}),
        ...(input.config || {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
      },
    };

    await this.restaurantRepo.save(updated);
    return updated;
  }
}
