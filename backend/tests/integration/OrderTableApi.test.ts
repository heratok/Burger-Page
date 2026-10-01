import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Order <-> table API', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  let staff: string;
  let otherStaff: string;
  let tableId: string;
  let inactiveTableId: string;
  let foreignTableId: string;
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const sale = (extra: Record<string, unknown> = {}) => ({
    restaurantId: 'burger-craft',
    items: [{ productId: 'p1', quantity: 1, additions: [] }],
    paymentMethod: 'Efectivo',
    ...extra,
  });

  const makeTable = async (token: string, name: string, isActive = true) =>
    (await app.inject({ method: 'POST', url: '/api/tables', headers: auth(token), payload: { name, isActive } })).json();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    staff = jwt.generateToken({ id: 'u1', username: 'craft', role: 'restaurant_admin', restaurantId: 'burger-craft' });
    otherStaff = jwt.generateToken({ id: 'u2', username: 'ta', role: 'restaurant_admin', restaurantId: 'tenant-a' });
    tableId = (await makeTable(staff, 'Mesa 5')).id;
    inactiveTableId = (await makeTable(staff, 'Mesa apagada', false)).id;
    foreignTableId = (await makeTable(otherStaff, 'Mesa ajena')).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('a staff sale stores the table and returns tableId/tableLabel', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/orders', headers: auth(staff), payload: sale({ tableId }) });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ tableId, tableLabel: 'Mesa 5' });

    const fetched = await app.inject({ method: 'GET', url: `/api/orders/${res.json().id}`, headers: auth(staff) });
    expect(fetched.json()).toMatchObject({ tableId, tableLabel: 'Mesa 5' });
  });

  it('the public storefront cannot send a tableId (400) and nothing is created', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/orders', payload: sale({ tableId }) });

    expect(res.statusCode).toBe(400);
  });

  it('a staff member of another restaurant cannot attach this restaurant table (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(otherStaff),
      payload: sale({ restaurantId: 'tenant-a', tableId }),
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a table of another restaurant, an inactive table and an unknown table (400)', async () => {
    for (const id of [foreignTableId, inactiveTableId, 'tbl_does_not_exist']) {
      const res = await app.inject({ method: 'POST', url: '/api/orders', headers: auth(staff), payload: sale({ tableId: id }) });
      expect(res.statusCode, id).toBe(400);
    }
  });

  it('PUT /api/orders/:id attaches, moves and detaches the table', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/orders', headers: auth(staff), payload: sale() });
    const orderId = created.json().id;
    expect(created.json().tableId).toBeUndefined();
    const second = (await makeTable(staff, 'Mesa 6')).id;

    const attach = await app.inject({ method: 'PUT', url: `/api/orders/${orderId}`, headers: auth(staff), payload: { tableId } });
    expect(attach.statusCode).toBe(200);
    expect(attach.json()).toMatchObject({ tableId, tableLabel: 'Mesa 5' });

    const move = await app.inject({ method: 'PUT', url: `/api/orders/${orderId}`, headers: auth(staff), payload: { tableId: second } });
    expect(move.json()).toMatchObject({ tableId: second, tableLabel: 'Mesa 6' });

    const bad = await app.inject({ method: 'PUT', url: `/api/orders/${orderId}`, headers: auth(staff), payload: { tableId: foreignTableId } });
    expect(bad.statusCode).toBe(400);

    const detach = await app.inject({ method: 'PUT', url: `/api/orders/${orderId}`, headers: auth(staff), payload: { tableId: null } });
    expect(detach.statusCode).toBe(200);
    expect(detach.json().tableId).toBeUndefined();
    expect(detach.json().tableLabel).toBeUndefined();
  });

  it('an order sold without a table has no table fields', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/orders', headers: auth(staff), payload: sale() });

    expect(res.statusCode).toBe(201);
    expect(res.json().tableId).toBeUndefined();
  });
});
