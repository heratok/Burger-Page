import { z } from 'zod';

// ==========================================
// RBAC: PERMISSION CATALOG AND CUSTOM ROLES
// ==========================================
// The catalog is fixed in code (single source of truth for backend and
// frontend). Roles are DATA: each restaurant defines its own roles as a named
// subset of this catalog, so adding a role never needs a code or DB change.

export const PERMISSIONS = [
  'orders.view',
  'orders.manage',
  'orders.delete',
  'customers.view',
  'customers.manage',
  'menu.manage',
  'inventory.manage',
  'tables.manage',
  'finance.view',
  'settings.manage',
  'users.manage',
  'roles.manage',
] as const;

export const permissionEnum = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof permissionEnum>;

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

export const MAX_ROLE_NAME_LENGTH = 40;
export const MAX_ROLE_DESCRIPTION_LENGTH = 200;

const roleNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre del rol es obligatorio')
  .max(MAX_ROLE_NAME_LENGTH, `El nombre del rol no puede superar ${MAX_ROLE_NAME_LENGTH} caracteres`);

const rolePermissionsSchema = z
  .array(permissionEnum)
  .refine((list) => new Set(list).size === list.length, 'Los permisos no pueden repetirse');

export const roleCreateSchema = z.object({
  restaurantId: z.string().optional(),
  name: roleNameSchema,
  description: z.string().trim().max(MAX_ROLE_DESCRIPTION_LENGTH).optional(),
  permissions: rolePermissionsSchema,
});
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;

export const roleUpdateSchema = z.object({
  restaurantId: z.string().optional(),
  name: roleNameSchema.optional(),
  description: z.string().trim().max(MAX_ROLE_DESCRIPTION_LENGTH).optional(),
  permissions: rolePermissionsSchema.optional(),
});
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;

/** Wire shape of a role returned by the API. */
export interface RoleDTO {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionSubject {
  role: 'super_admin' | 'restaurant_admin' | 'restaurant_staff';
  /** Permissions stored on the staff user's role; ignored for the admin roles. */
  rolePermissions?: readonly string[];
}

/**
 * Expands a user to its effective permission set. Admins hold every
 * permission implicitly; staff hold exactly their role's permissions (unknown
 * strings, e.g. from a retired catalog entry, are dropped).
 */
export function resolvePermissions(subject: PermissionSubject): Permission[] {
  if (subject.role === 'super_admin' || subject.role === 'restaurant_admin') {
    return [...PERMISSIONS];
  }
  const granted = new Set(subject.rolePermissions ?? []);
  return PERMISSIONS.filter((p) => granted.has(p));
}

export function hasPermission(subject: PermissionSubject, permission: Permission): boolean {
  return resolvePermissions(subject).includes(permission);
}
