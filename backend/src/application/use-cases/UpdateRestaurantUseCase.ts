import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant, omitAdminPassword } from '../../domain/models/Restaurant.js';
import { UpdateRestaurantInput } from '@burger-page/contracts';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateRestaurantUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(id: string, input: UpdateRestaurantInput, actorRole?: string): Promise<Restaurant> {
    const restaurant = (await this.restaurantRepo.findById(id)) || (await this.restaurantRepo.findBySlug(id));
    if (!restaurant) {
      throw new EntityNotFoundError(`Restaurant "${id}" not found`);
    }

    // S3: slug, isActive and adminPassword are super_admin-only fields. The
    // guard follows an effective-change rule: the tenant-admin frontend save
    // path sends slug (and sometimes isActive) on every PUT, so an idempotent
    // no-op — sending a value equal to the stored one — must keep working.
    // Only an EFFECTIVE change to slug/isActive is rejected, plus ANY
    // adminPassword presence (a tenant admin sending the same plaintext
    // cannot be compared against the stored hash, so credential rotation is
    // unconditionally super_admin-only).
    if (actorRole !== 'super_admin') {
      if (input.slug !== undefined && input.slug.trim().toLowerCase() !== restaurant.slug) {
        throw new ValidationError('Changing the storefront slug requires super_admin privileges.');
      }
      if (input.isActive !== undefined && input.isActive !== restaurant.isActive) {
        throw new ValidationError('Changing the active state requires super_admin privileges.');
      }
      if (input.adminPassword !== undefined) {
        throw new ValidationError('Rotating the admin password requires super_admin privileges.');
      }
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
      name: input.name?.trim() ?? restaurant.name,
      tagline: input.tagline ?? restaurant.tagline,
      whatsappNumber: input.whatsappNumber ?? restaurant.whatsappNumber,
      adminPassword: input.adminPassword ?? restaurant.adminPassword,
      primaryColor: input.primaryColor ?? restaurant.primaryColor,
      theme: input.theme ?? restaurant.theme,
      isActive: input.isActive ?? restaurant.isActive,
      categories: input.categories ?? restaurant.categories,
      config: {
        ...restaurant.config,
        ...input.config,
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
      },
    };

    await this.restaurantRepo.save(updated);
    // SUS-20: a provided adminPassword is accepted (update semantics) but must
    // never be echoed back in the response — only the create 201 carries
    // one-time credentials.
    return omitAdminPassword(updated);
  }
}
