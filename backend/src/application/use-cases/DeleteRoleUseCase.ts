import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { ConflictError, EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';

export class DeleteRoleUseCase {
  constructor(
    private roleRepo: RoleRepository,
    private userRepo: UserRepository,
    private audit?: AdminAuditRecorder
  ) {}

  /** Refused while any user of the restaurant still holds the role (users.role_id also enforces it). */
  async execute(id: string, restaurantId: string, actor?: AuditActor): Promise<void> {
    const existing = await this.roleRepo.findById(id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError('Rol no encontrado.');
    }
    if (existing.isSystem) {
      throw new ConflictError('Los roles del sistema no se pueden borrar.');
    }

    const holders = (await this.userRepo.findByRestaurantId(restaurantId)).filter((u) => u.roleId === id);
    if (holders.length > 0) {
      throw new ConflictError(
        `No se puede borrar el rol '${existing.name}': lo usan ${holders.length} usuario(s). Reasígnalos o bórralos primero.`
      );
    }

    await this.roleRepo.delete(id, restaurantId);
    await this.audit?.record(actor, {
      action: 'role.delete',
      targetType: 'role',
      targetId: existing.id,
      targetLabel: existing.name,
      restaurantId,
      details: { name: existing.name, permissions: existing.permissions },
    });
  }
}
