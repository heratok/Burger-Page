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
    private readonly listTemplatesUseCase?: ListRestaurantTemplatesUseCase
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const auth = req.authContext;

    // restaurant_admin is strictly bound to their assigned restaurant (tenant-scoped)
    if (auth?.role === 'restaurant_admin') {
      if (!auth.restaurantId) {
        return reply.status(403).send({
          type: 'https://example.com/probs/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Restaurant administrator has no assigned restaurant.',
        });
      }
      const restaurant = await this.getRestaurantUseCase.execute(auth.restaurantId);
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
    await this.deleteRestaurantUseCase.execute(params.id, auditActorOf(req));
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
    let identifier: string;

    if (auth?.role === 'super_admin') {
      identifier = params.slug || auth?.restaurantId || 'burger-craft';
    } else {
      if (!auth?.restaurantId) {
        return reply.status(403).send({
          type: 'https://example.com/probs/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Restaurant administrator has no assigned restaurant.',
        });
      }

      if (params.slug && params.slug !== auth.restaurantId) {
        const assignedRest = await this.getRestaurantUseCase.execute(auth.restaurantId);
        if (!assignedRest || (assignedRest.id !== params.slug && assignedRest.slug !== params.slug)) {
          return reply.status(403).send({
            type: 'https://example.com/probs/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'You are only authorized to update your own restaurant categories.',
          });
        }
      }

      // restaurant_admin is strictly bound to their assigned restaurant
      identifier = params.slug || auth.restaurantId;
    }

    const { categories, renames } = parsed.data;
    const updated = await this.updateCategoriesUseCase.execute(identifier, categories, renames);
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

    if (auth?.role !== 'super_admin') {
      if (!auth?.restaurantId) {
        return reply.status(403).send({
          type: 'https://example.com/probs/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Restaurant administrator has no assigned restaurant.',
        });
      }

      if (auth.restaurantId !== params.id) {
        const assignedRest = await this.getRestaurantUseCase.execute(auth.restaurantId);
        if (!assignedRest || (assignedRest.id !== params.id && assignedRest.slug !== params.id)) {
          return reply.status(403).send({
            type: 'https://example.com/probs/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'You are only authorized to update your own restaurant.',
          });
        }
      }
    }

    const parsed = updateRestaurantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const updated = await this.updateRestaurantUseCase.execute(params.id, parsed.data, auth?.role, auditActorOf(req));
    return reply.status(200).send(updated);
  }
}
