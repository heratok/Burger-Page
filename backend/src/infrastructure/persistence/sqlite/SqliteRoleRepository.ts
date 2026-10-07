import { Database } from 'better-sqlite3';
import { isPermission } from '@burger-page/contracts';
import { Role } from '../../../domain/models/Role.js';
import { RoleRepository } from '../../../domain/ports/out/RoleRepository.js';
import { ConflictError } from '../../../domain/errors/DomainErrors.js';

export class SqliteRoleRepository implements RoleRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: any): Role {
    let permissions: unknown = [];
    try {
      permissions = JSON.parse(row.permissions ?? '[]');
    } catch {
      permissions = [];
    }
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      permissions: Array.isArray(permissions) ? permissions.filter(isPermission) : [],
      isSystem: Boolean(row.is_system),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  async findByRestaurantId(restaurantId: string): Promise<Role[]> {
    const rows = this.db
      .prepare('SELECT * FROM roles WHERE restaurant_id = ? ORDER BY lower(name) ASC')
      .all(restaurantId) as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  async findById(id: string, restaurantId: string): Promise<Role | null> {
    const row = this.db.prepare('SELECT * FROM roles WHERE id = ? AND restaurant_id = ?').get(id, restaurantId) as any;
    return row ? this.mapToDomain(row) : null;
  }

  async save(role: Role): Promise<void> {
    const duplicate = this.db
      .prepare('SELECT id FROM roles WHERE restaurant_id = ? AND lower(trim(name)) = lower(trim(?)) AND id != ?')
      .get(role.restaurantId, role.name, role.id);
    if (duplicate) {
      throw new ConflictError(`Ya existe un rol llamado '${role.name}'.`);
    }
    this.db
      .prepare(`
        INSERT INTO roles (id, restaurant_id, name, description, permissions, is_system, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          permissions = excluded.permissions,
          updated_at = excluded.updated_at
        WHERE roles.restaurant_id = excluded.restaurant_id
      `)
      .run(
        role.id,
        role.restaurantId,
        role.name,
        role.description ?? null,
        JSON.stringify(role.permissions),
        role.isSystem ? 1 : 0,
        role.createdAt || new Date().toISOString(),
        role.updatedAt || new Date().toISOString()
      );
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db.prepare('DELETE FROM roles WHERE id = ? AND restaurant_id = ?').run(id, restaurantId);
  }
}
