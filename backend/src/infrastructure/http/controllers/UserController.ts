import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateUserUseCase } from '../../../application/use-cases/CreateUserUseCase.js';
import { AuthenticateUserUseCase } from '../../../application/use-cases/AuthenticateUserUseCase.js';
import { ListUsersUseCase } from '../../../application/use-cases/ListUsersUseCase.js';
import { SetUserActiveUseCase } from '../../../application/use-cases/SetUserActiveUseCase.js';
import { DeleteUserUseCase } from '../../../application/use-cases/DeleteUserUseCase.js';
import { ResetUserPasswordUseCase } from '../../../application/use-cases/ResetUserPasswordUseCase.js';
import { ChangeOwnPasswordUseCase } from '../../../application/use-cases/ChangeOwnPasswordUseCase.js';
import { CreateUserDTO } from '../../../application/dtos/index.js';

export class UserController {
  constructor(
    private createUser: CreateUserUseCase,
    private authenticate: AuthenticateUserUseCase,
    private listUsers: ListUsersUseCase,
    private setUserActive: SetUserActiveUseCase,
    private deleteUser: DeleteUserUseCase,
    private resetUserPassword: ResetUserPasswordUseCase,
    private changeOwnPassword: ChangeOwnPasswordUseCase
  ) {}

  async create(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const user = await this.createUser.execute(request.body as CreateUserDTO, request.authContext?.role);
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
      if (!auth?.restaurantId) {
        return reply.status(403).send({
          type: 'https://example.com/probs/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Restaurant administrator has no assigned restaurant.',
        });
      }
      // restaurant_admin is strictly locked to their assigned restaurant
      resolvedRestaurantId = auth.restaurantId;
    }

    const users = await this.listUsers.execute(resolvedRestaurantId, auth?.role);
    return reply.send(users);
  }

  async setActive(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { isActive } = request.body as { isActive: boolean };
    const user = await this.setUserActive.execute({
      actorId: request.authContext!.userId,
      targetId: id,
      isActive,
    });
    const { passwordHash: _, ...safe } = user;
    return reply.send(safe);
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await this.deleteUser.execute({ actorId: request.authContext!.userId, targetId: id });
    return reply.status(204).send();
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.resetUserPassword.execute({ targetId: id });
    return reply.send(result);
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    const { token } = await this.changeOwnPassword.execute({
      userId: request.authContext!.userId,
      currentPassword,
      newPassword,
    });
    return reply.send({ success: true, token });
  }
}
