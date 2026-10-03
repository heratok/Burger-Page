import { describe, it, expect } from 'vitest';
import { computeRemovesSuperAdminAccess, wouldStripLastActiveSuperAdmin } from '../../../src/domain/shared/superAdminGuard.js';

describe('computeRemovesSuperAdminAccess', () => {
  it('removes access when the next role is not super_admin', () => {
    expect(computeRemovesSuperAdminAccess('restaurant_admin', true)).toBe(true);
  });

  it('removes access when staying super_admin but going inactive', () => {
    expect(computeRemovesSuperAdminAccess('super_admin', false)).toBe(true);
  });

  it('keeps access when staying an active super_admin', () => {
    expect(computeRemovesSuperAdminAccess('super_admin', true)).toBe(false);
  });
});

describe('wouldStripLastActiveSuperAdmin', () => {
  const activeSuperAdmin = { role: 'super_admin' as const, isActive: true };

  it('blocks when the target is the last active super admin and access is removed', () => {
    expect(wouldStripLastActiveSuperAdmin(activeSuperAdmin, true, false)).toBe(true);
  });

  it('allows when another active super admin remains', () => {
    expect(wouldStripLastActiveSuperAdmin(activeSuperAdmin, true, true)).toBe(false);
  });

  it('allows when the change does not remove access (e.g. reactivating)', () => {
    expect(wouldStripLastActiveSuperAdmin(activeSuperAdmin, false, false)).toBe(false);
  });

  it('allows for a non-super_admin target regardless of other flags', () => {
    expect(wouldStripLastActiveSuperAdmin({ role: 'restaurant_admin', isActive: true }, true, false)).toBe(false);
  });

  it('allows for an already-inactive super_admin target', () => {
    expect(wouldStripLastActiveSuperAdmin({ role: 'super_admin', isActive: false }, true, false)).toBe(false);
  });

  it('combines role-change and active-change into one removesAccess decision (updateGuarded dual-axis case)', () => {
    // Demoting AND deactivating in one call is still just "removes access".
    const removesAccess = computeRemovesSuperAdminAccess('restaurant_admin', false);
    expect(wouldStripLastActiveSuperAdmin(activeSuperAdmin, removesAccess, false)).toBe(true);
    expect(wouldStripLastActiveSuperAdmin(activeSuperAdmin, removesAccess, true)).toBe(false);
  });
});
