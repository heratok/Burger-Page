import { FastifyRequest, FastifyReply } from 'fastify';
import { ListCustomersUseCase } from '../../../application/use-cases/ListCustomersUseCase.js';
import { GetCustomerByIdUseCase } from '../../../application/use-cases/GetCustomerByIdUseCase.js';
import { CreateCustomerUseCase } from '../../../application/use-cases/CreateCustomerUseCase.js';
import { UpdateCustomerUseCase } from '../../../application/use-cases/UpdateCustomerUseCase.js';
import { DeleteCustomerUseCase } from '../../../application/use-cases/DeleteCustomerUseCase.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { UnauthorizedError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { resolveTenantForRequest } from '../TenantResolver.js';
import { CreateCustomerDTO, UpdateCustomerDTO } from '../../../application/dtos/index.js';
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

export class CustomerController {
  constructor(
    private listCustomersUseCase: ListCustomersUseCase,
    private getCustomerByIdUseCase?: GetCustomerByIdUseCase,
    private createCustomerUseCase?: CreateCustomerUseCase,
    private updateCustomerUseCase?: UpdateCustomerUseCase,
    private deleteCustomerUseCase?: DeleteCustomerUseCase,
    private restaurantRepo?: RestaurantRepository
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to list customers.');
    }
    const options = parsePagination(req.query);
    if (options) {
      const { items, total } = await this.listCustomersUseCase.execute(restaurantId, options);
      reply.header('X-Total-Count', String(total));
      return reply.status(200).send(items);
    }
    const customers = await this.listCustomersUseCase.execute(restaurantId);
    return reply.status(200).send(customers);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo });
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
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
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
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
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
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
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
