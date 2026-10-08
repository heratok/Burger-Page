import { FastifyRequest, FastifyReply } from 'fastify';
import { GetRestaurantUseCase } from '../../../application/use-cases/GetRestaurantUseCase.js';
import { ListRestaurantsUseCase } from '../../../application/use-cases/ListRestaurantsUseCase.js';
import { ListRestaurantTemplatesUseCase } from '../../../application/use-cases/ListRestaurantTemplatesUseCase.js';
import { CreateRestaurantUseCase } from '../../../application/use-cases/CreateRestaurantUseCase.js';
import { DeleteRestaurantUseCase } from '../../../application/use-cases/DeleteRestaurantUseCase.js';
import { UpdateRestaurantCategoriesUseCase } from '../../../application/use-cases/UpdateRestaurantCategoriesUseCase.js';
import { UpdateRestaurantUseCase } from '../../../application/use-cases/UpdateRestaurantUseCase.js';
import { ListDeletedRestaurantsUseCase } from '../../../application/use-cases/ListDeletedRestaurantsUseCase.js';
import { RestoreRestaurantUseCase } from '../../../application/use-cases/RestoreRestaurantUseCase.js';
import { createRestaurantSchema, restoreRestaurantSchema, updateRestaurantCategoriesSchema, updateRestaurantSchema } from '@burger-page/contracts';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';
import { omitAdminPassword } from '../../../domain/models/Restaurant.js';
import { auditActorOf } from '../auditActor.js';
import { assertOwnsRestaurant } from '../RestaurantOwnershipGuard.js';
import { MenuCache } from '../../cache/MenuCache.js';
import { RestaurantIdCache } from '../../cache/RestaurantIdCache.js';
import type { CachedMenu } from './ProductController.js';

/**
 * A9: storefront-only projection of a tenant for the public landing.
 * Strips operator records (isActive, createdAt) and internal config so the
 * anonymous directory can never leak tenant internals.
 */
function redactPublic(restaurant: any): any {
  const config = restaurant.config || {};
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    tagline: restaurant.tagline,
    whatsappNumber: restaurant.whatsappNumber,
    primaryColor: restaurant.primaryColor,
    theme: restaurant.theme,
    // Weekly schedule (source of truth), the timezone it is read in and the
    // manual pause switch drive the storefront open/closed state. openingHours
    // is the legacy single-range view derived from the schedule.
    schedule: restaurant.schedule,
    timezone: restaurant.timezone,
    ordersPaused: restaurant.ordersPaused,
    openingHours: restaurant.openingHours,
    categories: restaurant.categories,
    config: {
      name: config.name,
      tagline: config.tagline,
      logoUrl: config.logoUrl,
      whatsappNumber: config.whatsappNumber,
      deliveryFee: config.deliveryFee,
      minOrderAmount: config.minOrderAmount,
      currency: config.currency,
      currencySymbol: config.currencySymbol,
      estimatedDeliveryTime: config.estimatedDeliveryTime,
      bgTheme: config.bgTheme,
    },
  };
}

export class RestaurantController {
  constructor(
    private readonly getRestaurantUseCase: GetRestaurantUseCase,
    private readonly listRestaurantsUseCase: ListRestaurantsUseCase,
    private readonly createRestaurantUseCase: CreateRestaurantUseCase,
    private readonly deleteRestaurantUseCase: DeleteRestaurantUseCase,
    private readonly updateCategoriesUseCase: UpdateRestaurantCategoriesUseCase,
    private readonly updateRestaurantUseCase?: UpdateRestaurantUseCase,
    private readonly listDeletedUseCase?: ListDeletedRestaurantsUseCase,
    private readonly restoreRestaurantUseCase?: RestoreRestaurantUseCase,
    private readonly listTemplatesUseCase?: ListRestaurantTemplatesUseCase,
    // Category names, activation and removal of a tenant change the public menu: drop its cache.
    private readonly menuCache?: MenuCache<CachedMenu>,
    // Identifier resolution memo: dropped on any write that can change what an id/slug resolves to.
    private readonly restaurantIdCache?: RestaurantIdCache
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const auth = req.authContext;

    // restaurant_admin is strictly bound to their assigned restaurant (tenant-scoped)
    if (auth?.role === 'restaurant_admin') {
      const forbidden = await assertOwnsRestaurant(req, undefined, this.getRestaurantUseCase, 'view your own restaurant');
      if (forbidden) return reply.status(403).send(forbidden);
      const restaurant = await this.getRestaurantUseCase.execute(auth.restaurantId!);
      return reply.status(200).send(restaurant ? [restaurant] : []);
    }

    // The route guard (requireAnyAdmin) only lets super_admin through here:
    // the platform directory is private, so there is no public projection.
    const restaurants = await this.listRestaurantsUseCase.execute();
    return reply.status(200).send(restaurants);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createRestaurantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const created = await this.createRestaurantUseCase.execute(parsed.data, req.authContext?.role, auditActorOf(req));
    this.restaurantIdCache?.invalidate(created.id);
    return reply.status(201).send(created);
  }

