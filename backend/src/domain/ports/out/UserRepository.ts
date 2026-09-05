import { User } from '../../models/User.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByRestaurantId(restaurantId: string): Promise<User[]>;
  findAll(): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
