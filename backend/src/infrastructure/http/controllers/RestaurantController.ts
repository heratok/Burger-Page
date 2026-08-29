import { FastifyRequest, FastifyReply } from 'fastify';
import { GetRestaurantUseCase } from '../../../application/use-cases/GetRestaurantUseCase.js';
import { UpdateRestaurantCategoriesUseCase } from '../../../application/use-cases/UpdateRestaurantCategoriesUseCase.js';
import { updateRestaurantCategoriesSchema } from '@burger-page/contracts';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';

export class RestaurantController {
  constructor(
    private getRestaurantUseCase: GetRestaurantUseCase,
    private updateCategoriesUseCase: UpdateRestaurantCategoriesUseCase
  ) {}

  async get(req: FastifyRequest<{ Params: { slug?: string } }>, reply: FastifyReply) {
    const slug = req.params.slug || 'burger-craft'; // Default store if no slug
    const restaurant = await this.getRestaurantUseCase.execute(slug);
    return reply.status(200).send(restaurant);
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
