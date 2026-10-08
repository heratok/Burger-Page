import { isPermission } from '@burger-page/contracts';
import { Role } from '../../../domain/models/Role.js';
import { RoleRepository } from '../../../domain/ports/out/RoleRepository.js';
import { ConflictError } from '../../../domain/errors/DomainErrors.js';
import { withTenantContext } from './PgClient.js';

const NAME_INDEX = 'uq_roles_name';
const USERS_FK = 'fk_users_role_tenant';

function mapRow(row: any): Role {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    permissions: (row.permissions ?? []).filter(isPermission),
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export class PgRoleRepository implements RoleRepository {
  async findByRestaurantId(restaurantId: string): Promise<Role[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.roles WHERE restaurant_id = $1 ORDER BY lower(name) ASC, id ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async findById(id: string, restaurantId: string): Promise<Role | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.roles WHERE id = $1 AND restaurant_id = $2`, [
        id,
        restaurantId,
      ]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async save(role: Role): Promise<void> {
    try {
      await withTenantContext({ restaurantId: role.restaurantId }, async (client) => {
        await client.query(
          `INSERT INTO public.roles (id, restaurant_id, name, description, permissions, is_system, created_at)
           VALUES ($1, $2, $3, $4, $5::text[], $6, COALESCE($7::timestamptz, NOW()))
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             description = EXCLUDED.description,
             permissions = EXCLUDED.permissions
           WHERE public.roles.restaurant_id = EXCLUDED.restaurant_id`,
          [
            role.id,
            role.restaurantId,
            role.name,
            role.description ?? null,
            role.permissions,
            role.isSystem,
            role.createdAt || null,
          ]
        );
      });
    } catch (err: any) {
      if (err?.code === '23505' && (!err?.constraint || err.constraint === NAME_INDEX)) {
        throw new ConflictError(`Ya existe un rol llamado '${role.name}'.`);
      }
      throw err;
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    try {
      await withTenantContext({ restaurantId }, async (client) => {
        await client.query(`DELETE FROM public.roles WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
      });
    } catch (err: any) {
      if (err?.code === '23503' && (!err?.constraint || err.constraint === USERS_FK)) {
        throw new ConflictError('No se puede borrar el rol: todavía lo usan usuarios.');
      }
      throw err;
    }
  }
}
