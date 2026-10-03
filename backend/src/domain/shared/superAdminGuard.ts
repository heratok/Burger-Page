import { UserRole } from '../models/User.js';

/**
 * The invariant every UserRepository adapter must enforce identically: a
 * change can never leave the platform with zero active super admins. This is
 * the single source of truth for the decision; each adapter still does its
 * own atomic read-lock-then-decide dance (Postgres row locks, InMemory's
 * synchronous Map), but all of them ask this same pure question.
 */
export interface SuperAdminGuardTarget {
  role: UserRole;
  isActive: boolean;
}

/** Whether a role/active change would strip the target's super-admin access. */
export function computeRemovesSuperAdminAccess(nextRole: UserRole, nextActive: boolean): boolean {
  return nextRole !== 'super_admin' || !nextActive;
}

/**
 * True when applying a change that removes access would leave zero active
 * super admins. `hasOtherActiveSuperAdmin` must be computed by the caller
 * under whatever locking guarantees its storage provides.
 */
export function wouldStripLastActiveSuperAdmin(
  target: SuperAdminGuardTarget,
  removesAccess: boolean,
  hasOtherActiveSuperAdmin: boolean
): boolean {
  if (!removesAccess) return false;
  if (target.role !== 'super_admin' || !target.isActive) return false;
  return !hasOtherActiveSuperAdmin;
}
