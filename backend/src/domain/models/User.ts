export type UserRole = 'super_admin' | 'restaurant_admin';

/** Minimum length for any password a user sets or is created with. */
export const MIN_PASSWORD_LENGTH = 8;
    
    export interface User {
      id: string;
      username: string;
      passwordHash: string;
      role: UserRole;
      restaurantId?: string;
      createdAt: string;
      /** Soft-disable flag backed by users.is_active (Postgres). Absent on
       *  providers/in-memory seeds that do not model it: treat as active. */
      isActive?: boolean;
      /** Set after a super-admin password reset: the account may only change its own password until cleared (users.must_change_password). */
      mustChangePassword?: boolean;
    }