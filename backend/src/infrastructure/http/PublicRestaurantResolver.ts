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
