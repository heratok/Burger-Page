import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

/**
 * A staff session of tenant A browsing tenant B's storefront in the same tab
 * sends its Bearer token on the public menu reads. The menu must be B's public
 * one, never A's catalog served under B's store.
 */
describe('Storefront catalog reads never cross tenants for a bound session', () => {
  let app: FastifyInstance;
  let tokenA: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    tokenA = jwtService.generateToken({
      id: 'usr-admin-a',
      username: 'admin_a',
      role: 'restaurant_admin',
      restaurantId: 'tenant-a',
    });

    const product = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Solo Tenant A', price: 1000, categoryId: 'cat-a1', category: 'Burgers', isAvailable: true, additions: [] },
    });
    expect(product.statusCode).toBe(201);

    const addition = await app.inject({
      method: 'POST',
      url: '/api/additions',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Extra Tenant A', price: 500, isAvailable: true, displayOrder: 1 },
    });
    expect(addition.statusCode).toBe(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the own catalog when the query names no restaurant or the own one', async () => {
    for (const url of ['/api/products', '/api/products?restaurantId=tenant-a']) {
      const res = await app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${tokenA}` } });
      expect(res.statusCode).toBe(200);
      const names = res.json().map((p: any) => p.name);
      expect(names).toContain('Solo Tenant A');
    }
  });

  it.each(['/api/products?slug=burger-craft', '/api/products?restaurantId=burger-craft'])(
    'serves the other store public products for %s',
    async (url) => {
      const res = await app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${tokenA}` } });
      expect(res.statusCode).toBe(200);
      const products = res.json();
      expect(products.length).toBeGreaterThan(0);
      expect(products.every((p: any) => p.restaurantId === 'burger-craft')).toBe(true);
      expect(products.map((p: any) => p.name)).not.toContain('Solo Tenant A');
    }
  );

  it.each(['/api/additions?slug=burger-craft', '/api/additions?restaurantId=burger-craft'])(
    'serves the other store public additions for %s',
    async (url) => {
      const res = await app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${tokenA}` } });
      expect(res.statusCode).toBe(200);
      const additions = res.json();
      expect(additions.every((a: any) => a.restaurantId === 'burger-craft')).toBe(true);
      expect(additions.map((a: any) => a.name)).not.toContain('Extra Tenant A');
    }
  );
});
