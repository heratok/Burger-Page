import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import type { Permission } from '@burger-page/contracts';
import { buildApp, buildDependencies, AppDependencies } from '../../src/infrastructure/http/app.js';
import { configureAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { ID_PREFIX, newId } from '../../src/domain/shared/newId.js';
import type { User } from '../../src/domain/models/User.js';

// TASK-05: a restaurant admin (permission users.manage) manages ONLY staff
// users of their own restaurant; staff delegated users.manage/roles.manage can
// never escalate beyond the permissions they hold themselves.
describe('Staff users and role delegation API', () => {
  let app: FastifyInstance;
  let deps: AppDependencies;
  const jwt = new JwtService();
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const TENANT = 'burger-craft';
  const OTHER = 'tenant-a';

  const adminToken = jwt.generateToken({ id: 'user-admin-craft', username: 'admin_craft', role: 'restaurant_admin', restaurantId: TENANT });
  const otherAdminToken = jwt.generateToken({ id: 'user-admin-other', username: 'admin_other', role: 'restaurant_admin', restaurantId: OTHER });
  const superToken = jwt.generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });

  let seq = 0;
  async function makeRole(permissions: Permission[], restaurantId = TENANT, name = `role-${++seq}`) {
    const id = newId(ID_PREFIX.role);
    const now = new Date().toISOString();
    await deps.roleRepo.save({ id, restaurantId, name, permissions, isSystem: false, createdAt: now, updatedAt: now });
    return id;
  }

  async function makeStaff(roleId: string, restaurantId = TENANT) {
    const id = newId(ID_PREFIX.user);
    const username = `staff_${++seq}`;
    const user: User = { id, username, passwordHash: 'x', role: 'restaurant_staff', restaurantId, roleId, createdAt: new Date().toISOString(), isActive: true };
    await deps.userRepo.save(user);
    return { id, username, token: jwt.generateToken({ id, username, role: 'restaurant_staff', restaurantId }) };
  }

  const createUser = (token: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/users', headers: auth(token), payload: { password: 'password-1', username: `new_${++seq}`, ...payload } });

  beforeAll(async () => {
    deps = buildDependencies(undefined, 'memory');
    await deps.userRepo.save({
      id: 'user-admin-other', username: 'admin_other', passwordHash: 'x', role: 'restaurant_admin',
      restaurantId: OTHER, createdAt: new Date().toISOString(), isActive: true,
    });
    await deps.userRepo.save({
      id: 'user-admin-peer', username: 'admin_peer', passwordHash: 'x', role: 'restaurant_admin',
      restaurantId: TENANT, createdAt: new Date().toISOString(), isActive: true,
    });
    configureAuthMiddlewares({ userRepo: deps.userRepo, restaurantRepo: deps.restaurantRepo, roleRepo: deps.roleRepo });
    app = buildApp(deps);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    configureAuthMiddlewares({});
  });

  describe('restaurant_admin creates staff', () => {
    it('creates a restaurant_staff user bound to its own restaurant and role', async () => {
      const roleId = await makeRole(['orders.view']);
      const res = await createUser(adminToken, { role: 'restaurant_staff', roleId });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toMatchObject({ role: 'restaurant_staff', restaurantId: TENANT, roleId });
      expect(body.passwordHash).toBeUndefined();
      const stored = await deps.userRepo.findById(body.id);
      expect(stored?.mustChangePassword).toBe(true);
    });

    it('the new staff user can sign in and receives the role permissions', async () => {
      const roleId = await makeRole(['orders.view', 'orders.manage']);
      const created = await createUser(adminToken, { username: 'cashier_login', role: 'restaurant_staff', roleId });
      expect(created.statusCode).toBe(201);
      const login = await app.inject({ method: 'POST', url: '/api/users/login', payload: { username: 'cashier_login', password: 'password-1' } });
      expect(login.statusCode).toBe(200);
      expect(login.json().user).toMatchObject({ role: 'restaurant_staff', roleId, permissions: ['orders.view', 'orders.manage'] });
    });

    it('ignores nothing silently: a restaurantId of another tenant is refused', async () => {
      const roleId = await makeRole(['orders.view']);
      const res = await createUser(adminToken, { role: 'restaurant_staff', roleId, restaurantId: OTHER });
      expect(res.statusCode).toBe(403);
    });

    it('refuses to create restaurant_admin or super_admin accounts (403)', async () => {
      for (const role of ['restaurant_admin', 'super_admin']) {
        const res = await createUser(adminToken, { role, restaurantId: TENANT });
        expect(res.statusCode, role).toBe(403);
      }
    });

    it('requires a roleId for staff (400)', async () => {
      expect((await createUser(adminToken, { role: 'restaurant_staff' })).statusCode).toBe(400);
    });

    it('rejects a role of another restaurant (404, no cross-tenant role use)', async () => {
      const foreign = await makeRole(['orders.view'], OTHER);
      const res = await createUser(adminToken, { role: 'restaurant_staff', roleId: foreign });
      expect(res.statusCode).toBe(404);
    });

    it('rejects an unknown role (404)', async () => {
      expect((await createUser(adminToken, { role: 'restaurant_staff', roleId: 'role_nope' })).statusCode).toBe(404);
    });

    it('rejects a duplicated username', async () => {
      const roleId = await makeRole([]);
      expect((await createUser(adminToken, { username: 'dup_user', role: 'restaurant_staff', roleId })).statusCode).toBe(201);
      expect((await createUser(adminToken, { username: 'dup_user', role: 'restaurant_staff', roleId })).statusCode).toBe(400);
    });
  });

  describe('super_admin keeps full control', () => {
    it('creates staff for any restaurant with one of its roles', async () => {
      const roleId = await makeRole(['orders.view'], OTHER);
      const res = await createUser(superToken, { role: 'restaurant_staff', roleId, restaurantId: OTHER });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ restaurantId: OTHER, roleId });
    });

    it('requires restaurantId for staff and rejects a role from another restaurant', async () => {
      const roleId = await makeRole(['orders.view'], OTHER);
      expect((await createUser(superToken, { role: 'restaurant_staff', roleId })).statusCode).toBe(400);
      expect((await createUser(superToken, { role: 'restaurant_staff', roleId, restaurantId: TENANT })).statusCode).toBe(404);
    });

    it('still creates restaurant_admin accounts', async () => {
      const res = await createUser(superToken, { role: 'restaurant_admin', restaurantId: TENANT });
      expect(res.statusCode).toBe(201);
    });
  });

  describe('listing', () => {
    it('restaurant_admin lists only its own restaurant users, ignoring a restaurantId override', async () => {
      const mine = await makeStaff(await makeRole([]));
      const theirs = await makeStaff(await makeRole([], OTHER), OTHER);
      const res = await app.inject({ method: 'GET', url: `/api/users?restaurantId=${OTHER}`, headers: auth(adminToken) });
      expect(res.statusCode).toBe(200);
      const ids = (res.json() as Array<{ id: string; restaurantId: string }>).map((u) => u.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
      for (const u of res.json() as Array<{ restaurantId: string }>) expect(u.restaurantId).toBe(TENANT);
    });

    it('includes roleId so the panel can show the assigned role', async () => {
      const roleId = await makeRole([]);
      const s = await makeStaff(roleId);
      const res = await app.inject({ method: 'GET', url: '/api/users', headers: auth(adminToken) });
      expect((res.json() as Array<{ id: string; roleId?: string }>).find((u) => u.id === s.id)?.roleId).toBe(roleId);
    });
  });

  describe('PATCH /api/users/:id by restaurant_admin', () => {
    it('updates isActive, roleId and username of its own staff', async () => {
      const target = await makeStaff(await makeRole(['orders.view']));
      const next = await makeRole(['orders.manage']);
      const res = await app.inject({
        method: 'PATCH', url: `/api/users/${target.id}`, headers: auth(adminToken),
        payload: { isActive: false, roleId: next, username: `${target.username}_x` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ isActive: false, roleId: next, username: `${target.username}_x`, role: 'restaurant_staff' });
    });

    it('a deactivated staff user is locked out immediately', async () => {
      const target = await makeStaff(await makeRole(['orders.view']));
      await app.inject({ method: 'PATCH', url: `/api/users/${target.id}`, headers: auth(adminToken), payload: { isActive: false } });
      expect((await app.inject({ method: 'GET', url: '/api/orders', headers: auth(target.token) })).statusCode).toBe(401);
    });

    it('cannot escalate a staff user to restaurant_admin / super_admin or move it to another tenant (403)', async () => {
      const target = await makeStaff(await makeRole([]));
      for (const payload of [{ role: 'restaurant_admin' }, { role: 'super_admin' }, { restaurantId: OTHER }]) {
        const res = await app.inject({ method: 'PATCH', url: `/api/users/${target.id}`, headers: auth(adminToken), payload });
        expect(res.statusCode, JSON.stringify(payload)).toBe(403);
      }
      expect((await deps.userRepo.findById(target.id))?.role).toBe('restaurant_staff');
    });

    it('cannot modify another restaurant_admin or a super_admin (403)', async () => {
      for (const id of ['user-superadmin']) {
        const res = await app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: auth(adminToken), payload: { isActive: false } });
        expect([403, 404], id).toContain(res.statusCode);
      }
      const res = await app.inject({ method: 'PATCH', url: '/api/users/user-admin-peer', headers: auth(adminToken), payload: { isActive: false } });
      expect(res.statusCode).toBe(403);
      expect((await deps.userRepo.findById('user-admin-peer'))?.isActive).toBe(true);
    });

    it('cannot touch users of another tenant (404 hides their existence)', async () => {
      const foreign = await makeStaff(await makeRole([], OTHER), OTHER);
      const res = await app.inject({ method: 'PATCH', url: `/api/users/${foreign.id}`, headers: auth(adminToken), payload: { isActive: false } });
      expect(res.statusCode).toBe(404);
      expect((await deps.userRepo.findById(foreign.id))?.isActive).toBe(true);
    });

    it('cannot assign a role of another restaurant (404)', async () => {
      const target = await makeStaff(await makeRole([]));
      const foreignRole = await makeRole(['orders.view'], OTHER);
      const res = await app.inject({ method: 'PATCH', url: `/api/users/${target.id}`, headers: auth(adminToken), payload: { roleId: foreignRole } });
      expect(res.statusCode).toBe(404);
    });

    it('super_admin can change a staff role and demote/promote through role changes', async () => {
      const target = await makeStaff(await makeRole([]));
      const next = await makeRole(['menu.manage']);
      const res = await app.inject({ method: 'PATCH', url: `/api/users/${target.id}`, headers: auth(superToken), payload: { roleId: next } });
      expect(res.statusCode).toBe(200);
      expect(res.json().roleId).toBe(next);
    });

    it('super_admin promoting staff to restaurant_admin clears the custom role', async () => {
      const target = await makeStaff(await makeRole([]));
      const res = await app.inject({ method: 'PATCH', url: `/api/users/${target.id}`, headers: auth(superToken), payload: { role: 'restaurant_admin' } });
      expect(res.statusCode).toBe(200);
      expect((await deps.userRepo.findById(target.id))?.roleId).toBeUndefined();
    });
  });

  describe('reset-password and delete by restaurant_admin', () => {
    it('resets the password of its own staff and returns a temporary one', async () => {
      const target = await makeStaff(await makeRole([]));
      const res = await app.inject({ method: 'POST', url: `/api/users/${target.id}/reset-password`, headers: auth(adminToken) });
      expect(res.statusCode).toBe(200);
      expect(res.json().temporaryPassword).toEqual(expect.any(String));
      expect((await deps.userRepo.findById(target.id))?.mustChangePassword).toBe(true);
    });

    it('cannot reset passwords of admins or of another tenant', async () => {
      const foreign = await makeStaff(await makeRole([], OTHER), OTHER);
      expect((await app.inject({ method: 'POST', url: `/api/users/${foreign.id}/reset-password`, headers: auth(adminToken) })).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: '/api/users/user-admin-other/reset-password', headers: auth(adminToken) })).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: '/api/users/user-admin-peer/reset-password', headers: auth(adminToken) })).statusCode).toBe(403);
    });

    it('deletes its own staff but not admins nor other tenants', async () => {
      const target = await makeStaff(await makeRole([]));
      expect((await app.inject({ method: 'DELETE', url: `/api/users/${target.id}`, headers: auth(adminToken) })).statusCode).toBe(204);
      expect(await deps.userRepo.findById(target.id)).toBeNull();

      const foreign = await makeStaff(await makeRole([], OTHER), OTHER);
      expect((await app.inject({ method: 'DELETE', url: `/api/users/${foreign.id}`, headers: auth(adminToken) })).statusCode).toBe(404);
      expect(await deps.userRepo.findById(foreign.id)).not.toBeNull();
      expect((await app.inject({ method: 'DELETE', url: '/api/users/user-admin-peer', headers: auth(adminToken) })).statusCode).toBe(403);
      expect((await app.inject({ method: 'DELETE', url: '/api/users/user-superadmin', headers: auth(adminToken) })).statusCode).toBe(404);
    });

    it('the other tenant admin is equally isolated', async () => {
      const mine = await makeStaff(await makeRole([]));
      expect((await app.inject({ method: 'DELETE', url: `/api/users/${mine.id}`, headers: auth(otherAdminToken) })).statusCode).toBe(404);
    });
  });

  describe('staff delegated users.manage cannot escalate', () => {
    it('is refused without the permission', async () => {
      const s = await makeStaff(await makeRole(['orders.view']));
      const roleId = await makeRole([]);
      expect((await createUser(s.token, { role: 'restaurant_staff', roleId })).statusCode).toBe(403);
    });

    it('can create staff with a role whose permissions it holds itself', async () => {
      const manager = await makeStaff(await makeRole(['users.manage', 'orders.view', 'orders.manage']));
      const roleId = await makeRole(['orders.view']);
      const res = await createUser(manager.token, { role: 'restaurant_staff', roleId });
      expect(res.statusCode).toBe(201);
    });

    it('cannot assign a role with permissions it does not hold (403)', async () => {
      const manager = await makeStaff(await makeRole(['users.manage', 'orders.view']));
      const bigRole = await makeRole(['orders.view', 'finance.view']);
      expect((await createUser(manager.token, { role: 'restaurant_staff', roleId: bigRole })).statusCode).toBe(403);
    });

    it('cannot create admins (403)', async () => {
      const manager = await makeStaff(await makeRole(['users.manage']));
      expect((await createUser(manager.token, { role: 'restaurant_admin', restaurantId: TENANT })).statusCode).toBe(403);
    });

    it('cannot modify itself or a more privileged staff user, and cannot hand itself a bigger role', async () => {
      const manager = await makeStaff(await makeRole(['users.manage', 'orders.view']));
      const bigRole = await makeRole(['orders.view', 'finance.view']);
      const powerful = await makeStaff(bigRole);
      const bigger = await makeRole(['users.manage', 'orders.view', 'finance.view']);

      const self = await app.inject({ method: 'PATCH', url: `/api/users/${manager.id}`, headers: auth(manager.token), payload: { roleId: bigger } });
      expect(self.statusCode).toBe(403);
      const takeover = await app.inject({ method: 'POST', url: `/api/users/${powerful.id}/reset-password`, headers: auth(manager.token) });
      expect(takeover.statusCode).toBe(403);
      const del = await app.inject({ method: 'DELETE', url: `/api/users/${powerful.id}`, headers: auth(manager.token) });
      expect(del.statusCode).toBe(403);
      const demote = await app.inject({ method: 'PATCH', url: `/api/users/${powerful.id}`, headers: auth(manager.token), payload: { isActive: false } });
      expect(demote.statusCode).toBe(403);
    });

    it('can manage a staff user whose role is within its own permissions', async () => {
      const manager = await makeStaff(await makeRole(['users.manage', 'orders.view', 'orders.manage']));
      const target = await makeStaff(await makeRole(['orders.view']));
      const res = await app.inject({ method: 'PATCH', url: `/api/users/${target.id}`, headers: auth(manager.token), payload: { isActive: false } });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('roles.manage delegation', () => {
    it('staff without roles.manage get 403', async () => {
      const s = await makeStaff(await makeRole(['orders.view']));
      expect((await app.inject({ method: 'GET', url: '/api/roles', headers: auth(s.token) })).statusCode).toBe(403);
    });

    it('staff with roles.manage can list and create roles within their own permissions', async () => {
      const s = await makeStaff(await makeRole(['roles.manage', 'orders.view']));
      expect((await app.inject({ method: 'GET', url: '/api/roles', headers: auth(s.token) })).statusCode).toBe(200);
      const ok = await app.inject({ method: 'POST', url: '/api/roles', headers: auth(s.token), payload: { name: `sub-${++seq}`, permissions: ['orders.view'] } });
      expect(ok.statusCode).toBe(201);
    });

    it('cannot create or grow a role beyond the permissions it holds (403)', async () => {
      const s = await makeStaff(await makeRole(['roles.manage', 'orders.view']));
      const create = await app.inject({ method: 'POST', url: '/api/roles', headers: auth(s.token), payload: { name: `big-${++seq}`, permissions: ['orders.view', 'finance.view'] } });
      expect(create.statusCode).toBe(403);
      const other = await makeRole(['orders.view']);
      const grow = await app.inject({ method: 'PUT', url: `/api/roles/${other}`, headers: auth(s.token), payload: { permissions: ['orders.view', 'users.manage'] } });
      expect(grow.statusCode).toBe(403);
    });

    it('cannot edit or delete the role it holds itself (self-escalation)', async () => {
      const ownRole = await makeRole(['roles.manage', 'orders.view']);
      const s = await makeStaff(ownRole);
      const edit = await app.inject({ method: 'PUT', url: `/api/roles/${ownRole}`, headers: auth(s.token), payload: { permissions: ['orders.view'] } });
      expect(edit.statusCode).toBe(403);
      const del = await app.inject({ method: 'DELETE', url: `/api/roles/${ownRole}`, headers: auth(s.token) });
      expect(del.statusCode).toBe(403);
    });

    it('restaurant_admin keeps full role management', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/roles', headers: auth(adminToken), payload: { name: `admin-${++seq}`, permissions: ['finance.view', 'users.manage'] } });
      expect(res.statusCode).toBe(201);
    });
  });
});
