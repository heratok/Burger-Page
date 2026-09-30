import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Supplier API Integration Suite (TDD)', () => {
  let app: FastifyInstance;
  let tokenTenant: string;
  let tokenOtherTenant: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    tokenTenant = jwtService.generateToken({
      id: 'usr-admin-craft',
      username: 'admin_craft',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });

    tokenOtherTenant = jwtService.generateToken({
      id: 'usr-admin-pizza',
      username: 'admin_pizza',
      role: 'restaurant_admin',
      restaurantId: 'pizza-planet',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /api/suppliers returns 401 without auth token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suppliers',
    });
    expect(res.statusCode).toBe(401);
  });

  it('2. POST /api/suppliers returns 401 without auth token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suppliers',
      payload: { name: 'Carnes SAS' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('3. POST /api/suppliers creates a supplier and GET lists it for the tenant', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/suppliers',
      headers: { authorization: `Bearer ${tokenTenant}` },
      payload: {
        name: 'Carnes El Corral',
        category: 'ingredients',
        contactName: 'Pedro Gómez',
        phone: '3001112233',
        email: 'pedro@elcorral.com',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Carnes El Corral');
    expect(created.restaurantId).toBe('burger-craft');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/suppliers',
      headers: { authorization: `Bearer ${tokenTenant}` },
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((s: any) => s.id === created.id)).toBe(true);

    // Other tenant cannot see it
    const otherListRes = await app.inject({
      method: 'GET',
      url: '/api/suppliers',
      headers: { authorization: `Bearer ${tokenOtherTenant}` },
    });
    expect(otherListRes.statusCode).toBe(200);
    const otherList = JSON.parse(otherListRes.body);
    expect(otherList.some((s: any) => s.id === created.id)).toBe(false);
  });

  it('4. PUT /api/suppliers/:id updates supplier and DELETE removes it', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/suppliers',
      headers: { authorization: `Bearer ${tokenTenant}` },
      payload: {
        name: 'Bebidas Andinas',
        phone: '3150009988',
      },
    });
    const created = JSON.parse(createRes.body);

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/suppliers/${created.id}`,
      headers: { authorization: `Bearer ${tokenTenant}` },
      payload: {
        name: 'Bebidas Andinas Premium',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body);
    expect(updated.name).toBe('Bebidas Andinas Premium');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/suppliers/${created.id}`,
      headers: { authorization: `Bearer ${tokenTenant}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/suppliers',
      headers: { authorization: `Bearer ${tokenTenant}` },
    });
    const list = JSON.parse(listRes.body);
    expect(list.some((s: any) => s.id === created.id)).toBe(false);
  });
});
