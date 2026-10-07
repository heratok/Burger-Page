import { Permission } from '@burger-page/contracts';
import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { Role } from '../../domain/models/Role.js';
import { ConflictError, EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';
import { diffFields } from '../../domain/shared/auditDetails.js';
import { validateRoleDescription, validateRoleName, validateRolePermissions } from './CreateRoleUseCase.js';

export interface UpdateRoleInput {
  name?: string;
  /** An empty string clears the description. */
  description?: string;
  permissions?: Permission[];
}

export class UpdateRoleUseCase {
  constructor(
    private roleRepo: RoleRepository,
    private audit?: AdminAuditRecorder
  ) {}

  async execute(id: string, restaurantId: string, input: UpdateRoleInput, actor?: AuditActor): Promise<Role> {
    const existing = await this.roleRepo.findById(id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError('Rol no encontrado.');
    }
    if (existing.isSystem) {
      throw new ConflictError('Los roles del sistema no se pueden editar.');
    }

    const { description: _previousDescription, ...base } = existing;
    const description =
      input.description !== undefined ? validateRoleDescription(input.description) : existing.description;
    const updated: Role = {
      ...base,
      ...(description ? { description } : {}),
      name: input.name !== undefined ? validateRoleName(input.name) : existing.name,
      permissions: input.permissions !== undefined ? validateRolePermissions(input.permissions) : existing.permissions,
      updatedAt: new Date().toISOString(),
    };

    await this.roleRepo.save(updated);

    const flat = (r: Role) => ({ name: r.name, description: r.description ?? null, permissions: r.permissions });
    const diff = diffFields(flat(existing), flat(updated), ['name', 'description', 'permissions']);
    if (diff.changedFields.length > 0) {
      await this.audit?.record(actor, {
        action: 'role.update',
        targetType: 'role',
        targetId: updated.id,
        targetLabel: updated.name,
        restaurantId,
        details: diff,
      });
    }
    return updated;
  }
}
