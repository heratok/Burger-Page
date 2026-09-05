import { FastifyRequest, FastifyReply } from 'fastify';
import { ListProductsUseCase } from '../../../application/use-cases/ListProductsUseCase.js';
import { GetProductByIdUseCase } from '../../../application/use-cases/GetProductByIdUseCase.js';
import { CreateProductUseCase } from '../../../application/use-cases/CreateProductUseCase.js';
import { UpdateProductUseCase } from '../../../application/use-cases/UpdateProductUseCase.js';
import { DeleteProductUseCase } from '../../../application/use-cases/DeleteProductUseCase.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { createProductSchema, updateProductSchema } from '@burger-page/contracts';
import { ValidationError, UnauthorizedError, EntityNotFoundError } from '../../../domain/errors/DomainErrors.js';
import { CreateProductDTO, UpdateProductDTO } from '../../../application/dtos/index.js';
import { StorageUrlResolver, defaultStorageUrlResolver } from '../../storage/StorageUrlResolver.js';

export class ProductController {
  private storageResolver: StorageUrlResolver;

  constructor(
    private listProducts: ListProductsUseCase,
    private getProduct: GetProductByIdUseCase,
    private createProductUseCase: CreateProductUseCase,
    private updateProductUseCase: UpdateProductUseCase,
    private deleteProductUseCase: DeleteProductUseCase,
    private restaurantRepo?: RestaurantRepository,
    storageResolver?: StorageUrlResolver
  ) {
    this.storageResolver = storageResolver || defaultStorageUrlResolver;
  }

  private formatProduct(product: any): any {
    if (!product) return product;
    return {
      ...product,
      imageUrl: this.storageResolver.resolveImageUrl(product.imageUrl),
    };
  }

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

    throw new ValidationError('Restaurant ID or slug is required to view menu products.');
  }

  private async resolveTenantForMutation(req: FastifyRequest): Promise<string> {
    let restaurantId = req.authContext?.restaurantId;
    if (!restaurantId && req.authContext?.role === 'super_admin') {
      const body = req.body as any;
      const query = req.query as any;
      const headers = req.headers as any;
      restaurantId =
        body?.restaurantId ||
        query?.restaurantId ||
        headers?.['x-restaurant-id'];

      if (!restaurantId && this.restaurantRepo) {
        const all = await this.restaurantRepo.findAll();
        const active = all.find((r) => r.isActive);
        if (active) restaurantId = active.id;
      }
    }
    return restaurantId || '';
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const authTenant = req.authContext?.restaurantId;

    if (authTenant) {
      // 1. Catálogo administrativo: devuelve todos los productos del tenant autenticado
      const products = await this.listProducts.execute(authTenant, false);
      return reply.status(200).send(products.map((p) => this.formatProduct(p)));
    }

    // 2. Super admin o catálogo público storefront
    const query = (req.query || {}) as { restaurantId?: string; slug?: string };
    let restaurantId = await this.resolveTenantForMutation(req);
    if (!restaurantId) {
      restaurantId = await this.resolveRestaurantId(query);
    }
    const isAvailableOnly = req.authContext?.role === 'super_admin' ? false : true;
    const products = await this.listProducts.execute(restaurantId, isAvailableOnly);
    return reply.status(200).send(products.map((p) => this.formatProduct(p)));
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const query = (req.query || {}) as { restaurantId?: string; slug?: string };
    let restaurantId = await this.resolveTenantForMutation(req);

    if (!restaurantId) {
      restaurantId = await this.resolveRestaurantId(query);
    }

    const product = await this.getProduct.execute(params.id, restaurantId);
    return reply.status(200).send(this.formatProduct(product));
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.resolveTenantForMutation(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to create a product.');
    }

    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const dto = parsed.data as CreateProductDTO;
    if (dto.imageUrl) {
      dto.imageUrl = this.storageResolver.toRelativeStoragePath(dto.imageUrl);
    }

    const product = await this.createProductUseCase.execute(dto, restaurantId);
    return reply.status(201).send(this.formatProduct(product));
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await this.resolveTenantForMutation(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update a product.');
    }

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const dto = parsed.data as UpdateProductDTO;
    if (dto.imageUrl !== undefined) {
      dto.imageUrl = dto.imageUrl ? this.storageResolver.toRelativeStoragePath(dto.imageUrl) : dto.imageUrl;
    }

    const updated = await this.updateProductUseCase.execute(params.id, dto, restaurantId);
    return reply.status(200).send(this.formatProduct(updated));
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await this.resolveTenantForMutation(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to delete a product.');
    }

    await this.deleteProductUseCase.execute(params.id, restaurantId);
    return reply.status(204).send();
  }
}
