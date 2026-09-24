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
 *    query.restaurantId, body.restaurantId or the x-restaurant-id header.
 * 3. Reads only: still empty falls back to the first active restaurant.
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
      body?.restaurantId ||
      headers?.['x-restaurant-id'];

    // Mutations must never default to an arbitrary tenant (JD-INFO-02): a
    // super admin without an explicit tenant gets undefined and the caller
    // rejects the request. Reads may keep the first-active fallback.
    if (!restaurantId && !options.mutation && deps.restaurantRepo) {
      const all = await deps.restaurantRepo.findAll();
      const active = all.find((r) => r.isActive);
      if (active) restaurantId = active.id;
    }
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
    // keep the raw-id passthrough (and the first-active fallback) above.
    if (options.mutation) {
      throw new EntityNotFoundError(`Restaurant '${restaurantId}' not found.`);
    }
  }

  return restaurantId || '';
}