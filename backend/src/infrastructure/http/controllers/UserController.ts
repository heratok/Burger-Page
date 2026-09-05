import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateUserUseCase } from '../../../application/use-cases/CreateUserUseCase.js';
import { AuthenticateUserUseCase } from '../../../application/use-cases/AuthenticateUserUseCase.js';
import { ListUsersUseCase } from '../../../application/use-cases/ListUsersUseCase.js';
import { CreateUserDTO } from '../../../application/dtos/index.js';

export class UserController {
  constructor(
    private createUser: CreateUserUseCase,
    private authenticate: AuthenticateUserUseCase,
    private listUsers: ListUsersUseCase
  ) {}

  async create(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const user = await this.createUser.execute(request.body as CreateUserDTO);
    const { passwordHash: _, ...safe } = user;
    return reply.status(201).send(safe);
  }

  async login(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { username, password } = (request.body || {}) as { username: string; password: string };
    request.log.info(`[AUTH] Intento de login para usuario: "${username}"`);
    try {
      const result = await this.authenticate.execute(username, password);
      request.log.info(`[AUTH] Login exitoso para usuario: "${username}" (Rol: ${result.user?.role})`);
      return reply.send(result);
    } catch (err: any) {
      request.log.warn(`[AUTH] Login fallido para usuario: "${username}" -> Razón: ${err.message}`);
      throw err;
    }
  }

  async list(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const auth = request.authContext;
    const query = (request.query || {}) as { restaurantId?: string };
    let resolvedRestaurantId: string | undefined;

    if (auth?.role === 'super_admin') {
      resolvedRestaurantId = query.restaurantId;
    } else {
      // restaurant_admin is strictly locked to their assigned restaurant
      resolvedRestaurantId = auth?.restaurantId;
    }

    const users = await this.listUsers.execute(resolvedRestaurantId);
    return reply.send(users);
  }
}
