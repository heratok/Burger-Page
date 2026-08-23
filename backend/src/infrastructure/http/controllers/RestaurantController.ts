import { FastifyRequest, FastifyReply } from 'fastify';
import { GetRestaurantUseCase } from '../../../application/use-cases/GetRestaurantUseCase.js';

export class RestaurantController {
  constructor(private getRestaurantUseCase: GetRestaurantUseCase) {}

  async get(req: FastifyRequest<{ Params: { slug?: string } }>, reply: FastifyReply) {
    const slug = req.params.slug || 'burger-craft'; // Default store if no slug
    const restaurant = await this.getRestaurantUseCase.execute(slug);
    return reply.status(200).send(restaurant);
  }
}
