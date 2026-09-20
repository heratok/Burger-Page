import { User, UserRole } from '../../models/User.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByRestaurantId(restaurantId: string): Promise<User[]>;
  findAll(actorRole?: UserRole): Promise<User[]>;
  save(user: User, actorRole?: UserRole): Promise<void>;
  delete(id: string, actorRole?: UserRole): Promise<void>;
}
