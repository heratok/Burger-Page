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
  DEFAULT_ROLE_TEMPLATES,
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

describe('DEFAULT_ROLE_TEMPLATES', () => {
  const byName = (name: string) => DEFAULT_ROLE_TEMPLATES.find((t) => t.name === name)!;

  it('ships Cajero, Mesero, Cocina and Gerente', () => {
    expect(DEFAULT_ROLE_TEMPLATES.map((t) => t.name)).toEqual(['Cajero', 'Mesero', 'Cocina', 'Gerente']);
  });

  it('uses unique names and only valid, non-repeated permissions', () => {
    const names = DEFAULT_ROLE_TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of DEFAULT_ROLE_TEMPLATES) {
      expect(t.name.length).toBeLessThanOrEqual(MAX_ROLE_NAME_LENGTH);
      expect(t.description.length).toBeGreaterThan(0);
      expect(new Set(t.permissions).size).toBe(t.permissions.length);
      for (const p of t.permissions) expect(isPermission(p)).toBe(true);
    }
  });

  it('never gives the cashier finance.view', () => {
    expect(byName('Cajero').permissions).not.toContain('finance.view');
    expect(byName('Cajero').permissions).toEqual(
      expect.arrayContaining(['orders.view', 'orders.manage', 'customers.view', 'customers.manage', 'tables.manage'])
    );
  });

  it('gives the manager everything except users.manage and roles.manage', () => {
    const perms = byName('Gerente').permissions;
    expect(perms).not.toContain('users.manage');
    expect(perms).not.toContain('roles.manage');
    expect([...perms].sort()).toEqual(
      PERMISSIONS.filter((p) => p !== 'users.manage' && p !== 'roles.manage').sort()
    );
  });

  it('keeps waiter and kitchen narrow', () => {
    expect([...byName('Mesero').permissions].sort()).toEqual(
      ['customers.view', 'orders.manage', 'orders.view', 'tables.manage']
    );
    expect([...byName('Cocina').permissions].sort()).toEqual(['orders.manage', 'orders.view']);
  });

  it('every template passes roleCreateSchema', () => {
    for (const t of DEFAULT_ROLE_TEMPLATES) {
      expect(roleCreateSchema.safeParse({ name: t.name, description: t.description, permissions: t.permissions }).success).toBe(true);
    }
  });
});

describe('audit actions for roles', () => {
  it('records role mutations', () => {
    expect(AUDIT_ACTIONS).toEqual(expect.arrayContaining(['role.create', 'role.update', 'role.delete']));
  });
});
