import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Restaurant API & Multi-Tenant Security (Integration)', () => {
  let app: FastifyInstance;
  let tokenSuperAdmin: string;
  let tokenRestaurantAdmin: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    tokenSuperAdmin = jwtService.generateToken({
      id: 'usr-superadmin',
      username: 'superadmin',
      role: 'super_admin',
    });

    tokenRestaurantAdmin = jwtService.generateToken({
      id: 'usr-admin-craft',
      username: 'admin_craft',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/restaurant should return default restaurant details (public)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurant'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('categories');
  });

  it('PUT /api/restaurant/categories without auth should return 401 Unauthorized', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
      payload: {
        categories: ['Entradas', 'Platos Fuertes']
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it('PUT /api/restaurant/categories with auth should update and return categories', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
      headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
      payload: {
        categories: ['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres']
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.message).toContain('updated');
    expect(body.categories).toEqual(['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres']);

    // Verify GET reflects the updated categories
    const getResponse = await app.inject({
      method: 'GET',
      url: '/api/restaurant'
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().categories).toEqual(['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres']);
  });

  it('PUT /api/restaurant/categories should accept an empty array and clear the categories', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
      headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
      payload: {
        categories: []
      }
    });

    // A restaurant may exist with zero categories: an empty array is valid.
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.categories).toEqual([]);
  });

  it('GET /api/restaurants without auth returns 401 (the platform directory is private)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurants'
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /api/restaurants with a customer token returns 403 (not tenant staff)', async () => {
    const tokenCustomer = jwtService.generateToken({
      id: 'usr-customer-list',
      username: 'customer_list',
      role: 'customer',
    } as any);
    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenCustomer}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('anonymous single-restaurant lookups stay public via every storefront route', async () => {
    for (const url of [
      '/api/restaurants/burger-craft',
      '/api/restaurant/burger-craft',
      '/api/restaurant',
    ]) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(200);
      const body = res.json();
      expect(body.slug, url).toBeDefined();
      expect(body, url).not.toHaveProperty('isActive');
      expect(body, url).not.toHaveProperty('adminPassword');
    }
  });

  it('GET /api/restaurants with restaurant_admin token returns ONLY their own restaurant (tenant-scoped)', async () => {
    // A tenant the restaurant admin does NOT own (created by super admin)
    const createOther = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      payload: {
        name: 'Scoped Tenant Ajeno',
        slug: 'scoped-tenant-ajeno',
        categories: ['General'],
      },
    });
    expect(createOther.statusCode).toBe(201);

    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    // Never exposes tenants the admin does not own
    expect(body.some((r: any) => r.slug === 'scoped-tenant-ajeno')).toBe(false);
    // Every returned tenant is the admin's own assigned restaurant
    for (const r of body) {
      expect(r.id).toBe('burger-craft');
    }
  });

  it('GET /api/restaurants with super_admin token should return all registered restaurants', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('slug');
  });

  it('POST /api/restaurants without token should return 401 Unauthorized', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      payload: {
        name: 'Fail Tenant',
        slug: 'fail-tenant',
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /api/restaurants with restaurant_admin token should return 403 Forbidden', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
      payload: {
        name: 'Fail Tenant',
        slug: 'fail-tenant',
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /api/restaurants with super_admin token creates tenant and DELETE performs soft-delete', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      payload: {
        name: 'Pizzería Napoli Test',
        slug: 'pizzeria-napoli-test',
        tagline: 'Auténtica pizza italiana',
        whatsappNumber: '573009998877',
        primaryColor: '#E63946',
        templateType: 'pizza',
        categories: ['Pizzas', 'Pastas', 'Bebidas']
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Pizzería Napoli Test');
    expect(body.slug).toBe('pizzeria-napoli-test');
    expect(body.categories).toEqual(['Pizzas', 'Pastas', 'Bebidas']);

    // Verify it appears in list
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.some((r: any) => r.slug === 'pizzeria-napoli-test')).toBe(true);

    // DELETE without token -> 401
    const anonDelete = await app.inject({
      method: 'DELETE',
      url: `/api/restaurants/${body.id}`
    });
    expect(anonDelete.statusCode).toBe(401);

    // DELETE with restaurant_admin -> 403
    const forbiddenDelete = await app.inject({
      method: 'DELETE',
      url: `/api/restaurants/${body.id}`,
      headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
    });
    expect(forbiddenDelete.statusCode).toBe(403);

    // DELETE with super_admin -> 200 (Soft delete)
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/restaurants/${body.id}`,
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    const listAfterDelete = await app.inject({
      method: 'GET',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });
    // A deleted tenant is gone from the directory (unlike a paused one).
    expect(listAfterDelete.json().some((r: any) => r.id === body.id)).toBe(false);

    // ...cannot be re-activated through PATCH, and its admin can no longer log in.
    const revive = await app.inject({
      method: 'PATCH',
      url: `/api/restaurants/${body.id}`,
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      payload: { isActive: true },
    });
    expect(revive.statusCode).toBe(404);
    const login = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { username: body.adminUsername, password: body.adminPassword },
    });
    expect(login.statusCode).toBe(401);

    // Verify public lookup returns 404 for soft-deleted / paused restaurant
    const publicGetById = await app.inject({
      method: 'GET',
      url: `/api/restaurants/${body.id}`
    });
    expect(publicGetById.statusCode).toBe(404);

    const publicGetBySlug = await app.inject({
      method: 'GET',
      url: `/api/restaurant/${body.slug}`
    });
    expect(publicGetBySlug.statusCode).toBe(404);

    // The slug and the default admin username are free again: the same tenant
    // can be recreated without a 409 from the retired admin user.
    const recreate = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      payload: { name: 'Pizzería Napoli Test', slug: 'pizzeria-napoli-test', templateType: 'pizza', categories: ['Pizzas'] },
    });
    expect(recreate.statusCode).toBe(201);
    expect(recreate.json().adminUsername).toBe(body.adminUsername);
    await app.inject({
      method: 'DELETE',
      url: `/api/restaurants/${recreate.json().id}`,
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });
  });

  describe('PUT /api/restaurants/:id (Tenant Configuration & Branding Updates)', () => {
    it('PUT /api/restaurants/:id without auth should return 401 Unauthorized', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/restaurants/burger-craft',
        payload: {
          config: {
            logoUrl: 'https://example.com/logo.webp'
          }
        }
      });
      expect(response.statusCode).toBe(401);
    });

    it('PUT /api/restaurants/:id with restaurant_admin updating their own restaurant should return 200 OK and persist config', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/restaurants/burger-craft',
        headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
        payload: {
          config: {
            logoUrl: 'https://example.com/craft-logo.webp',
            bannerUrl: 'https://example.com/craft-banner.webp',
            primaryColor: '#4F46E5',
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.config.logoUrl).toBe('https://example.com/craft-logo.webp');
      expect(body.config.bannerUrl).toBe('https://example.com/craft-banner.webp');
      expect(body.config.primaryColor).toBe('#4F46E5');

      // Verify persistence via GET — the anonymous detail is now
      // storefront-projected (A9/S2): logoUrl survives, internal config like
      // bannerUrl is redacted. The owning staff still sees the full record.
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/restaurants/burger-craft',
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().config.logoUrl).toBe('https://example.com/craft-logo.webp');
      expect(getRes.json().config.bannerUrl).toBeUndefined();

      const staffGet = await app.inject({
        method: 'GET',
        url: '/api/restaurants/burger-craft',
        headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
      });
      expect(staffGet.statusCode).toBe(200);
      expect(staffGet.json().config.bannerUrl).toBe('https://example.com/craft-banner.webp');
    });

    it('PUT /api/restaurants/:id with restaurant_admin updating a different restaurant should return 403 Forbidden', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/restaurants/pizzeria-napoli',
        headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
        payload: {
          config: {
            logoUrl: 'https://example.com/hacked.webp'
          }
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().detail).toContain('authorized to update your own restaurant');
    });

    it('PUT /api/restaurants/:id with super_admin updating any restaurant should return 200 OK', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/restaurants/burger-craft',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
        payload: {
          config: {
            logoUrl: 'https://example.com/super-craft-logo.webp'
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().config.logoUrl).toBe('https://example.com/super-craft-logo.webp');
    });
  });

  describe('Restaurant Categories Tenancy & Role Hardening (JD-CONFIRMED-003)', () => {
    it('PUT /api/restaurant/categories with restaurant_admin lacking restaurantId returns 403 Forbidden', async () => {
      const tokenNoTenant = jwtService.generateToken({
        id: 'usr-admin-no-tenant',
        username: 'admin_no_tenant',
        role: 'restaurant_admin',
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurant/categories',
        headers: { authorization: `Bearer ${tokenNoTenant}` },
        payload: { categories: ['Fast Food'] },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toBe('Restaurant administrator has no assigned restaurant.');
    });

    it('PUT /api/restaurant/:slug/categories with restaurant_admin lacking restaurantId returns 403 Forbidden', async () => {
      const tokenNoTenant = jwtService.generateToken({
        id: 'usr-admin-no-tenant',
        username: 'admin_no_tenant',
        role: 'restaurant_admin',
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurant/burger-craft/categories',
        headers: { authorization: `Bearer ${tokenNoTenant}` },
        payload: { categories: ['Fast Food'] },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toBe('Restaurant administrator has no assigned restaurant.');
    });

    it('PUT /api/restaurant/:slug/categories with restaurant_admin targeting another restaurant returns 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurant/tacos-el-rey/categories',
        headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
        payload: { categories: ['Tacos', 'Burritos'] },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toBe('You are only authorized to update your own restaurant categories.');
    });

    it('PUT /api/restaurant/:slug/categories with restaurant_admin targeting own restaurant succeeds (200)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurant/burger-craft/categories',
        headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
        payload: { categories: ['Smash Burgers', 'Sides', 'Drinks'] },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().categories).toEqual(['Smash Burgers', 'Sides', 'Drinks']);
    });

    it('PUT /api/restaurant/categories with non-admin token returns 403 Forbidden (requireAnyAdmin)', async () => {
      const tokenCustomer = jwtService.generateToken({
        id: 'usr-customer',
        username: 'customer_bob',
        role: 'customer' as any,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurant/categories',
        headers: { authorization: `Bearer ${tokenCustomer}` },
        payload: { categories: ['Hacked'] },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toBe('Administrator privileges required to access this resource.');
    });
  });

  describe('GET /api/restaurants is closed to anonymous callers', () => {
    it('rejects anonymous callers, including a bogus token, while super admin still sees inactive tenants', async () => {
      // 'pizzeria-napoli-test' was soft-deleted by the delete test above.
      const anonRes = await app.inject({ method: 'GET', url: '/api/restaurants' });
      expect(anonRes.statusCode).toBe(401);

      const bogusRes = await app.inject({
        method: 'GET',
        url: '/api/restaurants',
        headers: { authorization: 'Bearer not-a-real-token' },
      });
      expect(bogusRes.statusCode).toBe(401);

      const superRes = await app.inject({
        method: 'GET',
        url: '/api/restaurants',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });
      expect(superRes.statusCode).toBe(200);
      const full = superRes.json();
      expect(full.some((r: any) => r.slug === 'pizzeria-napoli-test')).toBe(false);
    });
  });

  describe('S2 public detail redaction + S3 role-constrained PUT fields', () => {
    const tenantSlug = 's2-redaction-tenant';

    it('anonymous GET /api/restaurants/:idOrSlug returns the storefront projection only', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/restaurants',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
        payload: {
          name: 'S2 Redaction Tenant',
          slug: tenantSlug,
          tagline: 'Storefront tagline',
          whatsappNumber: '573009990099',
          primaryColor: '#123456',
          config: {
            name: 'S2 Storefront',
            logoUrl: 'https://example.com/logo.webp',
            deliveryFee: 4.5,
            currencySymbol: '$',
            bannerUrl: 'https://example.com/internal-banner.webp',
          },
        },
      });
      expect(createRes.statusCode).toBe(201);

      const anon = await app.inject({ method: 'GET', url: `/api/restaurants/${tenantSlug}` });
      expect(anon.statusCode).toBe(200);
      const body = anon.json();

      // Operator records never leak to the public.
      expect(body).not.toHaveProperty('isActive');
      expect(body).not.toHaveProperty('createdAt');
      expect(body).not.toHaveProperty('adminPassword');

      // Storefront fields survive the projection.
      expect(body.tagline).toBe('Storefront tagline');
      expect(body.whatsappNumber).toBe('573009990099');
      expect(body.primaryColor).toBe('#123456');
      expect(body.config.logoUrl).toBe('https://example.com/logo.webp');
      expect(body.config.deliveryFee).toBe(4.5);
      expect(body.config.currencySymbol).toBe('$');

      // Internal config stays out of the public projection.
      expect(body.config.bannerUrl).toBeUndefined();
    });

    it('authed super_admin GET /api/restaurants/:idOrSlug receives the full record (isActive present)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/restaurants/${tenantSlug}`,
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.isActive).toBe(true);
      expect(body.createdAt).toBeDefined();
      // Internal config is visible to staff, but the one-time password never
      // leaves through any read path.
      expect(body.config.bannerUrl).toBe('https://example.com/internal-banner.webp');
      expect(body).not.toHaveProperty('adminPassword');
    });

    it('tenant-admin PUT with an EFFECTIVE isActive change is rejected (400 ValidationError)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurants/burger-craft',
        headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
        payload: { isActive: false }, // burger-craft is active: true, so this is an effective change
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().detail).toContain('super_admin');
    });

    it('tenant-admin PUT with adminPassword is rejected (400 ValidationError)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurants/burger-craft',
        headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
        payload: { adminPassword: 'fresh-secret-9' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().detail).toContain('super_admin');
    });

    it('tenant-admin PUT sending the UNCHANGED slug is a no-op and succeeds (200, frontend save path)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurants/burger-craft',
        headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
        payload: { slug: 'burger-craft' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().slug).toBe('burger-craft');
    });

    it('super_admin PUT with isActive succeeds and persists', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/restaurants/burger-craft',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
        payload: { isActive: true },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().isActive).toBe(true);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/restaurants/burger-craft',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });
      expect(getRes.json().isActive).toBe(true);
    });
  });
  describe('opening schedule, timezone and paused flag (store-opening-hours T2)', () => {
    const authHeader = () => ({ authorization: `Bearer ${tokenRestaurantAdmin}` });
    const weekly = [
      { dayOfWeek: 1, open: '12:00', close: '14:30' },
      { dayOfWeek: 1, open: '18:00', close: '02:00' },
      { dayOfWeek: 6, open: '10:00', close: '23:00' },
    ];
    const put = (payload: unknown) =>
      app.inject({ method: 'PUT', url: '/api/restaurants/burger-craft', headers: authHeader(), payload: payload as any });

    afterAll(async () => {
      await put({ schedule: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open: '00:00', close: '00:00' })), timezone: 'America/Bogota', ordersPaused: false });
    });

    it('the public storefront projection exposes schedule, timezone, ordersPaused and the legacy openingHours', async () => {
      for (const url of ['/api/restaurants/burger-craft', '/api/restaurant/burger-craft']) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode, url).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.schedule), url).toBe(true);
        expect(body.schedule.length, url).toBeGreaterThan(0);
        expect(Object.keys(body.schedule[0]).sort(), url).toEqual(['close', 'dayOfWeek', 'open']);
        expect(body.timezone, url).toBe('America/Bogota');
        expect(body.ordersPaused, url).toBe(false);
        expect(body.openingHours, url).toEqual({ open: expect.any(String), close: expect.any(String) });
      }
    });

    it('a tenant admin saves schedule, timezone and the paused flag and the public GET reflects them', async () => {
      const res = await put({ schedule: weekly, timezone: 'America/Mexico_City', ordersPaused: true });
      expect(res.statusCode).toBe(200);
      expect(res.json().schedule).toEqual(weekly);
      expect(res.json().timezone).toBe('America/Mexico_City');
      expect(res.json().ordersPaused).toBe(true);

      const pub = (await app.inject({ method: 'GET', url: '/api/restaurants/burger-craft' })).json();
      expect(pub.schedule).toEqual(weekly);
      expect(pub.timezone).toBe('America/Mexico_City');
      expect(pub.ordersPaused).toBe(true);
    });

    it('an empty schedule is accepted (closed every day) and drops the legacy openingHours', async () => {
      const res = await put({ schedule: [] });
      expect(res.statusCode).toBe(200);
      expect(res.json().schedule).toEqual([]);
      expect(res.json().openingHours).toBeUndefined();
    });

    it.each([
      ['an unknown timezone', { timezone: 'Mars/Olympus' }],
      ['a weekday above 6', { schedule: [{ dayOfWeek: 7, open: '09:00', close: '17:00' }] }],
      ['a negative weekday', { schedule: [{ dayOfWeek: -1, open: '09:00', close: '17:00' }] }],
      ['an opening time that is not HH:MM', { schedule: [{ dayOfWeek: 1, open: '9am', close: '17:00' }] }],
      ['an out-of-range closing time', { schedule: [{ dayOfWeek: 1, open: '09:00', close: '24:30' }] }],
      ['two ranges starting at the same time', { schedule: [
        { dayOfWeek: 1, open: '09:00', close: '12:00' },
        { dayOfWeek: 1, open: '09:00', close: '15:00' },
      ] }],
      ['a non-boolean paused flag', { ordersPaused: 'yes' }],
    ])('PUT with %s is rejected with 400', async (_label, payload) => {
      const before = (await app.inject({ method: 'GET', url: '/api/restaurants/burger-craft' })).json();
      const res = await put(payload);
      expect(res.statusCode).toBe(400);
      const after = (await app.inject({ method: 'GET', url: '/api/restaurants/burger-craft' })).json();
      expect(after.schedule).toEqual(before.schedule);
      expect(after.timezone).toBe(before.timezone);
    });

    it('an older client sending only the legacy "HH:MM - HH:MM" text still updates the hours of every weekday', async () => {
      const res = await put({ config: { openingHours: '11:00 - 23:00' } });
      expect(res.statusCode).toBe(200);
      expect(res.json().schedule).toHaveLength(7);
      expect(res.json().schedule.every((r: any) => r.open === '11:00' && r.close === '23:00')).toBe(true);
      expect(res.json().config.openingHours).toBe('11:00 - 23:00');
      expect(res.json().openingHours).toEqual({ open: '11:00', close: '23:00' });
    });
  });


  describe('restaurant admin credentials and lifecycle', () => {
    const create = async (slug: string, extraPayload: Record<string, unknown> = {}) =>
      app.inject({
        method: 'POST',
        url: '/api/restaurants',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
        payload: { name: slug, slug, ...extraPayload },
      });
    const login = (username: string, password: string) =>
      app.inject({ method: 'POST', url: '/api/users/login', payload: { username, password } });

    it('rejects an adminPassword shorter than 8 characters with 400', async () => {
      const res = await create('short-pass-tenant', { adminPassword: 'short' });
      expect(res.statusCode).toBe(400);
    });

    it('answers 409 when the adminUsername is already taken and creates nothing', async () => {
      const first = await create('collide-a', { adminUsername: 'collide_admin' });
      expect(first.statusCode).toBe(201);
      const second = await create('collide-b', { adminUsername: 'collide_admin' });
      expect(second.statusCode).toBe(409);
      const list = await app.inject({
        method: 'GET',
        url: '/api/restaurants',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });
      expect(list.json().some((r: any) => r.slug === 'collide-b')).toBe(false);
    });

    it('PATCH adminPassword changes the real login and forces a password change', async () => {
      const created = (await create('reset-tenant')).json();
      expect((await login(created.adminUsername, created.adminPassword)).statusCode).toBe(200);

      const patch = await app.inject({
        method: 'PATCH',
        url: `/api/restaurants/${created.id}`,
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
        payload: { adminPassword: 'brand-new-pass-1' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json()).not.toHaveProperty('adminPassword');

      expect((await login(created.adminUsername, created.adminPassword)).statusCode).toBe(401);
      const fresh = await login(created.adminUsername, 'brand-new-pass-1');
      expect(fresh.statusCode).toBe(200);
      expect(fresh.json().user.mustChangePassword).toBe(true);
    });

    it('a paused tenant stays listed but its admin cannot log in; deleted is not listed', async () => {
      const created = (await create('paused-tenant')).json();
      await app.inject({
        method: 'PATCH',
        url: `/api/restaurants/${created.id}`,
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
        payload: { isActive: false },
      });
      const list = await app.inject({
        method: 'GET',
        url: '/api/restaurants',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });
      const paused = list.json().find((r: any) => r.id === created.id);
      expect(paused?.isActive).toBe(false);
      expect((await login(created.adminUsername, created.adminPassword)).statusCode).toBe(401);
    });
  });
});

