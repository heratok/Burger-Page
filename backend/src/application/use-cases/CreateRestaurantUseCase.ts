import { randomUUID, randomBytes } from 'node:crypto';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { CreateRestaurantInput } from '@burger-page/contracts';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateRestaurantUseCase {
  constructor(
    private readonly restaurantRepo: RestaurantRepository,
    private readonly categoryRepo?: CategoryRepository
  ) {}

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

    // Server-owned identity: client-supplied ids are never trusted
        // (a malicious or stale id could overwrite an existing tenant via upsert).
        const restaurantId = `rest-${randomUUID()}`;
    const newRestaurant: Restaurant = {
      id: restaurantId,
      slug: cleanSlug,
      name: input.name.trim(),
      tagline: input.tagline || 'Cocina artesanal',
      whatsappNumber: input.whatsappNumber || '573001234567',
      // Default admin credentials must never be predictable: generate a
          // random secret when the caller does not provide one.
          adminPassword: input.adminPassword || randomBytes(12).toString('base64url'),
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

    if (this.categoryRepo && newRestaurant.categories) {
      try {
        for (let i = 0; i < newRestaurant.categories.length; i++) {
          await this.categoryRepo.save({
            id: `cat_${randomUUID()}`,
            restaurantId,
            name: newRestaurant.categories[i],
            displayOrder: i,
            isActive: true,
          });
        }
      } catch (err) {
        console.warn('Could not sync initial categories to CategoryRepository:', err);
      }
    }

    return newRestaurant;
  }
}
