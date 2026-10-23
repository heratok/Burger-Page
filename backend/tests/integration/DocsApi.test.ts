import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp, resolveDocsEnabled } from '../../src/infrastructure/http/app.js';

describe('Scalar Documentation API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs/ should return 200 with Scalar documentation UI HTML', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs/'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('Burger Craft API');
  });

  it('GET /docs should redirect to /docs/ with 301 or 302', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs'
    });

    expect([200, 301, 302]).toContain(response.statusCode);
  });
});

describe('API reference exposure', () => {
  it('is off in production unless API_DOCS_ENABLED=true', () => {
    expect(resolveDocsEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(resolveDocsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: 'true' })).toBe(true);
    expect(resolveDocsEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(resolveDocsEnabled({})).toBe(true);
  });

  it('serves no /docs when disabled, and the API keeps working', async () => {
    const app = buildApp(undefined, { docs: false });
    await app.ready();
    try {
      expect((await app.inject({ method: 'GET', url: '/docs/' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
      const menu = await app.inject({ method: 'GET', url: '/api/products?slug=burger-craft' });
      expect(menu.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