  async get(req: FastifyRequest, reply: FastifyReply) {
    const params = (req.params || {}) as { slug?: string; idOrSlug?: string };
    const identifier = params.idOrSlug || params.slug || 'burger-craft';
    const restaurant = await this.getRestaurantUseCase.execute(identifier);

    // A9: a public detail lookup must not leak operator records (isActive,
    // createdAt) or the internal config. The full tenant record is reserved
    // for super admins and for staff whose tenant matches the resolved
    // restaurant (by id OR slug). Everyone else gets the storefront
    // projection. adminPassword is stripped unconditionally on the full path.
    const auth = req.authContext;
    const isSuperAdmin = auth?.role === 'super_admin';
    const isOwnTenant =
      !!auth?.restaurantId &&
      (restaurant.id === auth.restaurantId || restaurant.slug === auth.restaurantId);

    if (isSuperAdmin || isOwnTenant) {
      return reply.status(200).send(omitAdminPassword(restaurant));
    }
    return reply.status(200).send(redactPublic(restaurant));
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const params = (req.params || {}) as { id: string };
    try {
      await this.deleteRestaurantUseCase.execute(params.id, auditActorOf(req));
    } finally {
      // Best effort when `id` is a slug: deleted tenants are rejected before any cache lookup, and restore invalidates by canonical id.
      this.menuCache?.invalidate(params.id);
      // `id` may be a slug, so the canonical id is unknown here: drop every resolution.
      this.restaurantIdCache?.clear();
    }
    return reply.status(200).send({ message: 'Restaurant deleted successfully' });
  }

  async listTemplates(_req: FastifyRequest, reply: FastifyReply) {
    if (!this.listTemplatesUseCase) {
      throw new Error('ListRestaurantTemplatesUseCase is not configured.');
    }
    return reply.status(200).send(this.listTemplatesUseCase.execute());
  }

  async listDeleted(_req: FastifyRequest, reply: FastifyReply) {
    if (!this.listDeletedUseCase) {
      throw new Error('ListDeletedRestaurantsUseCase is not configured.');
    }
    return reply.status(200).send(await this.listDeletedUseCase.execute());
  }

  async restore(req: FastifyRequest, reply: FastifyReply) {
    if (!this.restoreRestaurantUseCase) {
      throw new Error('RestoreRestaurantUseCase is not configured.');
    }
    const { id } = req.params as { id: string };
    const body = restoreRestaurantSchema.safeParse(req.body ?? {});
    if (!body.success) {
      throw new ValidationError(body.error.message);
    }
    const result = await this.restoreRestaurantUseCase.execute({ id, slug: body.data.slug, actor: auditActorOf(req) });
    this.menuCache?.invalidate(id);
    this.restaurantIdCache?.clear(); // a restore may assign a new slug
    return reply.status(200).send(result);
  }

  async updateCategories(
    req: FastifyRequest,
    reply: FastifyReply
  ) {
    const parsed = updateRestaurantCategoriesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const auth = req.authContext;
    const params = (req.params || {}) as { slug?: string };

    const forbidden = await assertOwnsRestaurant(req, params.slug, this.getRestaurantUseCase, 'update your own restaurant categories');
    if (forbidden) return reply.status(403).send(forbidden);

    // restaurant_admin is strictly bound to their assigned restaurant
    const identifier = params.slug || auth?.restaurantId || 'burger-craft';

    const { categories, renames } = parsed.data;
    const updated = await this.updateCategoriesUseCase.execute(identifier, categories, renames);
    this.menuCache?.invalidate(updated.id);
    return reply.status(200).send({
      message: 'Restaurant categories updated successfully',
      categories: updated.categories || [],
    });
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    if (!this.updateRestaurantUseCase) {
      throw new Error('UpdateRestaurantUseCase is not configured.');
    }
    const params = (req.params || {}) as { id: string };
    const auth = req.authContext;

    const forbidden = await assertOwnsRestaurant(req, params.id, this.getRestaurantUseCase, 'update your own restaurant');
    if (forbidden) return reply.status(403).send(forbidden);

    const parsed = updateRestaurantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const updated = await this.updateRestaurantUseCase.execute(params.id, parsed.data, auth?.role, auditActorOf(req));
    this.menuCache?.invalidate(updated.id);
    this.restaurantIdCache?.invalidate(updated.id, `id:${params.id}`, `slug:${params.id}`);
    return reply.status(200).send(updated);
  }
}
