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
    request: FastifyRequest<{ Body: CreateUserDTO }>,
    reply: FastifyReply
  ) {
    const user = await this.createUser.execute(request.body);
    const { passwordHash: _, ...safe } = user;
    return reply.status(201).send(safe);
  }

  async login(
    request: FastifyRequest<{ Body: { username: string; password: string } }>,
    reply: FastifyReply
  ) {
    const { username, password } = request.body;
    const result = await this.authenticate.execute(username, password);
    return reply.send(result);
  }

  async list(
    request: FastifyRequest<{ Querystring: { restaurantId?: string } }>,
    reply: FastifyReply
  ) {
    const users = await this.listUsers.execute(request.query.restaurantId);
    return reply.send(users);
  }
}
