import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgAuditLogRepository } from '../../../src/infrastructure/persistence/postgres/PgAuditLogRepository.js';
import { AuditLogEntry } from '../../../src/domain/models/AuditLogEntry.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgAuditLogRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let appPool: pg.Pool;
  let repo: PgAuditLogRepository;
  const RUN = randomUUID().slice(0, 8);
  const ACTOR = `audit-actor-${RUN}`;
  const REST = `audit-rest-${RUN}`;

  const entry = (n: number, over: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
    id: `aud_${RUN}_${String(n).padStart(3, '0')}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(),
    actorUserId: ACTOR,
    actorUsername: 'root',
    action: 'restaurant.update',
    targetType: 'restaurant',
    targetId: REST,
    targetLabel: 'Rest',
    restaurantId: REST,
    details: { changedFields: ['name'] },
    ...over,
  });

  async function asRole<T>(role: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.actor_role', $1, true)", [role ?? '']);
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    appPool = new Pool({ connectionString: APP_USER_DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      repo = new PgAuditLogRepository();
    } catch (err: any) {
      console.warn(`\n[PgAuditLogRepository] Skipping: cannot connect (${err.message}).`);
    }
  });

  beforeEach(async () => {
    if (isDbConnected) await adminPool.query(`DELETE FROM public.admin_audit_log WHERE actor_user_id = $1`, [ACTOR]);
  });

  afterAll(async () => {
    if (isDbConnected) await adminPool.query(`DELETE FROM public.admin_audit_log WHERE actor_user_id = $1`, [ACTOR]);
    await adminPool?.end();
    await appPool?.end();
  });

  it('records an entry and lists it back with every field', async () => {
    if (!isDbConnected) return;
    const e = entry(1, { details: { changes: { name: { from: 'A', to: 'B' } } } });
    await repo.record(e);
    const page = await repo.list({ limit: 10, actorUserId: ACTOR });
    expect(page.items).toEqual([e]);
    expect(page.nextCursor).toBeNull();
  });

  it('keyset-paginates newest first without skipping or repeating, ties broken by id', async () => {
    if (!isDbConnected) return;
    const t = '2026-02-01T00:00:00.000Z';
    for (let i = 1; i <= 3; i++) await repo.record(entry(i));
    await repo.record(entry(4, { createdAt: t }));
    await repo.record(entry(5, { createdAt: t }));
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await repo.list({ limit: 2, actorUserId: ACTOR, cursor });
      seen.push(...page.items.map((i) => i.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toEqual([5, 4, 3, 2, 1].map((n) => `aud_${RUN}_${String(n).padStart(3, '0')}`));
  });

  it('filters by action, restaurantId and inclusive from/to', async () => {
    if (!isDbConnected) return;
    await repo.record(entry(1, { action: 'restaurant.create' }));
    await repo.record(entry(2, { action: 'user.create', targetType: 'user', restaurantId: null }));
    await repo.record(entry(3, { action: 'user.delete', targetType: 'user' }));
    const ids = async (f: object) => (await repo.list({ limit: 10, actorUserId: ACTOR, ...f })).items.map((i) => i.action);
    expect(await ids({ action: 'user.create' })).toEqual(['user.create']);
    expect(await ids({ restaurantId: REST })).toEqual(['user.delete', 'restaurant.create']);
    expect(await ids({ from: entry(2).createdAt, to: entry(3).createdAt })).toEqual(['user.delete', 'user.create']);
  });

  it('rejects a malformed cursor with ValidationError', async () => {
    if (!isDbConnected) return;
    await expect(repo.list({ limit: 5, cursor: 'garbage' })).rejects.toThrow(ValidationError);
  });

  it('survives the hard delete of the actor reference and of the restaurant (no foreign keys)', async () => {
    if (!isDbConnected) return;
    await repo.record(entry(1, { restaurantId: 'rest-that-never-existed', actorUserId: ACTOR }));
    const { rows } = await adminPool.query(
      `SELECT count(*)::int AS n FROM information_schema.table_constraints WHERE table_name = 'admin_audit_log' AND constraint_type = 'FOREIGN KEY'`
    );
    expect(rows[0].n).toBe(0);
  });

  it('app_user cannot UPDATE or DELETE rows, even as super_admin', async () => {
    if (!isDbConnected) return;
    await repo.record(entry(1));
    await expect(
      asRole('super_admin', (c) => c.query(`UPDATE public.admin_audit_log SET target_label = 'x' WHERE actor_user_id = $1`, [ACTOR]))
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asRole('super_admin', (c) => c.query(`DELETE FROM public.admin_audit_log WHERE actor_user_id = $1`, [ACTOR]))
    ).rejects.toThrow(/permission denied/i);
    const { rows } = await adminPool.query(`SELECT target_label FROM public.admin_audit_log WHERE actor_user_id = $1`, [ACTOR]);
    expect(rows).toEqual([{ target_label: 'Rest' }]);
  });

  it('the immutability trigger rejects UPDATE for the table owner too', async () => {
    if (!isDbConnected) return;
    await repo.record(entry(1));
    await expect(
      adminPool.query(`UPDATE public.admin_audit_log SET target_label = 'x' WHERE actor_user_id = $1`, [ACTOR])
    ).rejects.toThrow(/append-only/);
  });

  it('RLS: a tenant or anonymous session can neither read nor append; only super_admin can', async () => {
    if (!isDbConnected) return;
    await repo.record(entry(1));
    for (const role of ['restaurant_admin', null]) {
      const seen = await asRole(role, (c) => c.query(`SELECT 1 FROM public.admin_audit_log WHERE actor_user_id = $1`, [ACTOR]));
      expect(seen.rowCount).toBe(0);
      await expect(
        asRole(role, (c) =>
          c.query(
            `INSERT INTO public.admin_audit_log (id, actor_user_id, actor_username, action, target_type, target_id) VALUES ($1, $2, 'x', 'user.create', 'user', 'u')`,
            [`aud_${RUN}_rls_${role ?? 'anon'}`, ACTOR]
          )
        )
      ).rejects.toThrow(/row-level security/i);
    }
    const sup = await asRole('super_admin', (c) => c.query(`SELECT 1 FROM public.admin_audit_log WHERE actor_user_id = $1`, [ACTOR]));
    expect(sup.rowCount).toBe(1);
  });

  it('the database refuses a non-object details value or an unknown target type', async () => {
    if (!isDbConnected) return;
    await expect(
      adminPool.query(`INSERT INTO public.admin_audit_log (id, actor_username, action, target_type, target_id, details) VALUES ($1, 'x', 'user.create', 'user', 'u', '[]'::jsonb)`, [`aud_${RUN}_bad1`])
    ).rejects.toThrow(/chk_admin_audit_log_details_object/);
    await expect(
      adminPool.query(`INSERT INTO public.admin_audit_log (id, actor_username, action, target_type, target_id) VALUES ($1, 'x', 'user.create', 'order', 'u')`, [`aud_${RUN}_bad2`])
    ).rejects.toThrow(/chk_admin_audit_log_target_type/);
  });
});
