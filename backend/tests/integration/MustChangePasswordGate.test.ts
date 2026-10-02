import { describe, it, expect, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { createAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { User } from '../../src/domain/models/User.js';
import { UserRepository } from '../../src/domain/ports/out/UserRepository.js';

class FakeUserRepository implements UserRepository {
  async setActive(): Promise<never> { throw new Error('unused'); }
  async deleteGuarded(): Promise<never> { throw new Error('unused'); }
  async retireByRestaurantId(): Promise<void> { throw new Error('unused'); }
  users = new Map<string, User>();
  async findById(id: string) { return this.users.get(id) ?? null; }
  async findByUsername(): Promise<User | null> { throw new Error('unused'); }
  async findByRestaurantId(): Promise<User[]> { throw new Error('unused'); }
  async findAll(): Promise<User[]> { throw new Error('unused'); }
  async save(): Promise<void> { throw new Error('unused'); }
  async delete(): Promise<void> { throw new Error('unused'); }
}

describe('must-change-password gate in the auth middleware', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  afterEach(async () => { await app?.close(); });

  async function build(repo?: UserRepository) {
    const mw = createAuthMiddlewares(jwt, repo ? { userRepo: repo } : undefined);
    app = fastify();
    app.get('/data', { preHandler: [mw.requireAuth] }, async () => ({ ok: true }));
    app.post('/change', { preHandler: [mw.requireAuthAllowingPasswordChange] }, async () => ({ ok: true }));
    await app.ready();
  }

  const claims = { id: 'u1', username: 'u1', role: 'restaurant_admin' as const, restaurantId: 'r1' };

  it('rejects a token carrying the mustChangePassword claim on normal routes, but admits it on the change route', async () => {
    await build();
    const token = jwt.generateToken({ ...claims, mustChangePassword: true });
    const blocked = await app.inject({ method: 'GET', url: '/data', headers: { authorization: `Bearer ${token}` } });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe('PASSWORD_CHANGE_REQUIRED');
    const allowed = await app.inject({ method: 'POST', url: '/change', headers: { authorization: `Bearer ${token}` } });
    expect(allowed.statusCode).toBe(200);
  });

  it('lets a token without the claim through', async () => {
    await build();
    const token = jwt.generateToken(claims);
    expect((await app.inject({ method: 'GET', url: '/data', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
  });

  it('with revalidation, the stored flag wins over the token claims in both directions', async () => {
    const repo = new FakeUserRepository();
    repo.users.set('u1', { id: 'u1', username: 'u1', passwordHash: 'h', role: 'restaurant_admin', restaurantId: 'r1', createdAt: '', isActive: true, mustChangePassword: true });
    await build(repo);
    // Old token minted before the reset (no claim): the stored flag still blocks it.
    const oldToken = jwt.generateToken(claims);
    const blocked = await app.inject({ method: 'GET', url: '/data', headers: { authorization: `Bearer ${oldToken}` } });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe('PASSWORD_CHANGE_REQUIRED');

    // Password already changed: a stale token with the claim is admitted.
    repo.users.set('u1', { ...repo.users.get('u1')!, mustChangePassword: false });
    const staleToken = jwt.generateToken({ ...claims, mustChangePassword: true });
    expect((await app.inject({ method: 'GET', url: '/data', headers: { authorization: `Bearer ${staleToken}` } })).statusCode).toBe(200);
  });
});
