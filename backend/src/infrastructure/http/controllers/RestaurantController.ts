import { FastifyRequest, FastifyReply } from 'fastify';
import { GetRestaurantUseCase } from '../../../application/use-cases/GetRestaurantUseCase.js';
import { ListRestaurantsUseCase } from '../../../application/use-cases/ListRestaurantsUseCase.js';
import { CreateRestaurantUseCase } from '../../../application/use-cases/CreateRestaurantUseCase.js';
import { DeleteRestaurantUseCase } from '../../../application/use-cases/DeleteRestaurantUseCase.js';
import { UpdateRestaurantCategoriesUseCase } from '../../../application/use-cases/UpdateRestaurantCategoriesUseCase.js';
import { createRestaurantSchema, updateRestaurantCategoriesSchema } from '@burger-page/contracts';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';

export class RestaurantController {
  constructor(
    private getRestaurantUseCase: GetRestaurantUseCase,
    private listRestaurantsUseCase: ListRestaurantsUseCase,
    private createRestaurantUseCase: CreateRestaurantUseCase,
    private deleteRestaurantUseCase: DeleteRestaurantUseCase,
    private updateCategoriesUseCase: UpdateRestaurantCategoriesUseCase
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

    const restaurants = await this.listRestaurantsUseCase.execute();
    return reply.status(200).send(restaurants);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createRestaurantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const created = await this.createRestaurantUseCase.execute(parsed.data);
    return reply.status(201).send(created);
  }

  async get(req: FastifyRequest, reply: FastifyReply) {
    const params = (req.params || {}) as { slug?: string; idOrSlug?: string };
    const identifier = params.idOrSlug || params.slug || 'burger-craft';
    const restaurant = await this.getRestaurantUseCase.execute(identifier);
    return reply.status(200).send(restaurant);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const params = (req.params || {}) as { id: string };
    await this.deleteRestaurantUseCase.execute(params.id);
    return reply.status(200).send({ message: 'Restaurant deleted successfully' });
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
      identifier = params.slug || auth.restaurantId || 'burger-craft';
    } else {
      // restaurant_admin is strictly bound to their assigned restaurant
      identifier = auth?.restaurantId || 'burger-craft';
    }

    const { categories } = parsed.data;
    const updated = await this.updateCategoriesUseCase.execute(identifier, categories);
    return reply.status(200).send({
      message: 'Restaurant categories updated successfully',
      categories: updated.categories || [],
    });
  }
}
