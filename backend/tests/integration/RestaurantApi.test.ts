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

  it('PUT /api/restaurant/categories should return 400 for empty categories array', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
      headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
      payload: {
        categories: []
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.detail || body.message).toBeDefined();
  });

  it('GET /api/restaurants without auth should return 401 Unauthorized', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurants'
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /api/restaurants with restaurant_admin token should return 403 Forbidden', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${tokenRestaurantAdmin}` },
    });

    expect(response.statusCode).toBe(403);
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
    const deletedRest = listAfterDelete.json().find((r: any) => r.slug === 'pizzeria-napoli-test');
    expect(deletedRest).toBeDefined();
    expect(deletedRest.isActive).toBe(false);

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
  });
});
