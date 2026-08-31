import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgInventoryRepository } from '../../../src/infrastructure/persistence/postgres/PgInventoryRepository.js';
import { Inventory } from '../../../src/domain/models/Inventory.js';
import { EntityNotFoundError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgInventoryRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgInventoryRepository;
  const RESTAURANT_A = `pginv-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `pginv-rest-b-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });

    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active)
         VALUES ($1, $1, 'PgInventory Test A', true), ($2, $2, 'PgInventory Test B', true)
         ON CONFLICT (id) DO UPDATE SET is_active = true`,
        [RESTAURANT_A, RESTAURANT_B]
      );
      repo = new PgInventoryRepository();
    } catch (err: any) {
      console.warn(`\n⚠️ [PgInventoryRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterEach(async () => {
    if (!isDbConnected) return;
    await adminPool.query(`DELETE FROM public.inventory_items WHERE restaurant_id IN ($1, $2)`, [
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

  it('saves a new inventory item and finds it by id, scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const item: Inventory = {
      id: `inv-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Queso Cheddar',
      category: 'ingredients',
      quantity: 10,
      unit: 'kg',
      minStockAlert: 5,
      alertThreshold: 5,
      costPerUnit: 25000,
    };

    await repo.save(item);
    const found = await repo.findById(item.id, RESTAURANT_A);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('Queso Cheddar');
    expect(found?.restaurantId).toBe(RESTAURANT_A);
    expect(found?.quantity).toBe(10);
    expect(found?.unit).toBe('kg');
    expect(found?.costPerUnit).toBe(25000);
  });

  it('does not find an inventory item under a different tenant (RLS-enforced isolation)', async () => {
    if (!isDbConnected) return;
    const item: Inventory = {
      id: `inv-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Gaseosa',
      category: 'beverages',
      quantity: 20,
      unit: 'unidades',
      minStockAlert: 5,
      alertThreshold: 5,
      costPerUnit: 3000,
    };
    await repo.save(item);

    const foreign = await repo.findById(item.id, RESTAURANT_B);
    expect(foreign).toBeNull();
  });

  it('lists inventory items for a restaurant', async () => {
    if (!isDbConnected) return;
    await repo.save({
      id: `inv-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Zeta Item',
      category: 'other',
      quantity: 1,
      unit: 'unidades',
      minStockAlert: 1,
      alertThreshold: 1,
      costPerUnit: 100,
    });
    await repo.save({
      id: `inv-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Alpha Item',
      category: 'other',
      quantity: 1,
      unit: 'unidades',
      minStockAlert: 1,
      alertThreshold: 1,
      costPerUnit: 100,
    });

    const list = await repo.findByRestaurantId(RESTAURANT_A);
    expect(list.map((i) => i.name).sort()).toEqual(['Alpha Item', 'Zeta Item']);
  });

  it('updates an existing inventory item on save (upsert semantics)', async () => {
    if (!isDbConnected) return;
    const id = `inv-${randomUUID().slice(0, 8)}`;
    await repo.save({
      id,
      restaurantId: RESTAURANT_A,
      name: 'Original',
      category: 'ingredients',
      quantity: 5,
      unit: 'kg',
      minStockAlert: 1,
      alertThreshold: 1,
      costPerUnit: 1000,
    });
    await repo.save({
      id,
      restaurantId: RESTAURANT_A,
      name: 'Renamed',
      category: 'ingredients',
      quantity: 8,
      unit: 'kg',
      minStockAlert: 1,
      alertThreshold: 1,
      costPerUnit: 1500,
    });

    const found = await repo.findById(id, RESTAURANT_A);
    expect(found?.name).toBe('Renamed');
    expect(found?.quantity).toBe(8);
    expect(found?.costPerUnit).toBe(1500);
  });

  it('deletes an inventory item scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const id = `inv-${randomUUID().slice(0, 8)}`;
    await repo.save({
      id,
      restaurantId: RESTAURANT_A,
      name: 'ToDelete',
      category: 'other',
      quantity: 1,
      unit: 'unidades',
      minStockAlert: 1,
      alertThreshold: 1,
      costPerUnit: 100,
    });

    await repo.delete(id, RESTAURANT_A);
    expect(await repo.findById(id, RESTAURANT_A)).toBeNull();
  });

  describe('adjustStock via adjust_inventory_stock RPC', () => {
    it('restocks with a positive delta', async () => {
      if (!isDbConnected) return;
      const id = `inv-${randomUUID().slice(0, 8)}`;
      await repo.save({
        id,
        restaurantId: RESTAURANT_A,
        name: 'Restock Item',
        category: 'ingredients',
        quantity: 0,
        unit: 'kg',
        minStockAlert: 5,
        alertThreshold: 5,
        costPerUnit: 25000,
      });

      const updated = await repo.adjustStock(id, RESTAURANT_A, 50);
      expect(updated.quantity).toBe(50);
    });

    it('decrements with a negative delta when stock is sufficient', async () => {
      if (!isDbConnected) return;
      const id = `inv-${randomUUID().slice(0, 8)}`;
      await repo.save({
        id,
        restaurantId: RESTAURANT_A,
        name: 'Decrement Item',
        category: 'ingredients',
        quantity: 50,
        unit: 'kg',
        minStockAlert: 5,
        alertThreshold: 5,
        costPerUnit: 25000,
      });

      const updated = await repo.adjustStock(id, RESTAURANT_A, -15);
      expect(updated.quantity).toBe(35);
    });

    it('throws ValidationError when a negative delta would go below zero (guard blocks, stock unchanged)', async () => {
      if (!isDbConnected) return;
      const id = `inv-${randomUUID().slice(0, 8)}`;
      await repo.save({
        id,
        restaurantId: RESTAURANT_A,
        name: 'Insufficient Item',
        category: 'ingredients',
        quantity: 35,
        unit: 'kg',
        minStockAlert: 5,
        alertThreshold: 5,
        costPerUnit: 25000,
      });

      await expect(repo.adjustStock(id, RESTAURANT_A, -100)).rejects.toThrow(ValidationError);

      const found = await repo.findById(id, RESTAURANT_A);
      expect(found?.quantity).toBe(35);
    });

    it('throws EntityNotFoundError when adjusting an item under a different tenant (RLS blocks the RPC)', async () => {
      if (!isDbConnected) return;
      const id = `inv-${randomUUID().slice(0, 8)}`;
      await repo.save({
        id,
        restaurantId: RESTAURANT_A,
        name: 'Cross Tenant Item',
        category: 'ingredients',
        quantity: 10,
        unit: 'kg',
        minStockAlert: 5,
        alertThreshold: 5,
        costPerUnit: 25000,
      });

      await expect(repo.adjustStock(id, RESTAURANT_B, 10)).rejects.toThrow(EntityNotFoundError);
    });
  });
});
