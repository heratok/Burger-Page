import { SupabaseClient } from '@supabase/supabase-js';
import { User, UserRole } from '../../../domain/models/User.js';
import { UserRepository } from '../../../domain/ports/out/UserRepository.js';

export class SupabaseUserRepository implements UserRepository {
  constructor(private client: SupabaseClient) {}

  private mapRow(row: any): User {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      restaurantId: row.restaurant_id || undefined,
      createdAt: row.created_at || new Date().toISOString(),
    };
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(data);
  }

  async findByUsername(username: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user by username: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(data);
  }

  async findByRestaurantId(restaurantId: string): Promise<User[]> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to find users by restaurantId: ${error.message}`);
    }
    return (data || []).map((row: any) => this.mapRow(row));
  }

  async findAll(): Promise<User[]> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }
    return (data || []).map((row: any) => this.mapRow(row));
  }

  async save(user: User): Promise<void> {
    const payload = {
      id: user.id,
      username: user.username,
      password_hash: user.passwordHash,
      role: user.role,
      restaurant_id: user.restaurantId || null,
      is_active: true,
      created_at: user.createdAt || new Date().toISOString(),
    };

    const { error } = await this.client
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save user: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}
