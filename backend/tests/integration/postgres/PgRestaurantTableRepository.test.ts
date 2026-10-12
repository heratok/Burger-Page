import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgRestaurantTableRepository } from '../../../src/infrastructure/persistence/postgres/PgRestaurantTableRepository.js';
import { PgOrderRepository } from '../../../src/infrastructure/persistence/postgres/PgOrderRepository.js';
import { ConflictError } from '../../../src/domain/errors/DomainErrors.js';
import { Order } from '../../../src/domain/models/Order.js';
import { RestaurantTable } from '../../../src/domain/models/RestaurantTable.js';
import { formatTableName } from '@burger-page/contracts';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgRestaurantTableRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgRestaurantTableRepository;
  let orderRepo: PgOrderRepository;
  const suffix = randomUUID().slice(0, 8);
  const REST_A = `pgtbl-a-${suffix}`;
  const REST_B = `pgtbl-b-${suffix}`;
  const PRODUCT_ID = `pgtbl-prod-${suffix}`;

  const table = (restaurantId: string, zone: string, number: number, over: Partial<RestaurantTable> = {}): RestaurantTable => {
    const alias = over.alias ?? null;
    return {
      id: `tbl_${randomUUID()}`,
      restaurantId,
      zone,
      number,
      alias,
      name: formatTableName({ zone, number, alias }),
      sortOrder: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...over,
    };
  };

  const newOrder = (restaurantId: string) =>
    new Order(
      `ord-${randomUUID().slice(0, 8)}`,
      restaurantId,
      undefined,
      [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'x', unitPrice: 0, quantity: 1 }],
      'pending',
      new Date(),
      0,
      undefined,
      'Efectivo'
    );

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1,$1,'A',true),($2,$2,'B',true)`,
        [REST_A, REST_B]
      );
      await adminPool.query(
        `INSERT INTO public.products (id, restaurant_id, name, price, is_available) VALUES ($1, $2, 'Burger', 1000, true)`,
        [PRODUCT_ID, REST_A]
      );
      repo = new PgRestaurantTableRepository();
      orderRepo = new PgOrderRepository();
    } catch (err: any) {
      console.warn(`\n[PgRestaurantTableRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.orders WHERE restaurant_id IN ($1, $2)`, [REST_A, REST_B]);
      await adminPool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [REST_A, REST_B]);
    }
    await adminPool?.end();
  });

  it('saves, reads back in sort order, updates and deletes a table', async () => {
    if (!isDbConnected) return;
    const second = table(REST_A, 'Mesa', 2, { sortOrder: 1 });
    const first = table(REST_A, 'Mesa', 1, { sortOrder: 0 });
    await repo.save(second);
    await repo.save(first);

    expect((await repo.findByRestaurantId(REST_A)).map((t) => t.name)).toEqual(['Mesa 1', 'Mesa 2']);

    await repo.save({ ...first, zone: 'Terraza', number: 3, alias: 'Barra', name: 'Terraza 3 · Barra', isActive: false, sortOrder: 5 });
    expect(await repo.findById(first.id, REST_A)).toMatchObject({
      zone: 'Terraza',
      number: 3,
      alias: 'Barra',
      name: 'Terraza 3 · Barra',
      isActive: false,
      sortOrder: 5,
    });

    await repo.delete(first.id, REST_A);
    expect(await repo.findById(first.id, REST_A)).toBeNull();
  });

  it('orders ties on sort order by lower(zone) then number', async () => {
    if (!isDbConnected) return;
    const REST = `pgtbl-order-${suffix}`;
    await adminPool.query(`INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1,$1,'O',true)`, [REST]);
    try {
      await repo.saveMany([table(REST, 'Terraza', 10), table(REST, 'Terraza', 2), table(REST, 'mesa', 9)]);
      expect((await repo.findByRestaurantId(REST)).map((t) => t.name)).toEqual(['Mesa 9', 'Terraza 2', 'Terraza 10']);
    } finally {
      await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [REST]);
    }
  });

  it('enforces unique (zone, number) per restaurant ignoring case and surrounding spaces, but not across restaurants', async () => {
    if (!isDbConnected) return;
    await repo.save(table(REST_A, 'Barra', 1));

    await expect(repo.save(table(REST_A, ' BARRA ', 1))).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.save(table(REST_A, 'barra', 1, { alias: 'otro' }))).rejects.toThrow("Ya existe la mesa 'Barra 1'");
    await expect(repo.save(table(REST_A, 'Barra', 2))).resolves.toBeUndefined();
    await expect(repo.save(table(REST_B, 'Barra', 1))).resolves.toBeUndefined();
  });

  it('saveMany inserts every table or none in one transaction', async () => {
    if (!isDbConnected) return;
    await repo.save(table(REST_A, 'Lote', 2));

    await expect(repo.saveMany([table(REST_A, 'Lote', 1), table(REST_A, 'Lote', 2), table(REST_A, 'Lote', 3)])).rejects.toBeInstanceOf(
      ConflictError
    );
    expect((await repo.findByRestaurantId(REST_A)).filter((t) => t.zone === 'Lote').map((t) => t.number)).toEqual([2]);

    await repo.saveMany([table(REST_A, 'Lote', 1), table(REST_A, 'Lote', 3)]);
    expect((await repo.findByRestaurantId(REST_A)).filter((t) => t.zone === 'Lote').map((t) => t.number).sort()).toEqual([1, 2, 3]);
  });

  it('isolates tenants through RLS: another tenant context cannot read or delete the table', async () => {
    if (!isDbConnected) return;
    const t = table(REST_A, 'Privada', 1);
    await repo.save(t);

    expect(await repo.findById(t.id, REST_B)).toBeNull();
    expect((await repo.findByRestaurantId(REST_B)).some((x) => x.id === t.id)).toBe(false);
    await repo.delete(t.id, REST_B);
    expect(await repo.findById(t.id, REST_A)).not.toBeNull();
  });

  it('rejects a table that does not satisfy the db checks (blank zone, bad number, long alias, bad id)', async () => {
    if (!isDbConnected) return;
    await expect(repo.save(table(REST_A, '   ', 1))).rejects.toThrow();
    await expect(repo.save(table(REST_A, 'Ok', 0))).rejects.toThrow();
    await expect(repo.save(table(REST_A, 'Ok', 10000))).rejects.toThrow();
    await expect(repo.save(table(REST_A, 'Ok', 1, { alias: 'x'.repeat(31) }))).rejects.toThrow();
    await expect(repo.save(table(REST_A, 'Ok', 1, { id: 'bad id!' }))).rejects.toThrow();
  });

  it('stores the table on an order, reads it back, and keeps the label when the table is deleted', async () => {
    if (!isDbConnected) return;
    const t = table(REST_A, 'Pedido', 1);
    await repo.save(t);
    const order = newOrder(REST_A);
    order.tableId = t.id;
    order.tableLabel = t.name;
    await orderRepo.save(order);

    const found = await orderRepo.findById(order.id, REST_A);
    expect(found).toMatchObject({ tableId: t.id, tableLabel: 'Pedido 1' });

    await repo.delete(t.id, REST_A);

    const after = await orderRepo.findById(order.id, REST_A);
    expect(after?.tableId).toBeUndefined();
    expect(after?.tableLabel).toBe('Pedido 1');
    const raw = await adminPool.query(`SELECT table_id, table_label FROM public.orders WHERE id = $1`, [order.id]);
    expect(raw.rows[0]).toEqual({ table_id: null, table_label: 'Pedido 1' });
  });

  it('updates, moves and detaches the table of an existing order', async () => {
    if (!isDbConnected) return;
    const t1 = table(REST_A, 'MesaU', 1);
    const t2 = table(REST_A, 'MesaU', 2);
    await repo.save(t1);
    await repo.save(t2);
    const order = newOrder(REST_A);
    await orderRepo.save(order);

    const loaded = (await orderRepo.findById(order.id, REST_A))!;
    loaded.tableId = t1.id;
    loaded.tableLabel = t1.name;
    await orderRepo.update(loaded, REST_A);
    expect(await orderRepo.findById(order.id, REST_A)).toMatchObject({ tableId: t1.id, tableLabel: 'MesaU 1' });

    const moved = (await orderRepo.findById(order.id, REST_A))!;
    moved.tableId = t2.id;
    moved.tableLabel = t2.name;
    await orderRepo.update(moved, REST_A);
    expect(await orderRepo.findById(order.id, REST_A)).toMatchObject({ tableId: t2.id, tableLabel: 'MesaU 2' });

    const detached = (await orderRepo.findById(order.id, REST_A))!;
    detached.tableId = undefined;
    detached.tableLabel = undefined;
    await orderRepo.update(detached, REST_A);
    const final = await orderRepo.findById(order.id, REST_A);
    expect(final?.tableId).toBeUndefined();
    expect(final?.tableLabel).toBeUndefined();
  });

  it('the composite FK refuses an order that points at a table of another restaurant', async () => {
    if (!isDbConnected) return;
    const foreign = table(REST_B, 'Ajena', 1);
    await repo.save(foreign);
    const order = newOrder(REST_A);
    order.tableId = foreign.id;
    order.tableLabel = foreign.name;

    await expect(orderRepo.save(order)).rejects.toThrow(/fk_orders_table_tenant|foreign key/i);
  });
});
