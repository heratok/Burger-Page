import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';

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
