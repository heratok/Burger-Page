import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  permissionEnum,
  isPermission,
  MAX_ROLE_NAME_LENGTH,
  roleCreateSchema,
  roleUpdateSchema,
  resolvePermissions,
  hasPermission,
  AUDIT_ACTIONS,
} from './index.js';

describe('permission catalog', () => {
  it('lists every permission exactly once, in dotted resource.action form', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    for (const p of PERMISSIONS) expect(p).toMatch(/^[a-z]+\.[a-z]+$/);
    expect(PERMISSIONS).toEqual([
      'orders.view', 'orders.manage', 'orders.delete',
      'customers.view', 'customers.manage',
      'menu.manage', 'inventory.manage', 'tables.manage',
      'finance.view', 'settings.manage', 'users.manage', 'roles.manage',
    ]);
  });

  it('validates membership through the zod enum and the type guard', () => {
    expect(permissionEnum.safeParse('orders.view').success).toBe(true);
    expect(permissionEnum.safeParse('orders.fly').success).toBe(false);
    expect(isPermission('finance.view')).toBe(true);
    expect(isPermission('nope')).toBe(false);
    expect(isPermission(42)).toBe(false);
  });
});

describe('role schemas', () => {
  it('accepts a valid create payload and trims the name', () => {
    const parsed = roleCreateSchema.parse({ name: '  Cashier ', permissions: ['orders.view', 'orders.manage'] });
    expect(parsed.name).toBe('Cashier');
    expect(parsed.description).toBeUndefined();
  });

  it('rejects empty/oversized names, unknown permissions and duplicates', () => {
    expect(roleCreateSchema.safeParse({ name: '   ', permissions: [] }).success).toBe(false);
    expect(roleCreateSchema.safeParse({ name: 'x'.repeat(MAX_ROLE_NAME_LENGTH + 1), permissions: [] }).success).toBe(false);
    expect(roleCreateSchema.safeParse({ name: 'A', permissions: ['orders.fly'] }).success).toBe(false);
    expect(roleCreateSchema.safeParse({ name: 'A', permissions: ['orders.view', 'orders.view'] }).success).toBe(false);
    expect(roleCreateSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('allows an empty permission list (a role with no access)', () => {
    expect(roleCreateSchema.safeParse({ name: 'Nobody', permissions: [] }).success).toBe(true);
  });

  it('update is partial but still validates the fields it carries', () => {
    expect(roleUpdateSchema.safeParse({}).success).toBe(true);
    expect(roleUpdateSchema.safeParse({ description: 'Front of house' }).success).toBe(true);
    expect(roleUpdateSchema.safeParse({ permissions: ['bogus'] }).success).toBe(false);
    expect(roleUpdateSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('resolvePermissions', () => {
  it('gives restaurant_admin and super_admin every permission', () => {
    expect(resolvePermissions({ role: 'restaurant_admin' })).toEqual([...PERMISSIONS]);
    expect(resolvePermissions({ role: 'super_admin' })).toEqual([...PERMISSIONS]);
  });

  it('gives restaurant_staff exactly the permissions of its role, ignoring unknown ones', () => {
    expect(
      resolvePermissions({ role: 'restaurant_staff', rolePermissions: ['orders.view', 'legacy.thing', 'orders.view'] })
    ).toEqual(['orders.view']);
  });

  it('gives restaurant_staff without a role nothing', () => {
    expect(resolvePermissions({ role: 'restaurant_staff' })).toEqual([]);
  });

  it('hasPermission checks the resolved set', () => {
    expect(hasPermission({ role: 'restaurant_admin' }, 'roles.manage')).toBe(true);
    expect(hasPermission({ role: 'restaurant_staff', rolePermissions: ['orders.view'] }, 'finance.view')).toBe(false);
  });
});

describe('audit actions for roles', () => {
  it('records role mutations', () => {
    expect(AUDIT_ACTIONS).toEqual(expect.arrayContaining(['role.create', 'role.update', 'role.delete']));
  });
});
