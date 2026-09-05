export type UserRole = 'super_admin' | 'restaurant_admin';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  restaurantId?: string;
  createdAt: string;
}
