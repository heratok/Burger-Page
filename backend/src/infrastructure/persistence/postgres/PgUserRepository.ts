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
  };
}

export class PgUserRepository implements UserRepository {
  // findById/findByUsername/findAll have no restaurantId in their port
  // signature — they run with no tenant context, relying on the
  // users_select_for_auth RLS policy (SELECT USING (true)), the one
  // legitimately pre-tenant-context read (login resolves the user before
  // restaurantId is known).
  async findById(id: string): Promise<User | null> {
    return withTenantContext({ restaurantId: null }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.users WHERE id = $1`, [id]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return withTenantContext({ restaurantId: null }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.users WHERE username = $1`, [username]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<User[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.users WHERE restaurant_id = $1`, [restaurantId]);
      return rows.map(mapRow);
    });
  }

  async findAll(): Promise<User[]> {
    return withTenantContext({ restaurantId: null, actorRole: 'super_admin' }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.users ORDER BY created_at DESC`);
      return rows.map(mapRow);
    });
  }

  async save(user: User): Promise<void> {
    await withTenantContext({ restaurantId: user.restaurantId ?? null }, async (client) => {
      await client.query(
        `INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           restaurant_id = EXCLUDED.restaurant_id`,
        [user.id, user.username, user.passwordHash, user.role, user.restaurantId || null, user.createdAt || new Date().toISOString()]
      );
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    await withTenantContext(
      { restaurantId: existing?.restaurantId ?? null, actorRole: 'super_admin' },
      async (client) => {
        await client.query(`DELETE FROM public.users WHERE id = $1`, [id]);
      }
    );
  }
}
