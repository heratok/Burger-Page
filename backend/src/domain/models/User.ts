export type UserRole = 'super_admin' | 'restaurant_admin';
    
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
    }