import { RestaurantRepository, RestoreRestaurantOutcome } from '../../domain/ports/out/RestaurantRepository.js';
import { DeletedRestaurant, Restaurant } from '../../domain/models/Restaurant.js';
import { legacyHoursText, legacyOpeningHours } from '../../domain/shared/restaurantSchedule.js';
import { defaultRestaurant, multiTenantSeedRestaurants } from './seedData.js';

export class InMemoryRestaurantRepository implements RestaurantRepository {
  private restaurants: Map<string, Restaurant> = new Map();
  /** Soft-deleted tenants: hidden from every read and never resurrected by save(). */
  private deletedIds = new Set<string>();
  /** Original slug and deletion instant of each soft-deleted tenant. */
  private deletedMeta = new Map<string, { slug: string; deletedAt: string }>();

  constructor() {
    for (const seed of [defaultRestaurant, ...multiTenantSeedRestaurants]) {
      const { adminPassword: _seedSecret, ...restaurant } = seed;
      this.restaurants.set(restaurant.id, restaurant);
    }
  }

  private live(): Restaurant[] {
    return Array.from(this.restaurants.values()).filter((r) => !this.deletedIds.has(r.id));
  }

  async findById(id: string): Promise<Restaurant | null> {
    return this.deletedIds.has(id) ? null : this.restaurants.get(id) || null;
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    const found = this.live().find((r) => r.slug === slug);
    return found ? { ...found } : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    return this.live().some((r) => r.slug === slug);
  }

  async findAll(): Promise<Restaurant[]> {
    return this.live().map((r) => ({ ...r }));
  }

  async save(input: Restaurant): Promise<void> {
    if (this.deletedIds.has(input.id)) return;
    // The plaintext admin password is a one-time response value, never stored.
    const { adminPassword: _oneTimeSecret, ...restaurant } = input;
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;
    // Like the Pg adapter, the legacy openingHours views are derived from the
    // weekly schedule instead of being stored.
    const openingHours = legacyOpeningHours(restaurant.schedule ?? [], restaurant.timezone);
    this.restaurants.set(restaurant.id, {
      ...restaurant,
      slug,
      openingHours,
      ...(restaurant.config ? { config: { ...restaurant.config, openingHours: legacyHoursText(openingHours) } } : {}),
    });
  }

  async delete(id: string): Promise<void> {
    const rest = this.restaurants.get(id);
    if (rest && !this.deletedIds.has(id)) {
      this.deletedMeta.set(id, { slug: rest.slug ?? id, deletedAt: new Date().toISOString() });
      rest.isActive = false;
      rest.slug = `${rest.slug}-deleted-${id}`;
      this.deletedIds.add(id);
    }
  }

  async hardDelete(id: string): Promise<void> {
    this.restaurants.delete(id);
    this.deletedIds.delete(id);
    this.deletedMeta.delete(id);
  }

  async findDeleted(): Promise<DeletedRestaurant[]> {
    return [...this.deletedIds]
      .map((id) => ({ rest: this.restaurants.get(id), meta: this.deletedMeta.get(id) }))
      .filter((e): e is { rest: Restaurant; meta: { slug: string; deletedAt: string } } => !!e.rest && !!e.meta)
      .map(({ rest, meta }) => ({ id: rest.id, name: rest.name, slug: meta.slug, deletedAt: meta.deletedAt }))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  async restore(id: string, slug: string): Promise<RestoreRestaurantOutcome> {
    const rest = this.restaurants.get(id);
    if (!rest || !this.deletedIds.has(id)) return 'not_found';
    if (this.live().some((r) => r.slug === slug)) return 'slug_taken';
    rest.slug = slug;
    rest.isActive = false;
    this.deletedIds.delete(id);
    this.deletedMeta.delete(id);
    return 'restored';
  }
}
