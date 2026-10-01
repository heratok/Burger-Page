import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgSupplierRepository } from '../../../src/infrastructure/persistence/postgres/PgSupplierRepository.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgSupplierRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgSupplierRepository;
  const RESTAURANT = `pgsup-rest-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(`INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1, $1, 'PgSupplier Test', true)`, [
        RESTAURANT,
      ]);
      repo = new PgSupplierRepository();
    } catch (err: any) {
      console.warn(`\n[PgSupplierRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [RESTAURANT]);
    }
    await adminPool?.end();
  });

  it("stores empty contact fields as NULL and maps them back to '' / undefined (db-hardening-0008 T8)", async () => {
    if (!isDbConnected) return;
    const id = `sup-${randomUUID().slice(0, 8)}`;
    await repo.save({
      id,
      restaurantId: RESTAURANT,
      name: 'Proveedor Vacio',
      category: 'general',
      contactName: '',
      phone: '',
      email: '',
    } as any);

    const raw = await adminPool.query(`SELECT contact_name, phone, email FROM public.suppliers WHERE id = $1`, [id]);
    expect(raw.rows[0]).toEqual({ contact_name: null, phone: null, email: null });

    const found = await repo.findById(id, RESTAURANT);
    expect(found?.contactName).toBe('');
    expect(found?.phone).toBe('');
    expect(found?.email).toBeUndefined();
  });

  it('round-trips real contact values unchanged', async () => {
    if (!isDbConnected) return;
    const id = `sup-${randomUUID().slice(0, 8)}`;
    await repo.save({
      id,
      restaurantId: RESTAURANT,
      name: 'Proveedor Completo',
      category: 'general',
      contactName: 'Ana',
      phone: '3001112222',
      email: 'ana@prov.co',
    } as any);
    const found = await repo.findById(id, RESTAURANT);
    expect(found).toMatchObject({ contactName: 'Ana', phone: '3001112222', email: 'ana@prov.co' });
  });
});
