import type { Permission } from '@burger-page/contracts';

/**
 * A custom, per-restaurant role: a named subset of the permission catalog
 * (packages/contracts) that the restaurant admin assigns to staff users.
 */
export interface Role {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  /** System roles are created by the platform and cannot be edited or deleted from the panel. */
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Same limit as the chk_roles_name CHECK. */
export const MAX_ROLE_NAME_LENGTH = 40;
