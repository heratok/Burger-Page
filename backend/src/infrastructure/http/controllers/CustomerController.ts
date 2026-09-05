import { FastifyRequest, FastifyReply } from 'fastify';
import { ListCustomersUseCase } from '../../../application/use-cases/ListCustomersUseCase.js';
import { GetCustomerByIdUseCase } from '../../../application/use-cases/GetCustomerByIdUseCase.js';
import { CreateCustomerUseCase } from '../../../application/use-cases/CreateCustomerUseCase.js';
import { UpdateCustomerUseCase } from '../../../application/use-cases/UpdateCustomerUseCase.js';
import { DeleteCustomerUseCase } from '../../../application/use-cases/DeleteCustomerUseCase.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { UnauthorizedError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { CreateCustomerDTO, UpdateCustomerDTO } from '../../../application/dtos/index.js';

export class CustomerController {
  constructor(
    private listCustomersUseCase: ListCustomersUseCase,
    private getCustomerByIdUseCase?: GetCustomerByIdUseCase,
    private createCustomerUseCase?: CreateCustomerUseCase,
    private updateCustomerUseCase?: UpdateCustomerUseCase,
    private deleteCustomerUseCase?: DeleteCustomerUseCase,
    private restaurantRepo?: RestaurantRepository
  ) {}

  private async resolveRestaurantId(req: FastifyRequest): Promise<string> {
    let restaurantId = req.authContext?.restaurantId;
    if (!restaurantId && req.authContext?.role === 'super_admin') {
      const query = (req.query || {}) as any;
      const body = (req.body || {}) as any;
      const headers = (req.headers || {}) as any;
      restaurantId =
        query?.restaurantId ||
        body?.restaurantId ||
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
    const restaurantId = await this.resolveRestaurantId(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to list customers.');
    }
    const customers = await this.listCustomersUseCase.execute(restaurantId);
    return reply.status(200).send(customers);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.resolveRestaurantId(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to view customer details.');
    }
    const params = req.params as { id: string };
    if (!this.getCustomerByIdUseCase) {
      throw new ValidationError('GetCustomerByIdUseCase not configured.');
    }
    const customer = await this.getCustomerByIdUseCase.execute(params.id, restaurantId);
    return reply.status(200).send(customer);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.resolveRestaurantId(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to create a customer.');
    }
    const body = req.body as CreateCustomerDTO;
    if (!this.createCustomerUseCase) {
      throw new ValidationError('CreateCustomerUseCase not configured.');
    }
    const customer = await this.createCustomerUseCase.execute(body, restaurantId);
    return reply.status(201).send(customer);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.resolveRestaurantId(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update a customer.');
    }
    const params = req.params as { id: string };
    const body = req.body as UpdateCustomerDTO;
    if (!this.updateCustomerUseCase) {
      throw new ValidationError('UpdateCustomerUseCase not configured.');
    }
    const customer = await this.updateCustomerUseCase.execute(params.id, body, restaurantId);
    return reply.status(200).send(customer);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.resolveRestaurantId(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to delete a customer.');
    }
    const params = req.params as { id: string };
    if (!this.deleteCustomerUseCase) {
      throw new ValidationError('DeleteCustomerUseCase not configured.');
    }
    await this.deleteCustomerUseCase.execute(params.id, restaurantId);
    return reply.status(204).send();
  }
}
