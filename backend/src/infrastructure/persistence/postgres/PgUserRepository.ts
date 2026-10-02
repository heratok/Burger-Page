import { User, UserRole } from '../../../domain/models/User.js';
import {
  UserRepository,
  GuardedUserChange,
  UserChanges,
  UserUpdateOutcome,
  RestoredUser,
} from '../../../domain/ports/out/UserRepository.js';
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
    mustChangePassword: row.must_change_password === undefined ? undefined : Boolean(row.must_change_password),
    passwordChangedAt: row.password_changed_at ? new Date(row.password_changed_at).toISOString() : undefined,
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
               is_active = COALESCE($5::boolean, is_active),
               must_change_password = COALESCE($6::boolean, must_change_password),
               password_changed_at = COALESCE($8::timestamptz, password_changed_at),
               updated_at = NOW()
             WHERE id = $7`,
            [user.username, user.passwordHash, user.role, user.restaurantId || null, user.isActive ?? null, user.mustChangePassword ?? null, existing.rows[0].id, user.passwordChangedAt ?? null]
          );
        } else {
          await client.query(
            `INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, must_change_password, created_at, password_changed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [user.id, user.username, user.passwordHash, user.role, user.restaurantId || null, user.isActive ?? true, user.mustChangePassword ?? false, user.createdAt || new Date().toISOString(), user.passwordChangedAt ?? null]
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

  /**
   * Serializes changes that could leave zero active super admins: every active
   * super_admin row is locked (consistent id order) before the check, so two
   * concurrent deactivations/deletes queue up and the second re-evaluates after
   * the first commits (READ COMMITTED re-checks the is_active predicate).
   */
  private async guarded(
    id: string,
    removesAccess: boolean,
    write: (client: import('pg').PoolClient) => Promise<void>
  ): Promise<GuardedUserChange> {
    return withTenantContext({ restaurantId: null, actorRole: 'super_admin' }, async (client) => {
      const { rows: locked } = await client.query(
        `SELECT id FROM public.users WHERE role = 'super_admin' AND is_active ORDER BY id FOR UPDATE`
      );
      const { rows } = await client.query(
        `SELECT id, role, is_active FROM public.users WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const target = rows[0];
      if (!target) return 'not_found';
      if (removesAccess && target.role === 'super_admin' && target.is_active) {
        const others = locked.filter((r) => r.id !== id);
        if (others.length === 0) return 'last_super_admin';
      }
      await write(client);
      return 'done';
    });
  }

  async setActive(id: string, isActive: boolean): Promise<GuardedUserChange> {
    return this.guarded(id, !isActive, async (client) => {
      await client.query(`UPDATE public.users SET is_active = $2, updated_at = NOW() WHERE id = $1`, [id, isActive]);
    });
  }

  async deleteGuarded(id: string): Promise<GuardedUserChange> {
    return this.guarded(id, true, async (client) => {
      await client.query(`DELETE FROM public.users WHERE id = $1`, [id]);
    });
  }

  async retireByRestaurantId(restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId, actorRole: 'super_admin' }, async (client) => {
      await client.query(
        `UPDATE public.users
            SET is_active = false,
                username = CASE WHEN username LIKE '%-deleted-' || restaurant_id
                                THEN username ELSE username || '-deleted-' || restaurant_id END,
                updated_at = NOW()
          WHERE restaurant_id = $1`,
        [restaurantId]
      );
    });
  }

  async updateGuarded(id: string, changes: UserChanges): Promise<UserUpdateOutcome> {
    try {
      return await withTenantContext({ restaurantId: null, actorRole: 'super_admin' }, async (client) => {
        // Same serialization as guarded(): every active super admin is locked
        // before the check so concurrent demotions/deactivations queue up.
        const { rows: locked } = await client.query(
          `SELECT id FROM public.users WHERE role = 'super_admin' AND is_active ORDER BY id FOR UPDATE`
        );
        const { rows } = await client.query(
          `SELECT id, role, is_active FROM public.users WHERE id = $1 FOR UPDATE`,
          [id]
        );
        const target = rows[0];
        if (!target) return 'not_found';
        const nextRole = changes.role ?? target.role;
        const nextActive = changes.isActive ?? target.is_active;
        const losesSuperAdmin = target.role === 'super_admin' && target.is_active && (nextRole !== 'super_admin' || !nextActive);
        if (losesSuperAdmin && locked.filter((r) => r.id !== id).length === 0) return 'last_super_admin';

        const sets: string[] = [];
        const values: unknown[] = [id];
        const set = (column: string, value: unknown) => {
          values.push(value);
          sets.push(`${column} = $${values.length}`);
        };
        if (changes.username !== undefined) set('username', changes.username);
        if (changes.role !== undefined) set('role', changes.role);
        if (changes.restaurantId !== undefined) set('restaurant_id', changes.restaurantId);
        if (changes.isActive !== undefined) set('is_active', changes.isActive);
        if (sets.length > 0) {
          await client.query(`UPDATE public.users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, values);
        }
        return 'done';
      });
    } catch (err: any) {
      // users.username is UNIQUE; the transaction was rolled back.
      if (err?.code === '23505') return 'username_taken';
      throw err;
    }
  }

  async restoreByRestaurantId(restaurantId: string): Promise<RestoredUser[]> {
    return withTenantContext({ restaurantId, actorRole: 'super_admin' }, async (client) => {
      const suffix = `-deleted-${restaurantId}`;
      const { rows } = await client.query(
        `SELECT id, username FROM public.users
          WHERE restaurant_id = $1 AND right(username, length($2::text)) = $2::text
          ORDER BY created_at ASC, id ASC FOR UPDATE`,
        [restaurantId, suffix]
      );
      const restored: RestoredUser[] = [];
      for (const row of rows) {
        const originalUsername: string = row.username.slice(0, -suffix.length);
        const { rowCount: taken } = await client.query(
          `SELECT 1 FROM public.users WHERE username = $1 AND id <> $2`,
          [originalUsername, row.id]
        );
        const username = taken ? `${originalUsername}-restored-${restaurantId}` : originalUsername;
        await client.query(
          `UPDATE public.users SET username = $2, is_active = true, updated_at = NOW() WHERE id = $1`,
          [row.id, username]
        );
        restored.push({ id: row.id, username, originalUsername });
      }
      return restored;
    });
  }
}
