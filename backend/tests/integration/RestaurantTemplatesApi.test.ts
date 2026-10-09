import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { listRestaurantTemplateSummaries } from '../../src/domain/templates/restaurantTemplates.js';

describe('Restaurant templates API (super-admin-panel B2)', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  const superToken = jwt.generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });
  const tenantToken = jwt.generateToken({
    id: 'user-admin-craft',
    username: 'admin_craft',
    role: 'restaurant_admin',
    restaurantId: 'burger-craft',
  });
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  it('GET /api/restaurants/templates lists every template with counts derived from the data module', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/restaurants/templates', headers: auth(superToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(listRestaurantTemplateSummaries());
    const burger = res.json().find((t: any) => t.id === 'burger');
    expect(burger.productCount).toBeGreaterThanOrEqual(6);
    expect(burger.additionCount).toBeGreaterThanOrEqual(7);
    expect(res.json().find((t: any) => t.id === 'blank')).toMatchObject({ productCount: 0, additionCount: 0 });
  });

  it('is super admin only', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/restaurants/templates' })).statusCode).toBe(401);
    const forbidden = await app.inject({ method: 'GET', url: '/api/restaurants/templates', headers: auth(tenantToken) });
    expect(forbidden.statusCode).toBe(403);
  });

  it('POST /api/restaurants with a template makes the dishes public right away and stores currency and timezone', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: auth(superToken),
      payload: {
        name: 'Pizzería Nueva',
        slug: 'pizzeria-nueva',
        templateType: 'pizza',
        timezone: 'America/Lima',
        currency: 'PEN',
        currencySymbol: 'S/',
      },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().timezone).toBe('America/Lima');
    expect(create.json().config).toMatchObject({ currency: 'PEN', currencySymbol: 'S/' });

    const products = await app.inject({ method: 'GET', url: '/api/products?slug=pizzeria-nueva' });
    expect(products.statusCode).toBe(200);
    expect(products.json().length).toBeGreaterThan(0);
    expect(products.json().every((p: any) => p.isAvailable === true)).toBe(true);

    const additions = await app.inject({ method: 'GET', url: '/api/additions?slug=pizzeria-nueva' });
    expect(additions.statusCode).toBe(200);
    expect(additions.json().length).toBeGreaterThan(0);
  });

  it('POST /api/restaurants seeds the default staff roles of the new restaurant', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: auth(superToken),
      payload: { name: 'Con Roles', slug: 'con-roles' },
    });
    expect(create.statusCode).toBe(201);

    const roles = await app.inject({
      method: 'GET',
      url: `/api/roles?restaurantId=${create.json().id}`,
      headers: auth(superToken),
    });
    expect(roles.statusCode).toBe(200);
    expect(roles.json().map((r: any) => r.name)).toEqual(['Cajero', 'Cocina', 'Gerente', 'Mesero']);
    expect(roles.json().every((r: any) => r.isSystem === false)).toBe(true);
  });
});

describe('Restaurant templates API - supported currencies (review B4)', () => {
  it('exposes supportedCurrencies per template: a list for sample templates, null (any) for blank', async () => {
    const app = buildApp();
    await app.ready();
    const token = new JwtService().generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });
    const res = await app.inject({ method: 'GET', url: '/api/restaurants/templates', headers: { authorization: `Bearer ${token}` } });
    const list = res.json();
    expect(list.find((t: any) => t.id === 'burger').supportedCurrencies).toEqual(expect.arrayContaining(['COP', 'USD', 'MXN']));
    expect(list.find((t: any) => t.id === 'blank').supportedCurrencies).toBeNull();

    const bad = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Yen', slug: 'yen-api', templateType: 'pizza', currency: 'JPY' },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().detail).toMatch(/JPY/);
    await app.close();
  });
});
