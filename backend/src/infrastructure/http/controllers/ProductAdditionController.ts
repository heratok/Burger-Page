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
    private restaurantRepo?: RestaurantRepository
  ) {}

  private async resolveRestaurantId(query: { restaurantId?: string; slug?: string } = {}): Promise<string> {
    if (query.restaurantId) {
      if (this.restaurantRepo) {
        const rest = await this.restaurantRepo.findById(query.restaurantId);
        if (!rest) {
          throw new EntityNotFoundError(`Restaurant '${query.restaurantId}' not found.`);
        }
        if (!rest.isActive) {
          throw new ValidationError(`Restaurant '${rest.name}' is currently inactive.`);
        }
      }
      return query.restaurantId;
    }

    if (query.slug && this.restaurantRepo) {
      const rest = await this.restaurantRepo.findBySlug(query.slug);
      if (!rest) {
        throw new EntityNotFoundError(`Restaurant with slug '${query.slug}' not found.`);
      }
      if (!rest.isActive) {
        throw new ValidationError(`Restaurant '${rest.name}' is currently inactive.`);
      }
      return rest.id;
    }

    throw new ValidationError('Restaurant ID or slug is required to view product additions.');
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
    if (options) {
      const { items, total } = await this.listAdditionsUseCase.execute(restaurantId, query.productId, options);
      reply.header('X-Total-Count', String(total));
      return reply.status(200).send(items);
    }
    const additions = await this.listAdditionsUseCase.execute(restaurantId, query.productId);
    return reply.status(200).send(additions);
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

    const addition = await this.createAdditionUseCase.execute(parsed.data as CreateProductAdditionDTO, restaurantId);
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

    const updated = await this.updateAdditionUseCase.execute(params.id, parsed.data as UpdateProductAdditionDTO, restaurantId);
    return reply.status(200).send(updated);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });

    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to delete a product addition.');
    }

    await this.deleteAdditionUseCase.execute(params.id, restaurantId);
    return reply.status(204).send();
  }
}
