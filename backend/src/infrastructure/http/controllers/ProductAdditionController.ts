import { FastifyRequest, FastifyReply } from 'fastify';
import { ListProductAdditionsUseCase } from '../../../application/use-cases/ListProductAdditionsUseCase.js';
import { GetProductAdditionByIdUseCase } from '../../../application/use-cases/GetProductAdditionByIdUseCase.js';
import { CreateProductAdditionUseCase } from '../../../application/use-cases/CreateProductAdditionUseCase.js';
import { UpdateProductAdditionUseCase } from '../../../application/use-cases/UpdateProductAdditionUseCase.js';
import { DeleteProductAdditionUseCase } from '../../../application/use-cases/DeleteProductAdditionUseCase.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { createProductAdditionSchema, updateProductAdditionSchema } from '@burger-page/contracts';
import { ValidationError, UnauthorizedError, EntityNotFoundError } from '../../../domain/errors/DomainErrors.js';
import { resolveTenantForRequest } from '../TenantResolver.js';
import { CreateProductAdditionDTO, UpdateProductAdditionDTO } from '../../../application/dtos/index.js';
import { ListOptions } from '../../../domain/ports/out/ListOptions.js';
import { MenuCache } from '../../cache/MenuCache.js';
import { RestaurantIdCache } from '../../cache/RestaurantIdCache.js';
import { resolvePublicRestaurantId } from '../PublicRestaurantResolver.js';
import type { CachedMenu } from './ProductController.js';

/**
 * Lenient pagination parsing: honored only when BOTH page and limit are
 * present valid integers (page >= 1, limit clamped 1..100); anything else is
 * ignored so the request keeps the exact pre-pagination behavior.
 */
function parsePagination(query: unknown): ListOptions | undefined {
  const q = (query ?? {}) as { page?: unknown; limit?: unknown };
  const page = typeof q.page === 'number' ? q.page : Number(q.page);
  const limitRaw = typeof q.limit === 'number' ? q.limit : Number(q.limit);
  if (!Number.isInteger(page) || page < 1) return undefined;
  if (!Number.isInteger(limitRaw) || limitRaw < 1) return undefined;
  return { page, limit: Math.min(limitRaw, 100) };
}

export class ProductAdditionController {
  constructor(
    private listAdditionsUseCase: ListProductAdditionsUseCase,
    private getAdditionByIdUseCase: GetProductAdditionByIdUseCase,
    private createAdditionUseCase: CreateProductAdditionUseCase,
    private updateAdditionUseCase: UpdateProductAdditionUseCase,
    private deleteAdditionUseCase: DeleteProductAdditionUseCase,
    private restaurantRepo?: RestaurantRepository,
    // Additions are part of the public menu payload: writes drop the tenant's cached menu.
    private menuCache?: MenuCache<CachedMenu>,
    private restaurantIdCache?: RestaurantIdCache
  ) {}

  private async invalidatingMenu<T>(restaurantId: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } finally {
      this.menuCache?.invalidate(restaurantId);
    }
  }

  private resolveRestaurantId(query: { restaurantId?: string; slug?: string } = {}): Promise<string> {
    return resolvePublicRestaurantId(
      this.restaurantRepo,
      this.restaurantIdCache,
      query,
      'Restaurant ID or slug is required to view product additions.'
    );
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const authTenant = req.authContext?.restaurantId;
    const query = (req.query || {}) as { restaurantId?: string; slug?: string; productId?: string };

    let restaurantId: string;
    if (authTenant) {
      if (query.restaurantId && query.restaurantId !== authTenant && req.authContext?.role !== 'super_admin') {
        throw new UnauthorizedError('Access denied for requested restaurant context.');
      }
      restaurantId = authTenant;
    } else {
      restaurantId = await this.resolveRestaurantId(query);
    }

    const options = parsePagination(req.query);
    // Only anonymous storefront reads are cached; any token always goes to the repository.
    const cache = req.authContext ? undefined : this.menuCache;
    const queryKey = `additions:${query.productId ?? ''}:${options ? `p=${options.page}&l=${options.limit}` : 'all'}`;
    if (cache) {
      const hit = cache.get(restaurantId, queryKey);
      if (hit) {
        if (hit.totalCount !== undefined) reply.header('X-Total-Count', hit.totalCount);
        return reply.status(200).send(hit.body);
      }
    }
    const version = cache?.versionOf(restaurantId);

    let body: unknown[];
    let totalCount: string | undefined;
    if (options) {
      const { items, total } = await this.listAdditionsUseCase.execute(restaurantId, query.productId, options);
      totalCount = String(total);
      body = items;
    } else {
      body = await this.listAdditionsUseCase.execute(restaurantId, query.productId);
    }
    // Reached only after a successful read, so errors are never cached.
    cache?.set(restaurantId, queryKey, { body, totalCount }, version);
    if (totalCount !== undefined) reply.header('X-Total-Count', totalCount);
    return reply.status(200).send(body);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const query = (req.query || {}) as { restaurantId?: string; slug?: string };
    const authTenant = req.authContext?.restaurantId;

    let restaurantId: string;
    if (authTenant) {
      if (query.restaurantId && query.restaurantId !== authTenant && req.authContext?.role !== 'super_admin') {
        throw new UnauthorizedError('Access denied for requested restaurant context.');
      }
      restaurantId = authTenant;
    } else {
      restaurantId = await this.resolveRestaurantId(query);
    }

    const addition = await this.getAdditionByIdUseCase.execute(params.id, restaurantId);
    return reply.status(200).send(addition);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to create a product addition.');
    }

    const parsed = createProductAdditionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const addition = await this.invalidatingMenu(restaurantId, () =>
      this.createAdditionUseCase.execute(parsed.data as CreateProductAdditionDTO, restaurantId)
    );
    return reply.status(201).send(addition);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });

    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update a product addition.');
    }

    const parsed = updateProductAdditionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const updated = await this.invalidatingMenu(restaurantId, () =>
      this.updateAdditionUseCase.execute(params.id, parsed.data as UpdateProductAdditionDTO, restaurantId)
    );
    return reply.status(200).send(updated);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });

    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to delete a product addition.');
    }

    await this.invalidatingMenu(restaurantId, () => this.deleteAdditionUseCase.execute(params.id, restaurantId));
    return reply.status(204).send();
  }
}
