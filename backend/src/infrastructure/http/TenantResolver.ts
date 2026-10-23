import { FastifyRequest } from 'fastify';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

/**
 * Resolves the tenant (restaurant id) for an HTTP request. This is the single
 * shared implementation of the tenant-resolution logic that was copy-pasted
 * across the controllers (review finding D1). Behavior matches the canonical
 * CustomerController version exactly:
 *
 * 1. authContext.restaurantId wins for bound sessions.
 * 2. A super_admin without a bound tenant may target a tenant explicitly via
 *    query.restaurantId, query.slug, body.restaurantId or the x-restaurant-id
 *    header.
 * 3. Nothing explicit means no tenant (''), reads included: the caller
 *    rejects the request instead of serving whichever restaurant happens to
 *    be first, which would show one tenant's data under another's screen.
 * 4. A provided tenant is canonicalized through id/slug lookups (bare or
 *    `rest-`-prefixed) when a restaurant repo is available.
 * 5. M7: a mutation whose tenant cannot be resolved throws instead of falling
 *    through to arbitrary tenant data. Reads keep raw-id passthrough.
 */
export async function resolveTenantForRequest(
  req: FastifyRequest,
  deps: { restaurantRepo?: RestaurantRepository },
  options: { mutation?: boolean } = {}
): Promise<string> {
  let restaurantId = req.authContext?.restaurantId;
  if (!restaurantId && req.authContext?.role === 'super_admin') {
    const query = (req.query || {}) as any;
    const body = (req.body || {}) as any;
    const headers = (req.headers || {}) as any;
    restaurantId =
      query?.restaurantId ||
      query?.slug ||
      body?.restaurantId ||
      headers?.['x-restaurant-id'];
    // Never default to an arbitrary tenant (JD-INFO-02), reads included: a
    // super admin without an explicit tenant gets undefined and the caller
    // rejects the request.
  }

  if (restaurantId && deps.restaurantRepo) {
    const rest =
      (await deps.restaurantRepo.findById(restaurantId)) ||
      (await deps.restaurantRepo.findBySlug(restaurantId)) ||
      (await deps.restaurantRepo.findBySlug(restaurantId.replace(/^rest-/, ''))) ||
      (await deps.restaurantRepo.findById(restaurantId.replace(/^rest-/, '')));
    if (rest) {
      return rest.id;
    }

    // M7: a mutation must never fall through to a tenant the repository
    // cannot resolve — that is exactly how orphan rows are written. Reads
    // keep the raw-id passthrough above.
    if (options.mutation) {
      throw new EntityNotFoundError(`Restaurant '${restaurantId}' not found.`);
    }
  }

  return restaurantId || '';
}