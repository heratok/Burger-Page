import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('User lifecycle API (super admin manages users)', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  // The seeded super admin is the only active one; tests run without per-request revalidation.
  const superToken = jwt.generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });
  const otherSuperToken = jwt.generateToken({ id: 'usr-other-super', username: 'other', role: 'super_admin' });
  const tenantToken = jwt.generateToken({ id: 'user-admin-craft', username: 'admin_craft', role: 'restaurant_admin', restaurantId: 'burger-craft' });
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  async function createTenantUser(username = 'lifecycle_user', password = 'initial-pass-1') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(superToken),
      payload: { username, password, role: 'restaurant_admin', restaurantId: 'burger-craft' },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }

  async function login(username: string, password: string) {
    return app.inject({ method: 'POST', url: '/api/users/login', payload: { username, password } });
  }

  describe('password length', () => {
    it('POST /api/users rejects a password shorter than 8 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: auth(superToken),
        payload: { username: 'short_pw', password: 'abc1234', role: 'restaurant_admin', restaurantId: 'burger-craft' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('deactivates a user so login fails, and reactivating restores it', async () => {
      const { id } = await createTenantUser();
      expect((await login('lifecycle_user', 'initial-pass-1')).statusCode).toBe(200);

      const off = await app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: auth(superToken), payload: { isActive: false } });
      expect(off.statusCode).toBe(200);
      expect(off.json().isActive).toBe(false);
      expect((await login('lifecycle_user', 'initial-pass-1')).statusCode).toBe(401);

      const on = await app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: auth(superToken), payload: { isActive: true } });
      expect(on.statusCode).toBe(200);
      expect((await login('lifecycle_user', 'initial-pass-1')).statusCode).toBe(200);
    });

    it('requires super admin (401 anonymous, 403 tenant admin)', async () => {
      const { id } = await createTenantUser();
      expect((await app.inject({ method: 'PATCH', url: `/api/users/${id}`, payload: { isActive: false } })).statusCode).toBe(401);
      expect((await app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: auth(tenantToken), payload: { isActive: false } })).statusCode).toBe(403);
    });

    it('returns 404 for an unknown id and 400 for a missing isActive', async () => {
      expect((await app.inject({ method: 'PATCH', url: '/api/users/nope', headers: auth(superToken), payload: { isActive: false } })).statusCode).toBe(404);
      const { id } = await createTenantUser();
      expect((await app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: auth(superToken), payload: {} })).statusCode).toBe(400);
    });

    it('returns 409 when a super admin deactivates itself', async () => {
      const res = await app.inject({ method: 'PATCH', url: '/api/users/user-superadmin', headers: auth(superToken), payload: { isActive: false } });
      expect(res.statusCode).toBe(409);
    });

    it('returns 409 when it would leave no active super admin', async () => {
      const res = await app.inject({ method: 'PATCH', url: '/api/users/user-superadmin', headers: auth(otherSuperToken), payload: { isActive: false } });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('hard deletes a user (login fails, gone from the list)', async () => {
      const { id } = await createTenantUser();
      const del = await app.inject({ method: 'DELETE', url: `/api/users/${id}`, headers: auth(superToken) });
      expect(del.statusCode).toBe(204);
      expect((await login('lifecycle_user', 'initial-pass-1')).statusCode).toBe(401);
      const list = await app.inject({ method: 'GET', url: '/api/users', headers: auth(superToken) });
      expect((list.json() as Array<{ id: string }>).some((u) => u.id === id)).toBe(false);
    });

    it('requires super admin', async () => {
      const { id } = await createTenantUser();
      expect((await app.inject({ method: 'DELETE', url: `/api/users/${id}` })).statusCode).toBe(401);
      expect((await app.inject({ method: 'DELETE', url: `/api/users/${id}`, headers: auth(tenantToken) })).statusCode).toBe(403);
    });

    it('returns 404 for an unknown id', async () => {
      expect((await app.inject({ method: 'DELETE', url: '/api/users/nope', headers: auth(superToken) })).statusCode).toBe(404);
    });

    it('returns 409 for self deletion and for the last active super admin', async () => {
      expect((await app.inject({ method: 'DELETE', url: '/api/users/user-superadmin', headers: auth(superToken) })).statusCode).toBe(409);
      expect((await app.inject({ method: 'DELETE', url: '/api/users/user-superadmin', headers: auth(otherSuperToken) })).statusCode).toBe(409);
    });
  });

  describe('POST /api/users/:id/reset-password and forced change', () => {
    it('returns a temporary password once, the old password stops working and login flags mustChangePassword', async () => {
      const { id } = await createTenantUser();
      const res = await app.inject({ method: 'POST', url: `/api/users/${id}/reset-password`, headers: auth(superToken) });
      expect(res.statusCode).toBe(200);
      const { temporaryPassword } = res.json() as { temporaryPassword: string };
      expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);

      expect((await login('lifecycle_user', 'initial-pass-1')).statusCode).toBe(401);
      const ok = await login('lifecycle_user', temporaryPassword);
      expect(ok.statusCode).toBe(200);
      expect(ok.json().user.mustChangePassword).toBe(true);
    });

    it('requires super admin and returns 404 for an unknown id', async () => {
      const { id } = await createTenantUser();
      expect((await app.inject({ method: 'POST', url: `/api/users/${id}/reset-password` })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: `/api/users/${id}/reset-password`, headers: auth(tenantToken) })).statusCode).toBe(403);
      expect((await app.inject({ method: 'POST', url: '/api/users/nope/reset-password', headers: auth(superToken) })).statusCode).toBe(404);
    });

    it('blocks every authenticated route with PASSWORD_CHANGE_REQUIRED until the password is changed', async () => {
      const { id } = await createTenantUser();
      const reset = await app.inject({ method: 'POST', url: `/api/users/${id}/reset-password`, headers: auth(superToken) });
      const { temporaryPassword } = reset.json() as { temporaryPassword: string };
      const { token } = (await login('lifecycle_user', temporaryPassword)).json() as { token: string };

      const blocked = await app.inject({ method: 'GET', url: '/api/users', headers: auth(token) });
      expect(blocked.statusCode).toBe(403);
      expect(blocked.json().code).toBe('PASSWORD_CHANGE_REQUIRED');

      const change = await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: auth(token),
        payload: { currentPassword: temporaryPassword, newPassword: 'my-new-password' },
      });
      expect(change.statusCode).toBe(200);
      const fresh = change.json().token as string;

      expect((await app.inject({ method: 'GET', url: '/api/users', headers: auth(fresh) })).statusCode).toBe(200);
      const relog = await login('lifecycle_user', 'my-new-password');
      expect(relog.statusCode).toBe(200);
      expect(relog.json().user.mustChangePassword).toBe(false);
      expect((await login('lifecycle_user', temporaryPassword)).statusCode).toBe(401);
    });
  });

  describe('POST /api/users/me/password', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/users/me/password', payload: { currentPassword: 'x', newPassword: 'long-enough-1' } });
      expect(res.statusCode).toBe(401);
    });

    it('changes the password when the current one is correct', async () => {
      await createTenantUser();
      const { token, user } = (await login('lifecycle_user', 'initial-pass-1')).json() as { token: string; user: { id: string } };
      expect(user.id).toBeDefined();
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: auth(token),
        payload: { currentPassword: 'initial-pass-1', newPassword: 'another-pass-2' },
      });
      expect(res.statusCode).toBe(200);
      expect((await login('lifecycle_user', 'another-pass-2')).statusCode).toBe(200);
      expect((await login('lifecycle_user', 'initial-pass-1')).statusCode).toBe(401);
    });

    it('returns 400 for a wrong current password, a short new one, or an unchanged one', async () => {
      await createTenantUser();
      const { token } = (await login('lifecycle_user', 'initial-pass-1')).json() as { token: string };
      const post = (payload: object) => app.inject({ method: 'POST', url: '/api/users/me/password', headers: auth(token), payload });
      expect((await post({ currentPassword: 'wrong-password', newPassword: 'another-pass-2' })).statusCode).toBe(400);
      expect((await post({ currentPassword: 'initial-pass-1', newPassword: 'short' })).statusCode).toBe(400);
      expect((await post({ currentPassword: 'initial-pass-1', newPassword: 'initial-pass-1' })).statusCode).toBe(400);
    });
  });
});
