import { FastifyRequest, FastifyReply } from 'fastify';
import { ListCustomersUseCase } from '../../../application/use-cases/ListCustomersUseCase.js';

export class CustomerController {
  constructor(private listCustomersUseCase: ListCustomersUseCase) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const customers = await this.listCustomersUseCase.execute();
    return reply.status(200).send(customers);
  }
}
