import { randomUUID, randomBytes } from 'node:crypto';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { User, UserRole } from '../../domain/models/User.js';
import { CreateRestaurantInput } from '@burger-page/contracts';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateRestaurantUseCase {
  constructor(
    private readonly restaurantRepo: RestaurantRepository,
    private readonly categoryRepo?: CategoryRepository,
    private readonly userRepo?: UserRepository,
    private readonly hasher?: PasswordHasher
  ) {}

  async execute(input: CreateRestaurantInput, callerRole?: UserRole): Promise<Restaurant> {
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

    // SUS-02: a tenant is only usable when its admin user exists, so provision
    // the restaurant_admin row from the one-time credentials we are about to
    // return. The actor role comes from the authenticated caller (the create
    // route is super-admin-gated) and defaults to super_admin for script/test
    // callers that do not authenticate.
    const adminUsername = input.adminUsername?.trim() || `admin_${cleanSlug}`;
    if (this.userRepo && this.hasher) {
      try {
        // JD-B-001: a colliding adminUsername (e.g. the seeded super admin
        // 'admin') must never reach userRepo.save — the Pg driver upserts by
        // username OR id and would rewrite the existing user's
        // password_hash/role/restaurant_id. Mirror CreateUserUseCase's
        // uniqueness check; the throw is handled by the SUS-02 catch below.
        const existing = await this.userRepo.findByUsername(adminUsername);
        if (existing) {
          throw new ValidationError(`Username "${adminUsername}" already exists`);
        }
        const adminUser: User = {
          id: randomUUID(),
          username: adminUsername,
          passwordHash: await this.hasher.hash(newRestaurant.adminPassword ?? ''),
          role: 'restaurant_admin',
          restaurantId,
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        await this.userRepo.save(adminUser, callerRole ?? 'super_admin');
      } catch (err) {
        // A secondary admin-row failure must never roll back tenant creation:
        // the response still carries the credentials for a manual retry.
        console.warn('Could not create admin user for restaurant:', err);
      }
    }

    return { ...newRestaurant, adminUsername } as Restaurant;
  }
}
