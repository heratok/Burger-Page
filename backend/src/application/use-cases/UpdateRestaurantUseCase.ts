import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';
import { diffFields } from '../../domain/shared/auditDetails.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { Restaurant, omitAdminPassword } from '../../domain/models/Restaurant.js';
import { UpdateRestaurantInput } from '@burger-page/contracts';
import { ConflictError, EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { MIN_PASSWORD_LENGTH } from '../../domain/models/User.js';
import {
  assertValidSchedule,
  assertValidTimezone,
  scheduleFromLegacyHoursText,
} from '../../domain/shared/restaurantSchedule.js';
import { normalizeSlug } from '../../domain/shared/slug.js';
import type { WeeklySchedule } from '@burger-page/contracts';
import { User } from '../../domain/models/User.js';

/**
 * The weekly schedule is the stored source of the hours. An explicit
 * `schedule` always wins. Otherwise an older admin client may still send the
 * legacy "HH:MM - HH:MM" config text: it applies to every weekday, unless it
 * merely echoes one of the current ranges (the full-config save path sends
 * back the text it was served), which must never flatten a weekly schedule.
 */
function resolveSchedule(current: Restaurant, input: UpdateRestaurantInput): WeeklySchedule {
  if (input.schedule !== undefined) {
    assertValidSchedule(input.schedule);
    return input.schedule;
  }
  const legacy = scheduleFromLegacyHoursText(input.config?.openingHours);
  if (!legacy) return current.schedule;
  const echoed = current.schedule.some((r) => r.open === legacy[0].open && r.close === legacy[0].close);
  return echoed ? current.schedule : legacy;
}

export class UpdateRestaurantUseCase {
  constructor(
    private restaurantRepo: RestaurantRepository,
    private categoryRepo?: CategoryRepository,
    private userRepo?: UserRepository,
    private hasher?: PasswordHasher,
    private audit?: AdminAuditRecorder
  ) {}

  async execute(id: string, input: UpdateRestaurantInput, actorRole?: string, actor?: AuditActor): Promise<Restaurant> {
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

    if (input.timezone !== undefined) assertValidTimezone(input.timezone);
    const schedule = resolveSchedule(restaurant, input);

    let slug = restaurant.slug;
    if (input.slug !== undefined) {
      const cleanSlug = normalizeSlug(input.slug);
      if (cleanSlug !== restaurant.slug) {
        const existing = await this.restaurantRepo.findBySlug(cleanSlug);
        if (existing && existing.id !== restaurant.id) {
          throw new ConflictError(`Restaurant with slug "${cleanSlug}" already exists`);
        }
        slug = cleanSlug;
      }
    }

    // The password is a credential of the admin USER (its hash is what the
    // login checks); it is never stored on the restaurant record. Everything
    // that can fail is resolved before the first write.
    const adminReset = await this.prepareAdminPasswordReset(restaurant.id, input.adminPassword);

    // A plaintext secret left on a stored record by older code is dropped on
    // the next write.
    const { adminPassword: _legacyPlaintext, ...stored } = restaurant;
    const updated: Restaurant = {
      ...stored,
      id: restaurant.id,
      slug,
      name: input.name?.trim() ?? restaurant.name,
      tagline: input.tagline ?? restaurant.tagline,
      whatsappNumber: input.whatsappNumber ?? restaurant.whatsappNumber,
      primaryColor: input.primaryColor ?? restaurant.primaryColor,
      theme: input.theme ?? restaurant.theme,
      isActive: input.isActive ?? restaurant.isActive,
      schedule,
      timezone: input.timezone ?? restaurant.timezone,
      ordersPaused: input.ordersPaused ?? restaurant.ordersPaused,
      categories: input.categories ?? restaurant.categories,
      config: {
        ...restaurant.config,
        ...input.config,
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
        // Top-level currency fields are the super admin form's shortcut for
        // config.currency / config.currencySymbol (restaurant_settings).
        ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
        ...(input.currencySymbol !== undefined ? { currencySymbol: input.currencySymbol } : {}),
      },
    };

    if (adminReset) await this.userRepo!.save(adminReset, 'super_admin');
    await this.restaurantRepo.save(updated);

    if (input.categories !== undefined && this.categoryRepo) {
      try {
        const cleanedCategories = Array.from(
          new Set(input.categories.map((c) => c.trim()).filter((c) => c.length > 0))
        );
        const existing = await this.categoryRepo.findByRestaurantId(restaurant.id);
        const existingByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

        for (let i = 0; i < cleanedCategories.length; i++) {
          const name = cleanedCategories[i];
          const found = existingByName.get(name.toLowerCase());
          if (found) {
            await this.categoryRepo.save({
              ...found,
              name,
              displayOrder: i,
              isActive: true,
            });
          } else {
            await this.categoryRepo.save({
              id: newId(ID_PREFIX.category),
              restaurantId: restaurant.id,
              name,
              displayOrder: i,
              isActive: true,
            });
          }
        }

        // Deactivate categories no longer in cleanedCategories
        const cleanedSet = new Set(cleanedCategories.map((c) => c.toLowerCase()));
        for (const cat of existing) {
          if (!cleanedSet.has(cat.name.toLowerCase()) && cat.isActive) {
            await this.categoryRepo.save({
              ...cat,
              isActive: false,
            });
          }
        }
      } catch (err) {
        console.warn('Could not sync categories to CategoryRepository in UpdateRestaurantUseCase:', err);
      }
    }

    // Respond with what was actually persisted: the adapter derives stored
    // fields (e.g. the legacy openingHours from the weekly schedule), so the
    // in-memory merge can be stale.
    const persisted = (await this.restaurantRepo.findById(restaurant.id)) ?? updated;

    await this.recordAudit(actor, restaurant, persisted, input.adminPassword !== undefined);

    // SUS-20: a provided adminPassword must never be echoed back in the
    // response — only the create 201 carries one-time credentials.
    return omitAdminPassword(persisted);
  }
  /**
   * One entry per semantic change: pausing/activating the tenant is its own
   * action, every other changed field goes into a single restaurant.update.
   * The admin password is recorded by field NAME only.
   */
  private async recordAudit(
    actor: AuditActor | undefined,
    before: Restaurant,
    after: Restaurant,
    passwordRotated: boolean
  ): Promise<void> {
    if (!this.audit) return;
    const flat = (r: Restaurant) => ({
      name: r.name,
      slug: r.slug,
      tagline: r.tagline,
      whatsappNumber: r.whatsappNumber,
      primaryColor: r.primaryColor,
      theme: r.theme,
      timezone: r.timezone,
      ordersPaused: r.ordersPaused,
      currency: r.config?.currency,
      currencySymbol: r.config?.currencySymbol,
      schedule: r.schedule,
      categories: r.categories,
    });
    const diff = diffFields(flat(before), flat(after), [
      'name', 'slug', 'tagline', 'whatsappNumber', 'primaryColor', 'theme', 'timezone', 'ordersPaused',
      'currency', 'currencySymbol', 'schedule', 'categories',
    ]);
    if (passwordRotated) diff.changedFields.push('adminPassword');
    const target = { targetType: 'restaurant' as const, targetId: after.id, targetLabel: after.name, restaurantId: after.id };

    if (before.isActive !== after.isActive) {
      await this.audit.record(actor, {
        ...target,
        action: after.isActive ? 'restaurant.activate' : 'restaurant.pause',
        details: { from: before.isActive, to: after.isActive },
      });
    }
    if (diff.changedFields.length > 0) {
      await this.audit.record(actor, { ...target, action: 'restaurant.update', details: diff });
    }
  }

  /**
   * Builds the primary admin user with the new password hash, flagged so the
   * super-admin-chosen password must be changed at next login (same as a
   * reset). The primary admin is the earliest-created restaurant_admin of the
   * tenant, i.e. the one provisioned at creation; additional admins are not
   * touched (reset those through POST /api/users/:id/reset-password).
   */
  private async prepareAdminPasswordReset(restaurantId: string, password?: string): Promise<User | null> {
    if (password === undefined) return null;
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (!this.userRepo || !this.hasher) {
      throw new Error('Admin password reset is not configured (user repository / hasher missing).');
    }
    const admins = (await this.userRepo.findByRestaurantId(restaurantId))
      .filter((u) => u.role === 'restaurant_admin')
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
    const primary = admins[0];
    if (!primary) {
      throw new EntityNotFoundError(`Restaurant "${restaurantId}" has no administrator user`);
    }
    return { ...primary, passwordHash: await this.hasher.hash(password), mustChangePassword: true, passwordChangedAt: new Date().toISOString() };
  }
}
