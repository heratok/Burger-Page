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

  async list(_req: FastifyRequest, reply: FastifyReply) {
    const restaurants = await this.listRestaurantsUseCase.execute();
    return reply.status(200).send(restaurants);
  }

  async create(req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) {
    const parsed = createRestaurantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const created = await this.createRestaurantUseCase.execute(parsed.data);
    return reply.status(201).send(created);
  }

  async get(req: FastifyRequest<{ Params: { slug?: string; idOrSlug?: string } }>, reply: FastifyReply) {
    const identifier = req.params.idOrSlug || req.params.slug || 'burger-craft';
    const restaurant = await this.getRestaurantUseCase.execute(identifier);
    return reply.status(200).send(restaurant);
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await this.deleteRestaurantUseCase.execute(req.params.id);
    return reply.status(200).send({ message: 'Restaurant deleted successfully' });
  }

  async updateCategories(
    req: FastifyRequest<{ Params: { slug?: string }; Body: unknown }>,
    reply: FastifyReply
  ) {
    const parsed = updateRestaurantCategoriesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const slug = req.params.slug || 'burger-craft';
    const { categories } = parsed.data;
    const updated = await this.updateCategoriesUseCase.execute(slug, categories);
    return reply.status(200).send({
      message: 'Restaurant categories updated successfully',
      categories: updated.categories || [],
    });
  }
}
