import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Inventory Module Multi-Tenant Isolation Suite (Integration)', () => {
  let app: FastifyInstance;
  let tokenTenantA: string;
  let tokenTenantB: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    tokenTenantA = jwtService.generateToken({
      id: 'usr-admin-a',
      username: 'admin_a',
      role: 'restaurant_admin',
      restaurantId: 'tenant-a',
    });

    tokenTenantB = jwtService.generateToken({
      id: 'usr-admin-b',
      username: 'admin_b',
      role: 'restaurant_admin',
      restaurantId: 'tenant-b',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Create from Tenant A always associates the record with Tenant A and ignores manipulated body restaurantId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        restaurantId: 'tenant-b', // Malicious attempt to inject into Tenant B
        name: 'Carne Angus 200g',
        category: 'ingredients',
        quantity: 50,
        unit: 'unidades',
        costPerUnit: 8500,
        minStockAlert: 10,
      }
    });

    expect(res.statusCode).toBe(201);
    const item = res.json();
    expect(item.restaurantId).toBe('tenant-a'); // Enforced by JWT!
    expect(item.name).toBe('Carne Angus 200g');
  });

  it('2. Tenant B cannot list inventory of Tenant A (Tenant Isolation & Cost Privacy)', async () => {
    // Tenant A lists items
    const resA = await app.inject({
      method: 'GET',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenantA}` }
    });
    expect(resA.statusCode).toBe(200);
    const itemsA = resA.json();
    expect(itemsA.length).toBeGreaterThanOrEqual(1);
    expect(itemsA.every((i: any) => i.restaurantId === 'tenant-a')).toBe(true);

    // Tenant B lists items
    const resB = await app.inject({
      method: 'GET',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenantB}` }
    });
    expect(resB.statusCode).toBe(200);
    const itemsB = resB.json();
    expect(itemsB.every((i: any) => i.restaurantId === 'tenant-b')).toBe(true);
    expect(itemsB.some((i: any) => i.name === 'Carne Angus 200g')).toBe(false);
  });

  it('3. Tenant B cannot get inventory item of Tenant A by ID (404 Not Found)', async () => {
    // 1. Create item in Tenant A
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Cerveza Club Colombia',
        category: 'beverages',
        quantity: 48,
        unit: 'unidades',
        costPerUnit: 3200,
      }
    });
    const itemA = createRes.json();

    // 2. Tenant B attempts to fetch it
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/${itemA.id}`,
      headers: { authorization: `Bearer ${tokenTenantB}` }
    });
    expect(fetchRes.statusCode).toBe(404);
  });

  it('4. Tenant B cannot modify attributes of an inventory item in Tenant A (404 Not Found)', async () => {
    // 1. Create item in Tenant A
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Cajas de Hamburguesa Kraft',
        category: 'packaging',
        quantity: 500,
        unit: 'unidades',
        costPerUnit: 350,
      }
    });
    const itemA = createRes.json();

    // 2. Tenant B attempts to update it
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/inventory/${itemA.id}`,
      headers: { authorization: `Bearer ${tokenTenantB}` },
      payload: {
        name: 'Hacked Box Name',
        costPerUnit: 1,
      }
    });
    expect(updateRes.statusCode).toBe(404);

    // 3. Verify original item untouched in Tenant A
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/${itemA.id}`,
      headers: { authorization: `Bearer ${tokenTenantA}` }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().name).toBe('Cajas de Hamburguesa Kraft');
    expect(verifyRes.json().costPerUnit).toBe(350);
  });

  it('5. Tenant B cannot adjust stock of an inventory item in Tenant A (404 Not Found)', async () => {
    // 1. Create item in Tenant A
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Salsa Tártara Galón',
        category: 'ingredients',
        quantity: 20,
        unit: 'litros',
        costPerUnit: 22000,
      }
    });
    const itemA = createRes.json();

    // 2. Tenant B attempts to reduce stock
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/inventory/${itemA.id}/stock`,
      headers: { authorization: `Bearer ${tokenTenantB}` },
      payload: { quantityChange: -10 }
    });
    expect(patchRes.statusCode).toBe(404);

    // 3. Verify stock in Tenant A remains 20
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/${itemA.id}`,
      headers: { authorization: `Bearer ${tokenTenantA}` }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().currentStock).toBe(20);
  });

  it('6. Tenant B cannot delete an inventory item in Tenant A (404 Not Found)', async () => {
    // 1. Create item in Tenant A
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Jabón Desinfectante Grado Alimenticio',
        category: 'cleaning',
        quantity: 15,
        unit: 'litros',
        costPerUnit: 15000,
      }
    });
    const itemA = createRes.json();

    // 2. Tenant B attempts to delete it
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/inventory/${itemA.id}`,
      headers: { authorization: `Bearer ${tokenTenantB}` }
    });
    expect(deleteRes.statusCode).toBe(404);

    // 3. Verify item still exists in Tenant A
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/${itemA.id}`,
      headers: { authorization: `Bearer ${tokenTenantA}` }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().name).toBe('Jabón Desinfectante Grado Alimenticio');
  });
});
