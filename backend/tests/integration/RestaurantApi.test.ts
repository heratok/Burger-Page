import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';

describe('Restaurant API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/restaurant should return restaurant details', async () => {
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

  it('PUT /api/restaurant/categories should update and return categories', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
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
});
