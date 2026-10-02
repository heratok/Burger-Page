import { randomBytes } from 'node:crypto';
import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { MIN_PASSWORD_LENGTH, User, UserRole } from '../../domain/models/User.js';
import { CreateRestaurantInput } from '@burger-page/contracts';
import { ConflictError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { normalizeSlug } from '../../domain/shared/slug.js';
import {
  DEFAULT_TIMEZONE,
  assertValidSchedule,
  assertValidTimezone,
  defaultWeeklySchedule,
  legacyOpeningHours,
  scheduleFromLegacyHoursText,
} from '../../domain/shared/restaurantSchedule.js';

export class CreateRestaurantUseCase {
  constructor(
    private readonly restaurantRepo: RestaurantRepository,
    private readonly categoryRepo?: CategoryRepository,
    private readonly userRepo?: UserRepository,
    private readonly hasher?: PasswordHasher
  ) {}

  async execute(input: CreateRestaurantInput, callerRole?: UserRole): Promise<Restaurant> {
    const cleanSlug = normalizeSlug(input.slug);

    const existing = await this.restaurantRepo.findBySlug(cleanSlug);
    if (existing) {
      throw new ValidationError(`Restaurant with slug "${cleanSlug}" already exists`);
    }

    if (input.adminPassword !== undefined && input.adminPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    // SUS-02: a tenant is only usable when its admin user exists, so the
    // username is checked BEFORE anything is written. JD-B-001: a colliding
    // adminUsername (e.g. the seeded super admin 'admin') must never reach
    // userRepo.save — the Pg driver upserts by username OR id and would rewrite
    // the existing user's password_hash/role/restaurant_id.
    const adminUsername = input.adminUsername?.trim() || `admin_${cleanSlug}`;
    if (this.userRepo && (await this.userRepo.findByUsername(adminUsername))) {
      throw new ConflictError(`Username "${adminUsername}" already exists`);
    }

    // The weekly schedule is the stored source of the hours: an explicit one
    // wins, then a legacy "HH:MM - HH:MM" config text, then the default.
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    assertValidTimezone(timezone);
    if (input.schedule !== undefined) assertValidSchedule(input.schedule);
    const schedule =
      input.schedule ?? scheduleFromLegacyHoursText(input.config?.openingHours) ?? defaultWeeklySchedule();

    // Server-owned identity: client-supplied ids are never trusted
        // (a malicious or stale id could overwrite an existing tenant via upsert).
        const restaurantId = newId(ID_PREFIX.restaurant);
    // Default admin credentials must never be predictable: generate a random
    // secret when the caller does not provide one. It is returned once in the
    // create response and only its hash (on the admin user) is persisted.
    const adminPassword = input.adminPassword || randomBytes(12).toString('base64url');
    const newRestaurant: Restaurant = {
      id: restaurantId,
      slug: cleanSlug,
      name: input.name.trim(),
      tagline: input.tagline || 'Cocina artesanal',
      whatsappNumber: input.whatsappNumber || '573001234567',
      primaryColor: input.primaryColor || '#FF7A21',
      theme: input.theme || (input.templateType === 'pizza' ? 'warm-cream' : input.templateType === 'tacos' ? 'clean-white' : 'dark-charcoal'),
      config: input.config || {
        name: input.name.trim(),
        tagline: input.tagline || 'Cocina artesanal',
        whatsappNumber: input.whatsappNumber || '573001234567',
        primaryColor: input.primaryColor || '#FF7A21',
        bgTheme: input.theme || 'dark-charcoal',
      },
      schedule,
      timezone,
      ordersPaused: input.ordersPaused ?? false,
      openingHours: legacyOpeningHours(schedule, timezone),
      isActive: true,
      categories: input.categories ?? [],
      createdAt: new Date().toISOString(),
    };

    await this.restaurantRepo.save(newRestaurant);

    if (this.categoryRepo && newRestaurant.categories) {
      try {
        for (let i = 0; i < newRestaurant.categories.length; i++) {
          await this.categoryRepo.save({
            id: newId(ID_PREFIX.category),
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

    // Provision the restaurant_admin row from the one-time credentials we are
    // about to return. The actor role comes from the authenticated caller (the
    // create route is super-admin-gated) and defaults to super_admin for
    // script/test callers that do not authenticate. A failure here must not
    // leave a tenant nobody can log into: undo the tenant and surface the error.
    if (this.userRepo && this.hasher) {
      try {
        const adminUser: User = {
          id: newId(ID_PREFIX.user),
          username: adminUsername,
          passwordHash: await this.hasher.hash(adminPassword),
          role: 'restaurant_admin',
          restaurantId,
          createdAt: new Date().toISOString(),
          isActive: true,
          mustChangePassword: true,
        };
        await this.userRepo.save(adminUser, callerRole ?? 'super_admin');
      } catch (err) {
        await this.rollbackTenant(restaurantId);
        throw err;
      }
    }

    return { ...newRestaurant, adminPassword, adminUsername } as Restaurant;
  }

  private async rollbackTenant(restaurantId: string): Promise<void> {
    try {
      // Prefer physically removing the half-created tenant; adapters without
      // hardDelete fall back to the (deleted_at) soft delete.
      await (this.restaurantRepo.hardDelete ?? this.restaurantRepo.delete).call(this.restaurantRepo, restaurantId);
    } catch (cleanupErr) {
      console.error(`Could not roll back restaurant ${restaurantId} after a failed admin provisioning:`, cleanupErr);
    }
  }
}
