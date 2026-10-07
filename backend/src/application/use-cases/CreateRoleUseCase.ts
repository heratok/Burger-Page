import { isPermission, MAX_ROLE_DESCRIPTION_LENGTH, Permission } from '@burger-page/contracts';
import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { MAX_ROLE_NAME_LENGTH, Role } from '../../domain/models/Role.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
}

/** Trims, collapses inner whitespace and validates a role name; shared by create and update. */
export function validateRoleName(raw: string | undefined): string {
  const name = raw?.replace(/\s+/g, ' ').trim();
  if (!name) {
    throw new ValidationError('El nombre del rol es obligatorio');
  }
  if (name.length > MAX_ROLE_NAME_LENGTH) {
    throw new ValidationError(`El nombre del rol no puede superar ${MAX_ROLE_NAME_LENGTH} caracteres`);
  }
  return name;
}

/** Empty or blank means "no description". */
export function validateRoleDescription(raw: string | undefined): string | undefined {
  const description = raw?.trim();
  if (!description) return undefined;
  if (description.length > MAX_ROLE_DESCRIPTION_LENGTH) {
    throw new ValidationError(`La descripción no puede superar ${MAX_ROLE_DESCRIPTION_LENGTH} caracteres`);
  }
  return description;
}

/** Every entry must belong to the permission catalog; repeats collapse, order is kept. */
export function validateRolePermissions(raw: readonly unknown[] | undefined): Permission[] {
  if (!Array.isArray(raw)) {
    throw new ValidationError('Los permisos del rol deben ser una lista');
  }
  const unknown = raw.filter((p) => !isPermission(p));
  if (unknown.length > 0) {
    throw new ValidationError(`Permisos desconocidos: ${unknown.map(String).join(', ')}`);
  }
  return [...new Set(raw as Permission[])];
}

export class CreateRoleUseCase {
  constructor(
    private roleRepo: RoleRepository,
    private audit?: AdminAuditRecorder
  ) {}

  async execute(restaurantId: string, input: CreateRoleInput, actor?: AuditActor): Promise<Role> {
    const name = validateRoleName(input.name);
    const description = validateRoleDescription(input.description);
    const permissions = validateRolePermissions(input.permissions);

    const now = new Date().toISOString();
    const role: Role = {
      id: newId(ID_PREFIX.role),
      restaurantId,
      name,
      ...(description ? { description } : {}),
      permissions,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.roleRepo.save(role);
    await this.audit?.record(actor, {
      action: 'role.create',
      targetType: 'role',
      targetId: role.id,
      targetLabel: role.name,
      restaurantId,
      details: { name: role.name, permissions: role.permissions },
    });
    return role;
  }
}
