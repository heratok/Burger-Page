import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRestaurantRepository } from '../../src/infrastructure/persistence/supabase/SupabaseRestaurantRepository.js';
import { SupabaseProductRepository } from '../../src/infrastructure/persistence/supabase/SupabaseProductRepository.js';
import { SupabaseOrderRepository } from '../../src/infrastructure/persistence/supabase/SupabaseOrderRepository.js';
import { SupabaseCustomerRepository } from '../../src/infrastructure/persistence/supabase/SupabaseCustomerRepository.js';
import { SupabaseInventoryRepository } from '../../src/infrastructure/persistence/supabase/SupabaseInventoryRepository.js';
import { createSupabaseClient, getSupabaseClient } from '../../src/infrastructure/persistence/supabase/SupabaseClient.js';
import { buildDependencies } from '../../src/infrastructure/http/app.js';
import { Product } from '../../src/domain/models/Product.js';
import { Order } from '../../src/domain/models/Order.js';
import { Customer } from '../../src/domain/models/Customer.js';
import { Restaurant } from '../../src/domain/models/Restaurant.js';
import { Inventory } from '../../src/domain/models/Inventory.js';

describe('Supabase Persistence Adapter Suite', () => {
  let mockTables: Record<string, any[]>;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockTables = {
      restaurants: [],
      products: [],
      orders: [],
      customers: [],
      inventory: []
    };

    mockSupabaseClient = {
      from: (tableName: string) => {
        return {
          select: (columns: string = '*') => {
            let filterField: string | null = null;
            let filterValue: any = null;
            let sortField: string | null = null;
            let sortAscending = true;

            const queryBuilder: any = {
              eq: (field: string, value: any) => {
                filterField = field;
                filterValue = value;
                return queryBuilder;
              },
              order: (field: string, options?: { ascending?: boolean }) => {
                sortField = field;
                sortAscending = options?.ascending ?? true;
                return queryBuilder;
              },
              maybeSingle: async () => {
                const table = mockTables[tableName] || [];
                const matched = filterField
                  ? table.find((row) => row[filterField!] === filterValue)
                  : table[0];
                return { data: matched || null, error: null };
              },
              then: (resolve: any, reject: any) => {
                let rows = [...(mockTables[tableName] || [])];
                if (filterField) {
                  rows = rows.filter((row) => row[filterField!] === filterValue);
                }
                if (sortField) {
                  rows.sort((a, b) => {
                    if (a[sortField!] < b[sortField!]) return sortAscending ? -1 : 1;
                    if (a[sortField!] > b[sortField!]) return sortAscending ? 1 : -1;
                    return 0;
                  });
                }
                return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
              }
            };

            return queryBuilder;
          },
          upsert: async (payload: any, options?: { onConflict?: string }) => {
            const table = mockTables[tableName] || [];
            const conflictKey = options?.onConflict || 'id';
            const index = table.findIndex((row) => row[conflictKey] === payload[conflictKey]);
            if (index >= 0) {
              table[index] = { ...table[index], ...payload };
            } else {
              table.push({ ...payload });
            }
            mockTables[tableName] = table;
            return { data: payload, error: null };
          },
          delete: () => {
            let filterField: string | null = null;
            let filterValue: any = null;

            const deleteBuilder: any = {
              eq: async (field: string, value: any) => {
                filterField = field;
                filterValue = value;
                const table = mockTables[tableName] || [];
                mockTables[tableName] = table.filter((row) => row[filterField!] !== filterValue);
                return { data: null, error: null };
              }
            };
            return deleteBuilder;
          }
        };
      }
    };
  });

  describe('SupabaseClient initialization', () => {
    it('throws error when SUPABASE_URL or KEY is missing', () => {
      const originalUrl = process.env.SUPABASE_URL;
      const originalKey = process.env.SUPABASE_KEY;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      expect(() => createSupabaseClient()).toThrow(/Supabase client requires SUPABASE_URL/);

      if (originalUrl) process.env.SUPABASE_URL = originalUrl;
      if (originalKey) process.env.SUPABASE_KEY = originalKey;
    });

    it('creates client when valid config is passed', () => {
      const client = createSupabaseClient({
        supabaseUrl: 'https://xyzcompany.supabase.co',
        supabaseKey: 'test-service-key'
      });
      expect(client).toBeDefined();
    });
  });

  describe('SupabaseRestaurantRepository', () => {
    it('saves, retrieves by id and slug, and parses json fields', async () => {
      const repo = new SupabaseRestaurantRepository(mockSupabaseClient as unknown as SupabaseClient);

      const restaurant: Restaurant = {
        id: 'rest-sb-1',
        slug: 'artisan-burger',
        name: 'Artisan Burger Co',
        theme: 'dark-charcoal',
        openingHours: { open: '11:00', close: '23:00' },
        isActive: true
      };

      await repo.save(restaurant);

      const byId = await repo.findById('rest-sb-1');
      expect(byId).not.toBeNull();
      expect(byId?.id).toBe('rest-sb-1');
      expect(byId?.slug).toBe('artisan-burger');
      expect(byId?.name).toBe('Artisan Burger Co');
      expect(byId?.theme).toBe('dark-charcoal');
      expect(byId?.openingHours).toEqual({ open: '11:00', close: '23:00' });

      const bySlug = await repo.findBySlug('artisan-burger');
      expect(bySlug).not.toBeNull();
      expect(bySlug?.id).toBe('rest-sb-1');
    });

    it('returns null when restaurant does not exist', async () => {
      const repo = new SupabaseRestaurantRepository(mockSupabaseClient as unknown as SupabaseClient);
      expect(await repo.findById('unknown')).toBeNull();
      expect(await repo.findBySlug('unknown-slug')).toBeNull();
    });
  });

  describe('SupabaseProductRepository', () => {
    it('saves, finds by id, lists all, and deletes product', async () => {
      const repo = new SupabaseProductRepository(mockSupabaseClient as unknown as SupabaseClient);

      const product: Product = {
        id: 'prod-10',
        name: 'Truffle Smash Burger',
        description: 'Double patty with truffle aioli',
        price: 32000,
        category: 'Gourmet',
        isAvailable: true,
        additions: ['Extra Truffle', 'Crispy Onions']
      };

      await repo.save(product);

      const found = await repo.findById('prod-10');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Truffle Smash Burger');
      expect(found?.price).toBe(32000);
      expect(found?.additions).toEqual(['Extra Truffle', 'Crispy Onions']);

      const all = await repo.findAll();
      expect(all.length).toBe(1);

      await repo.delete('prod-10');
      expect(await repo.findById('prod-10')).toBeNull();
    });
  });

  describe('SupabaseOrderRepository', () => {
    it('saves and retrieves order with correct domain calculation', async () => {
      const repo = new SupabaseOrderRepository(mockSupabaseClient as unknown as SupabaseClient);

      const order = new Order(
        'order-supabase-1',
        'cust-10',
        [{ productId: 'prod-10', quantity: 2, price: 32000, additions: ['Extra Truffle'] }],
        'pending',
        new Date('2026-08-28T12:00:00Z'),
        5000
      );

      await repo.save(order);

      const retrieved = await repo.findById('order-supabase-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('order-supabase-1');
      expect(retrieved?.customerId).toBe('cust-10');
      expect(retrieved?.subtotal).toBe(64000);
      expect(retrieved?.deliveryFee).toBe(5000);
      expect(retrieved?.total).toBe(69000);
      expect(retrieved?.status).toBe('pending');

      const all = await repo.findAll();
      expect(all.length).toBe(1);
    });
  });

  describe('SupabaseCustomerRepository', () => {
    it('saves and retrieves customer calculating loyalty tier', async () => {
      const repo = new SupabaseCustomerRepository(mockSupabaseClient as unknown as SupabaseClient);

      const customer = new Customer('cust-sb-1', 'Camila Rivas', 'camila@example.com', '+573001112233');
      customer.addOrderSpend(400);

      await repo.save(customer);

      const retrieved = await repo.findById('cust-sb-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Camila Rivas');
      expect(retrieved?.email).toBe('camila@example.com');
      expect(retrieved?.loyaltyTier).toBe('Silver');

      const all = await repo.findAll();
      expect(all.length).toBe(1);
    });
  });

  describe('SupabaseInventoryRepository', () => {
    it('saves and updates inventory stock item', async () => {
      const repo = new SupabaseInventoryRepository(mockSupabaseClient as unknown as SupabaseClient);

      const inventory: Inventory = {
        id: 'inv-truffle-sauce',
        name: 'Truffle Aioli Sauce',
        quantity: 35,
        unit: 'bottles',
        alertThreshold: 5
      };

      await repo.save(inventory);

      const retrieved = await repo.findById('inv-truffle-sauce');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Truffle Aioli Sauce');
      expect(retrieved?.quantity).toBe(35);
      expect(retrieved?.alertThreshold).toBe(5);

      const all = await repo.findAll();
      expect(all.length).toBe(1);
    });
  });

  describe('buildDependencies with Supabase driver', () => {
    it('gracefully initializes or falls back when driver is supabase', () => {
      // With env vars set
      process.env.SUPABASE_URL = 'https://demo.supabase.co';
      process.env.SUPABASE_KEY = 'demo-key';
      process.env.STORAGE_DRIVER = 'supabase';

      const deps = buildDependencies(undefined, 'supabase');
      expect(deps.restaurantController).toBeDefined();
      expect(deps.productController).toBeDefined();
      expect(deps.orderController).toBeDefined();
      expect(deps.customerController).toBeDefined();
      expect(deps.inventoryController).toBeDefined();

      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_KEY;
      delete process.env.STORAGE_DRIVER;
    });

    it('falls back to in-memory when supabase initialization fails and no sqlite path', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      const deps = buildDependencies(undefined, 'supabase');
      expect(deps.restaurantController).toBeDefined();
      expect(deps.productController).toBeDefined();
    });
  });
});
