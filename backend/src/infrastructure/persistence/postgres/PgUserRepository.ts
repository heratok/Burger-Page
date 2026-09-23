import { User, UserRole } from '../../../domain/models/User.js';
import { UserRepository } from '../../../domain/ports/out/UserRepository.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    restaurantId: row.restaurant_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
        isActive: row.is_active === undefined ? undefined : Boolean(row.is_active),
  };
}

export class PgUserRepository implements UserRepository {
  // findById/findByUsername have no restaurantId in their port signature —
  // they run with no tenant context and are used before restaurantId is
  // known (login bootstrap in AuthenticateUserUseCase, the delete() row
  // probe). Direct no-context table reads are denied by RLS (JD-CRIT-03), so
  // these two lookups are the only no-context readers and route through the
  // narrow SECURITY DEFINER escape hatch look_up_user_for_auth(_by_id),
  // which matches the login credential exactly and returns at most one row.
  async findById(id: string): Promise<User | null> {
    return withTenantContext({ restaurantId: null }, async (client) => {
      // C2: mark the lookup as login bootstrap so the SECURITY DEFINER escape
      // hatch accepts it (see look_up_user_for_auth_by_id in 01_schema.sql).
      await client.query("SELECT set_config('app.auth_bootstrap', 'true', true)");
      const { rows } = await client.query(`SELECT * FROM public.look_up_user_for_auth_by_id($1)`, [id]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return withTenantContext({ restaurantId: null }, async (client) => {
      await client.query("SELECT set_config('app.auth_bootstrap', 'true', true)");
      const { rows } = await client.query(`SELECT * FROM public.look_up_user_for_auth($1)`, [username]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<User[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.users WHERE restaurant_id = $1`, [restaurantId]);
      return rows.map(mapRow);
    });
  }

  async findAll(actorRole?: UserRole): Promise<User[]> {
    // SUS-03: the tenant context GUC comes from the caller's granted role, never
    // a hardcoded super_admin — an undefined actorRole omits app.actor_role so
    // RLS applies with the caller's real identity.
    return withTenantContext({ restaurantId: null, ...(actorRole ? { actorRole } : {}) }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.users ORDER BY created_at DESC`);
      return rows.map(mapRow);
    });
  }

  async save(user: User, actorRole?: UserRole): Promise<void> {
    await withTenantContext(
      { restaurantId: user.restaurantId ?? null, ...(actorRole ? { actorRole } : {}) },
      async (client) => {
        const existing = await client.query(`SELECT id FROM public.users WHERE username = $1 OR id = $2`, [user.username, user.id]);
        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE public.users SET
               username = $1,
               password_hash = $2,
               role = $3,
               restaurant_id = $4,
               updated_at = NOW()
             WHERE id = $5`,
            [user.username, user.passwordHash, user.role, user.restaurantId || null, existing.rows[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, true, $6)`,
            [user.id, user.username, user.passwordHash, user.role, user.restaurantId || null, user.createdAt || new Date().toISOString()]
          );
        }
      }
    );
  }

  async delete(id: string, actorRole?: UserRole): Promise<void> {
    // The findById probe legitimately runs with no tenant context: it resolves
    // the row (and hence its restaurant) before tenant scoping is known.
    const existing = await this.findById(id);
    await withTenantContext(
      { restaurantId: existing?.restaurantId ?? null, ...(actorRole ? { actorRole } : {}) },
      async (client) => {
        await client.query(`DELETE FROM public.users WHERE id = $1`, [id]);
      }
    );
  }
}
