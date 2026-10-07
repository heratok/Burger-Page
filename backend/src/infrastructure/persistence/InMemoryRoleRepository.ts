import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { Role } from '../../domain/models/Role.js';
import { ConflictError } from '../../domain/errors/DomainErrors.js';

export const normalizeRoleName = (name: string): string => name.replace(/\s+/g, ' ').trim().toLowerCase();

const copy = (r: Role): Role => ({ ...r, permissions: [...r.permissions] });

export class InMemoryRoleRepository implements RoleRepository {
  private roles: Map<string, Role> = new Map();

  constructor(initial: Role[] = []) {
    for (const r of initial) this.roles.set(r.id, copy(r));
  }

  async findByRestaurantId(restaurantId: string): Promise<Role[]> {
    return Array.from(this.roles.values())
      .filter((r) => r.restaurantId === restaurantId)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map(copy);
  }

  async findById(id: string, restaurantId: string): Promise<Role | null> {
    const r = this.roles.get(id);
    return r && r.restaurantId === restaurantId ? copy(r) : null;
  }

  async save(role: Role): Promise<void> {
    const wanted = normalizeRoleName(role.name);
    const duplicate = Array.from(this.roles.values()).some(
      (r) => r.restaurantId === role.restaurantId && r.id !== role.id && normalizeRoleName(r.name) === wanted
    );
    if (duplicate) {
      throw new ConflictError(`Ya existe un rol llamado '${role.name}'.`);
    }
    this.roles.set(role.id, copy(role));
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const r = this.roles.get(id);
    if (r && r.restaurantId === restaurantId) this.roles.delete(id);
  }
}
