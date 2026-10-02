import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { Restaurant, omitAdminPassword } from '../../domain/models/Restaurant.js';
import { ConflictError, EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { normalizeSlug } from '../../domain/shared/slug.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';

export interface RestoreRestaurantInput {
  id: string;
  /** Optional replacement slug, e.g. when the original one was reused. */
  slug?: string;
  /** Who restores it (audit trail). */
  actor?: AuditActor;
}

export interface RenamedUser {
  id: string;
  from: string;
  to: string;
}

export interface RestoreRestaurantResult {
  /** The restored tenant. It comes back PAUSED: the super admin reactivates it explicitly. */
  restaurant: Restaurant;
  /** Users whose original username was taken meanwhile and got a `-restored-<id>` one. */
  renamedUsers: RenamedUser[];
}

/**
 * Reverse of DeleteRestaurantUseCase. The tenant returns paused (safer: its
 * admins cannot sign in and the store stays closed until someone decides to
 * reopen it) with its original slug, or a chosen one, when free.
 */
export class RestoreRestaurantUseCase {
  constructor(
    private restaurantRepo: RestaurantRepository,
    private userRepo: UserRepository,
    private audit?: AdminAuditRecorder
  ) {}

  async execute({ id, slug: requestedSlug, actor }: RestoreRestaurantInput): Promise<RestoreRestaurantResult> {
    const deleted = (await this.restaurantRepo.findDeleted()).find((r) => r.id === id);
    if (!deleted) {
      throw new EntityNotFoundError(`Deleted restaurant "${id}" not found`);
    }
    const slug = normalizeSlug(requestedSlug ?? deleted.slug);
    if (await this.restaurantRepo.findBySlug(slug)) {
      throw this.slugTaken(slug, requestedSlug === undefined);
    }

    // Users first (idempotent, all-or-nothing): while the tenant is still
    // deleted they cannot sign in, and a failed restore can simply be retried.
    const restoredUsers = await this.userRepo.restoreByRestaurantId(id);
    const outcome = await this.restaurantRepo.restore(id, slug);
    if (outcome !== 'restored') {
      // Lost a race for the slug (or the tenant vanished): put the users back
      // in their retired state so nothing is half restored.
      await this.userRepo.retireByRestaurantId(id);
      if (outcome === 'slug_taken') throw this.slugTaken(slug, requestedSlug === undefined);
      throw new EntityNotFoundError(`Deleted restaurant "${id}" not found`);
    }

    const restaurant = await this.restaurantRepo.findById(id);
    if (!restaurant) {
      throw new EntityNotFoundError(`Restaurant "${id}" not found after restore`);
    }
    const renamedUsers = restoredUsers
      .filter((u) => u.username !== u.originalUsername)
      .map((u) => ({ id: u.id, from: u.originalUsername, to: u.username }));
    await this.audit?.record(actor, {
      action: 'restaurant.restore',
      targetType: 'restaurant',
      targetId: restaurant.id,
      targetLabel: restaurant.name,
      restaurantId: restaurant.id,
      details: { slug: restaurant.slug, originalSlug: deleted.slug, restoredUsers: restoredUsers.length, renamedUsers },
    });
    return { restaurant: omitAdminPassword(restaurant), renamedUsers };
  }

  private slugTaken(slug: string, wasOriginal: boolean): ConflictError {
    return new ConflictError(
      wasOriginal
        ? `The original slug "${slug}" is now used by another restaurant. Choose a new slug to restore it.`
        : `Restaurant with slug "${slug}" already exists`
    );
  }
}
