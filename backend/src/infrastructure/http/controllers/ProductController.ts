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

export class ProductController {
  constructor(
    private listProducts: ListProductsUseCase,
    private getProduct: GetProductByIdUseCase,
    private createProductUseCase: CreateProductUseCase,
    private updateProductUseCase: UpdateProductUseCase,
    private deleteProductUseCase: DeleteProductUseCase,
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

    throw new ValidationError('Restaurant ID or slug is required to view menu products.');
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const authTenant = req.authContext?.restaurantId;

    if (authTenant) {
      // 1. Catálogo administrativo: devuelve todos los productos del tenant autenticado
      const products = await this.listProducts.execute(authTenant, false);
      return reply.status(200).send(products);
    }

    // 2. Catálogo público storefront: solo productos disponibles del restaurante solicitado
    const query = (req.query || {}) as { restaurantId?: string; slug?: string };
    const restaurantId = await this.resolveRestaurantId(query);
    const products = await this.listProducts.execute(restaurantId, true);
    return reply.status(200).send(products);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const query = (req.query || {}) as { restaurantId?: string; slug?: string };
    const authTenant = req.authContext?.restaurantId;
    let restaurantId = authTenant;

    if (!restaurantId) {
      restaurantId = await this.resolveRestaurantId(query);
    }

    const product = await this.getProduct.execute(params.id, restaurantId);
    return reply.status(200).send(product);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = req.authContext?.restaurantId;
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to create a product.');
    }

    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const product = await this.createProductUseCase.execute(parsed.data as CreateProductDTO, restaurantId);
    return reply.status(201).send(product);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = req.authContext?.restaurantId;
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update a product.');
    }

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const updated = await this.updateProductUseCase.execute(params.id, parsed.data as UpdateProductDTO, restaurantId);
    return reply.status(200).send(updated);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = req.authContext?.restaurantId;
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to delete a product.');
    }

    await this.deleteProductUseCase.execute(params.id, restaurantId);
    return reply.status(204).send();
  }
}
