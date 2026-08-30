import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { CreateRestaurantInput } from '@burger-page/contracts';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateRestaurantUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(input: CreateRestaurantInput): Promise<Restaurant> {
    const cleanSlug = input.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');

    if (!cleanSlug) {
      throw new ValidationError('A valid slug is required');
    }

    const existing = await this.restaurantRepo.findBySlug(cleanSlug);
    if (existing) {
      throw new ValidationError(`Restaurant with slug "${cleanSlug}" already exists`);
    }

    const restaurantId = `rest-${Date.now()}`;
    const newRestaurant: Restaurant = {
      id: restaurantId,
      slug: cleanSlug,
      name: input.name.trim(),
      tagline: input.tagline || 'Cocina artesanal',
      whatsappNumber: input.whatsappNumber || '573001234567',
      adminPassword: input.adminPassword || 'admin123',
      primaryColor: input.primaryColor || '#FF7A21',
      theme: input.theme || (input.templateType === 'pizza' ? 'warm-cream' : input.templateType === 'tacos' ? 'clean-white' : 'dark-charcoal'),
      config: input.config || {
        name: input.name.trim(),
        tagline: input.tagline || 'Cocina artesanal',
        whatsappNumber: input.whatsappNumber || '573001234567',
        primaryColor: input.primaryColor || '#FF7A21',
        bgTheme: input.theme || 'dark-charcoal',
      },
      openingHours: { open: '12:00', close: '22:30' },
      isActive: true,
      categories: input.categories && input.categories.length > 0 ? input.categories : ['General'],
      createdAt: new Date().toISOString(),
    };

    await this.restaurantRepo.save(newRestaurant);
    return newRestaurant;
  }
}
