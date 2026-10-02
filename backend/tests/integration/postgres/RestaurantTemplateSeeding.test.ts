import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/infrastructure/http/app.js';
import { JwtService } from '../../../src/infrastructure/security/JwtService.js';
import { getRestaurantTemplate } from '../../../src/domain/templates/restaurantTemplates.js';
import { CreateRestaurantUseCase } from '../../../src/application/use-cases/CreateRestaurantUseCase.js';
import { PgRestaurantRepository } from '../../../src/infrastructure/persistence/postgres/PgRestaurantRepository.js';
import { PgCategoryRepository } from '../../../src/infrastructure/persistence/postgres/PgCategoryRepository.js';
import { PgProductRepository } from '../../../src/infrastructure/persistence/postgres/PgProductRepository.js';
import { PgProductAdditionRepository } from '../../../src/infrastructure/persistence/postgres/PgProductAdditionRepository.js';
import { PgUserRepository } from '../../../src/infrastructure/persistence/postgres/PgUserRepository.js';
import { CryptoPasswordHasher } from '../../../src/infrastructure/security/CryptoPasswordHasher.js';
import type { ProductAdditionRepository } from '../../../src/domain/ports/out/ProductAdditionRepository.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

// Creating a restaurant from a template must leave a storefront that already
// shows its dishes: rows owned by the new tenant, available, RLS-visible to an
// anonymous visitor, and all-or-nothing when the seeding fails.
describe('restaurant template seeding (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let app: FastifyInstance;
  const suffix = randomUUID().slice(0, 8);
  const SUPER_ID = `user-b2-super-${suffix}`;
  const createdSlugs: string[] = [];
  const jwt = new JwtService();
  const headers = () => ({
    authorization: `Bearer ${jwt.generateToken({ id: SUPER_ID, username: `b2super_${suffix}`, role: 'super_admin' })}`,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
    } catch (err: any) {
      console.warn(`\n[RestaurantTemplateSeeding] Skipping: cannot connect (${err.message}).`);
      return;
    }
    await adminPool.query(
      `INSERT INTO public.users (id, username, password_hash, role, is_active)
       VALUES ($1, $2, 'x', 'super_admin', true)`,
      [SUPER_ID, `b2super_${suffix}`]
    );
    app = buildApp(undefined, { driver: 'postgres', rateLimit: { enabled: false } });
    await app.ready();
  });

  afterAll(async () => {
    if (!isDbConnected) return;
    await app.close();
    for (const slug of createdSlugs) {
      const { rows } = await adminPool.query('SELECT id FROM public.restaurants WHERE slug = $1', [slug]);
      for (const { id } of rows) {
        await adminPool.query('DELETE FROM public.users WHERE restaurant_id = $1', [id]);
        await adminPool.query('DELETE FROM public.products WHERE restaurant_id = $1', [id]);
        await adminPool.query('DELETE FROM public.restaurants WHERE id = $1', [id]);
      }
    }
    await adminPool.query('DELETE FROM public.users WHERE id = $1', [SUPER_ID]);
    await adminPool.end();
  });

  it('burger template: the products and additions are in the public store right after create', async () => {
    if (!isDbConnected) return;
    const slug = `b2-burger-${suffix}`;
    createdSlugs.push(slug);
    const template = getRestaurantTemplate('burger')!;

    const create = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: headers(),
      payload: {
        name: 'Burger B2',
        slug,
        templateType: 'burger',
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        currencySymbol: 'MX$',
      },
    });
    expect(create.statusCode).toBe(201);

    // Anonymous visitor: no token, resolved by slug, only RLS-visible rows.
    const products = await app.inject({ method: 'GET', url: `/api/products?slug=${slug}` });
    expect(products.statusCode).toBe(200);
    const list = products.json();
    expect(list.map((p: any) => p.name).sort()).toEqual(template.products.map((p) => p.name).sort());
    for (const p of list) {
      expect(p.restaurantId).toBe(create.json().id);
      expect(p.isAvailable).toBe(true);
      expect(p.category).toBeTruthy();
      expect(p.price).toBeGreaterThan(0);
      expect(p.price).toBeLessThan(500); // scaled from COP to MXN
    }

    const additions = await app.inject({ method: 'GET', url: `/api/additions?slug=${slug}` });
    expect(additions.statusCode).toBe(200);
    expect(additions.json().map((a: any) => a.name).sort()).toEqual(template.additions.map((a) => a.name).sort());

    // Currency and timezone landed in restaurant_settings.
    const { rows } = await adminPool.query(
      'SELECT timezone, currency, currency_symbol FROM public.restaurant_settings WHERE restaurant_id = $1',
      [create.json().id]
    );
    expect(rows[0]).toEqual({ timezone: 'America/Mexico_City', currency: 'MXN', currency_symbol: 'MX$' });

    // Categories are the products' real parents.
    const cats = await adminPool.query(
      'SELECT name FROM public.categories WHERE restaurant_id = $1 ORDER BY display_order',
      [create.json().id]
    );
    expect(cats.rows.map((r) => r.name)).toEqual(template.categories);
  });

  it('blank template creates a store with no dishes and default currency', async () => {
    if (!isDbConnected) return;
    const slug = `b2-blank-${suffix}`;
    createdSlugs.push(slug);
    const create = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: headers(),
      payload: { name: 'Blank B2', slug, templateType: 'blank' },
    });
    expect(create.statusCode).toBe(201);
    const products = await app.inject({ method: 'GET', url: `/api/products?slug=${slug}` });
    expect(products.json()).toEqual([]);
    const { rows } = await adminPool.query(
      'SELECT timezone, currency, currency_symbol FROM public.restaurant_settings WHERE restaurant_id = $1',
      [create.json().id]
    );
    expect(rows[0]).toEqual({ timezone: 'America/Bogota', currency: 'COP', currency_symbol: '$' });
  });

  it('rolls back the tenant, admin user and seeded rows when seeding fails midway', async () => {
    if (!isDbConnected) return;
    const slug = `b2-fail-${suffix}`;
    createdSlugs.push(slug);
    const realAdditions = new PgProductAdditionRepository();
    let saves = 0;
    const failedTenantIds: string[] = [];
    const failingAdditions: ProductAdditionRepository = {
      findById: (id, r) => realAdditions.findById(id, r),
      findByRestaurantId: (r, o) => realAdditions.findByRestaurantId(r, o),
      findByProductId: (p, r) => realAdditions.findByProductId(p, r),
      delete: (id, r) => realAdditions.delete(id, r),
      save: async (a) => {
        if (!failedTenantIds.includes(a.restaurantId)) failedTenantIds.push(a.restaurantId);
        if (++saves === 3) throw new Error('addition write failed');
        return realAdditions.save(a);
      },
    };
    const useCase = new CreateRestaurantUseCase(
      new PgRestaurantRepository(),
      new PgCategoryRepository(),
      new PgUserRepository(),
      new CryptoPasswordHasher(),
      new PgProductRepository(),
      failingAdditions
    );

    await expect(
      useCase.execute({ name: 'Fail B2', slug, templateType: 'burger', adminUsername: `b2fail_${suffix}` })
    ).rejects.toThrow('addition write failed');

    expect(failedTenantIds.length).toBe(1);
    const tenantId = failedTenantIds[0];
    for (const table of ['restaurants', 'categories', 'products', 'product_additions', 'users']) {
      const column = table === 'restaurants' ? 'id' : 'restaurant_id';
      const { rows } = await adminPool.query(`SELECT COUNT(*)::int AS n FROM public.${table} WHERE ${column} = $1`, [
        tenantId,
      ]);
      expect(rows[0].n, table).toBe(0);
    }
    const bySlug = await adminPool.query('SELECT 1 FROM public.restaurants WHERE slug = $1', [slug]);
    expect(bySlug.rowCount).toBe(0);
    const byUsername = await adminPool.query('SELECT 1 FROM public.users WHERE username = $1', [`b2fail_${suffix}`]);
    expect(byUsername.rowCount).toBe(0);
  });
});
