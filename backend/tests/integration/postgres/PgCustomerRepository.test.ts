import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgCustomerRepository } from '../../../src/infrastructure/persistence/postgres/PgCustomerRepository.js';
import { Customer } from '../../../src/domain/models/Customer.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgCustomerRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgCustomerRepository;
  const RESTAURANT_A = `pgcust-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `pgcust-rest-b-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });

    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active)
         VALUES ($1, $1, 'PgCustomer Test A', true), ($2, $2, 'PgCustomer Test B', true)
         ON CONFLICT (id) DO UPDATE SET is_active = true`,
        [RESTAURANT_A, RESTAURANT_B]
      );
      repo = new PgCustomerRepository();
    } catch (err: any) {
      console.warn(`\n⚠️ [PgCustomerRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterEach(async () => {
    if (!isDbConnected) return;
    await adminPool.query(`DELETE FROM public.customers WHERE restaurant_id IN ($1, $2)`, [
      RESTAURANT_A,
      RESTAURANT_B,
    ]);
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [RESTAURANT_A, RESTAURANT_B]);
    }
    await adminPool?.end();
  });

  it('saves a new customer and finds it by id, scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const customer = new Customer(
      `cust-${randomUUID().slice(0, 8)}`,
      RESTAURANT_A,
      'Juan Perez',
      '3001234567',
      'Calle 1',
      'Centro',
      'no nuts',
      'juan@example.com'
    );

    await repo.save(customer);
    const found = await repo.findById(customer.id, RESTAURANT_A);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('Juan Perez');
    expect(found?.phone).toBe('3001234567');
    expect(found?.restaurantId).toBe(RESTAURANT_A);
  });

  it('does not find a customer under a different tenant (RLS-enforced isolation)', async () => {
    if (!isDbConnected) return;
    const customer = new Customer(`cust-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Ana Gomez', '3009876543');
    await repo.save(customer);

    const foreign = await repo.findById(customer.id, RESTAURANT_B);
    expect(foreign).toBeNull();
  });

  it('lists customers for a restaurant', async () => {
    if (!isDbConnected) return;
    await repo.save(new Customer(`cust-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Zeta Customer', '3001111111'));
    await repo.save(new Customer(`cust-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Alpha Customer', '3002222222'));

    const list = await repo.findByRestaurantId(RESTAURANT_A);
    expect(list.length).toBe(2);
    expect(list.every((c) => c.restaurantId === RESTAURANT_A)).toBe(true);
  });

  it('finds a customer by phone, scoped to tenant', async () => {
    if (!isDbConnected) return;
    const phone = `300${randomUUID().slice(0, 7)}`;
    await repo.save(new Customer(`cust-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Carlos Ruiz', phone));

    const found = await repo.findByPhone(phone, RESTAURANT_A);
    expect(found?.name).toBe('Carlos Ruiz');

    const foreign = await repo.findByPhone(phone, RESTAURANT_B);
    expect(foreign).toBeNull();
  });

  it('updates an existing customer on save (upsert semantics)', async () => {
    if (!isDbConnected) return;
    const id = `cust-${randomUUID().slice(0, 8)}`;
    await repo.save(new Customer(id, RESTAURANT_A, 'Original Name', '3005555555'));
    await repo.save(new Customer(id, RESTAURANT_A, 'Renamed', '3005555555', 'New Address'));

    const found = await repo.findById(id, RESTAURANT_A);
    expect(found?.name).toBe('Renamed');
    expect(found?.address).toBe('New Address');
  });

  it('deletes a customer scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const id = `cust-${randomUUID().slice(0, 8)}`;
    await repo.save(new Customer(id, RESTAURANT_A, 'ToDelete', '3006666666'));

    await repo.delete(id, RESTAURANT_A);
    expect(await repo.findById(id, RESTAURANT_A)).toBeNull();
  });
});
