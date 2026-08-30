import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Customer Module Multi-Tenant & Buyer Profile Suite (Integration)', () => {
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

  it('1. GET /api/customers without auth token must return 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/customers'
    });
    expect(res.statusCode).toBe(401);
  });

  it('2. Tenant A can create a customer buyer profile without email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Carlos Mendoza',
        phone: '+57 301 555 1234',
        address: 'Calle 80 # 11-25 Apto 301',
        barrio: 'Antiguo Country',
        notes: 'Dejar en recepción si no contesto el citófono'
      }
    });

    expect(res.statusCode).toBe(201);
    const customer = res.json();
    expect(customer.restaurantId).toBe('tenant-a');
    expect(customer.name).toBe('Carlos Mendoza');
    expect(customer.phone).toBe('+57 301 555 1234');
    expect(customer.address).toBe('Calle 80 # 11-25 Apto 301');
    expect(customer.barrio).toBe('Antiguo Country');
    expect(customer.notes).toBe('Dejar en recepción si no contesto el citófono');
    expect(customer.email).toBe('');
    // Confirm NO loyaltyTier or tier properties in response
    expect(customer).not.toHaveProperty('loyaltyTier');
    expect(customer).not.toHaveProperty('loyalty_tier');
  });

  it('3. Tenant B cannot list customers created by Tenant A (Tenant Isolation)', async () => {
    // Tenant A lists customers
    const resA = await app.inject({
      method: 'GET',
      url: '/api/customers',
      headers: { authorization: `Bearer ${tokenTenantA}` }
    });
    expect(resA.statusCode).toBe(200);
    const customersA = resA.json();
    expect(customersA.length).toBeGreaterThanOrEqual(1);
    expect(customersA.every((c: any) => c.restaurantId === 'tenant-a')).toBe(true);

    // Tenant B lists customers
    const resB = await app.inject({
      method: 'GET',
      url: '/api/customers',
      headers: { authorization: `Bearer ${tokenTenantB}` }
    });
    expect(resB.statusCode).toBe(200);
    const customersB = resB.json();
    expect(customersB.every((c: any) => c.restaurantId === 'tenant-b')).toBe(true);
    expect(customersB.some((c: any) => c.name === 'Carlos Mendoza')).toBe(false);
  });

  it('4. Tenant B cannot get customer details of Tenant A by ID (404 Not Found)', async () => {
    // 1. Create customer in Tenant A
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Lucía Santos',
        phone: '+57 312 444 8899',
        address: 'Carrera 7 # 120-10'
      }
    });
    const customerA = createRes.json();

    // 2. Tenant B attempts to fetch it
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/customers/${customerA.id}`,
      headers: { authorization: `Bearer ${tokenTenantB}` }
    });
    expect(fetchRes.statusCode).toBe(404);
  });

  it('5. Tenant B cannot update customer details of Tenant A (404 Not Found)', async () => {
    // 1. Create customer in Tenant A
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Mauricio Velez',
        phone: '+57 320 111 2233',
        address: 'Calle 10 # 5-20'
      }
    });
    const customerA = createRes.json();

    // 2. Tenant B attempts to modify address
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/customers/${customerA.id}`,
      headers: { authorization: `Bearer ${tokenTenantB}` },
      payload: {
        address: 'Hacked Address'
      }
    });
    expect(updateRes.statusCode).toBe(404);

    // 3. Verify original address untouched
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/customers/${customerA.id}`,
      headers: { authorization: `Bearer ${tokenTenantA}` }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().address).toBe('Calle 10 # 5-20');
  });

  it('6. Tenant B cannot delete customer of Tenant A (404 Not Found)', async () => {
    // 1. Create customer in Tenant A
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        name: 'Diana Pardo',
        phone: '+57 318 777 9900'
      }
    });
    const customerA = createRes.json();

    // 2. Tenant B attempts to delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/customers/${customerA.id}`,
      headers: { authorization: `Bearer ${tokenTenantB}` }
    });
    expect(deleteRes.statusCode).toBe(404);

    // 3. Verify customer still exists in Tenant A
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/customers/${customerA.id}`,
      headers: { authorization: `Bearer ${tokenTenantA}` }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().name).toBe('Diana Pardo');
  });
});
