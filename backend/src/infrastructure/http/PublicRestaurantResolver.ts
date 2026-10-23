import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { RestaurantIdCache } from '../cache/RestaurantIdCache.js';

const stripPrefix = (value: string) => value.replace(/^rest-/, '');

/**
 * Resolves the restaurant of an unauthenticated storefront request from
 * `?restaurantId=` or `?slug=` (each accepting an id or a slug, with or
 * without the `rest-` prefix). Positive results are memoized in `cache`;
 * missing and inactive tenants always throw and are never cached.
 */
export async function resolvePublicRestaurantId(
  restaurantRepo: RestaurantRepository | undefined,
  cache: RestaurantIdCache | undefined,
  query: { restaurantId?: string; slug?: string },
  missingMessage: string
): Promise<string> {
  const byId = !!query.restaurantId;
  const identifier = query.restaurantId || query.slug;
  if (!identifier) throw new ValidationError(missingMessage);
  if (!restaurantRepo) {
    if (byId) return identifier;
    throw new ValidationError(missingMessage);
  }

  const cacheKey = `${byId ? 'id' : 'slug'}:${identifier}`;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const version = cache?.version;

  const rest = byId
    ? (await restaurantRepo.findById(identifier)) ||
      (await restaurantRepo.findBySlug(identifier)) ||
      (await restaurantRepo.findBySlug(stripPrefix(identifier))) ||
      (await restaurantRepo.findById(stripPrefix(identifier)))
    : (await restaurantRepo.findBySlug(identifier)) ||
      (await restaurantRepo.findById(identifier)) ||
      (await restaurantRepo.findBySlug(stripPrefix(identifier)));
  if (!rest) {
    throw new EntityNotFoundError(
      byId ? `Restaurant '${identifier}' not found.` : `Restaurant with slug '${identifier}' not found.`
    );
  }
  if (!rest.isActive) {
    throw new ValidationError(`Restaurant '${rest.name}' is currently inactive.`);
  }
  cache?.set(cacheKey, rest.id, version);
  return rest.id;
}

/**
 * Which restaurant a menu read (products/additions) targets for a session bound
 * to `authTenant`. No restaurant in the query, or the session's own, reads the
 * tenant's full catalog. A query naming ANOTHER restaurant (a staff member
 * browsing someone else's storefront) is answered as that restaurant's public
 * storefront: the session's own catalog is never served under another store.
 */
export async function resolveCatalogReadTarget(
  restaurantRepo: RestaurantRepository | undefined,
  cache: RestaurantIdCache | undefined,
  authTenant: string,
  query: { restaurantId?: string; slug?: string },
  missingMessage: string
): Promise<{ restaurantId: string; ownCatalog: boolean }> {
  if ((!query.restaurantId && !query.slug) || query.restaurantId === authTenant) {
    return { restaurantId: authTenant, ownCatalog: true };
  }
  const requested = await resolvePublicRestaurantId(restaurantRepo, cache, query, missingMessage);
  return { restaurantId: requested, ownCatalog: requested === authTenant };
}
