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
            const filters: Array<{ field: string; value: any }> = [];
            let sortField: string | null = null;
            let sortAscending = true;

            const queryBuilder: any = {
              eq: (field: string, value: any) => {
                filters.push({ field, value });
                return queryBuilder;
              },
              order: (field: string, options?: { ascending?: boolean }) => {
                sortField = field;
                sortAscending = options?.ascending ?? true;
                return queryBuilder;
              },
              maybeSingle: async () => {
                const table = mockTables[tableName] || [];
                const matched = filters.length > 0
                  ? table.find((row) => filters.every((f) => row[f.field] === f.value))
                  : table[0];
                return { data: matched || null, error: null };
              },
              then: (resolve: any, reject: any) => {
                let rows = [...(mockTables[tableName] || [])];
                if (filters.length > 0) {
                  rows = rows.filter((row) => filters.every((f) => row[f.field] === f.value));
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
            const conflictKeys = options?.onConflict
              ? options.onConflict.split(',').map((k) => k.trim())
              : ['id'];
            const index = table.findIndex((row) =>
              conflictKeys.every((k) => row[k] === payload[k])
            );
            if (index >= 0) {
              table[index] = { ...table[index], ...payload };
            } else {
              table.push({ ...payload });
            }
            mockTables[tableName] = table;
            return { data: payload, error: null };
          },
          delete: () => {
            const deleteFilters: Array<{ field: string; value: any }> = [];

            const deleteBuilder: any = {
              eq: (field: string, value: any) => {
                deleteFilters.push({ field, value });
                return deleteBuilder;
              },
              then: (resolve: any, reject: any) => {
                const table = mockTables[tableName] || [];
                mockTables[tableName] = table.filter(
                  (row) => !deleteFilters.every((f) => row[f.field] === f.value)
                );
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
              }
            };
            return deleteBuilder;
          }
        };
      },
      rpc: async (functionName: string, params: any) => {
        if (functionName === 'create_order_atomic') {
          const newOrder = {
            id: params.p_order_id,
            restaurant_id: params.p_restaurant_id,
            customer_id: params.p_customer_id,
            order_number: 10023,
            status: 'pending',
            subtotal: 64000,
            delivery_fee: 5000,
            final_total: 69000,
            payment_method: params.p_payment_method || 'Efectivo',
            order_items: (params.p_items || []).map((i: any) => ({
              id: i.id,
              order_id: params.p_order_id,
              product_id: i.product_id,
              product_name: 'Mock Product',
              unit_price: 32000,
              quantity: i.quantity,
              order_item_additions: (i.additions || []).map((a: any) => ({
                id: a.id,
                addition_id: a.addition_id,
                addition_name: 'Mock Addition',
                unit_price: 0,
                quantity: a.quantity || 1
              }))
            })),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          mockTables.orders.push(newOrder);
          return { data: newOrder, error: null };
        }
        if (functionName === 'update_order_status_with_actor') {
          const order = mockTables.orders.find(o => o.id === params.p_order_id && o.restaurant_id === params.p_restaurant_id);
          if (order) {
            order.status = params.p_new_status;
            return { data: true, error: null };
          }
          return { data: false, error: null };
        }
        return { data: null, error: null };
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
    it('saves, finds by id, lists by restaurant, and deletes product with strict tenant isolation', async () => {
      const repo = new SupabaseProductRepository(mockSupabaseClient as unknown as SupabaseClient);

      const product: Product = {
        id: 'prod-10',
        restaurantId: 'burger-craft',
        name: 'Truffle Smash Burger',
        description: 'Double patty with truffle aioli',
        price: 32000,
        category: 'Gourmet',
        isAvailable: true,
        isPopular: true,
        isNew: true,
        preparationTimeMinutes: 20,
        displayOrder: 2,
        additions: ['Extra Truffle', 'Crispy Onions']
      };

      await repo.save(product);

      const found = await repo.findById('prod-10', 'burger-craft');
      expect(found).not.toBeNull();
      expect(found?.restaurantId).toBe('burger-craft');
      expect(found?.name).toBe('Truffle Smash Burger');
      expect(found?.price).toBe(32000);
      expect(found?.isAvailable).toBe(true);
      expect(found?.isPopular).toBe(true);
      expect(found?.isNew).toBe(true);
      expect(found?.preparationTimeMinutes).toBe(20);
      expect(found?.displayOrder).toBe(2);
      expect(found?.additions).toEqual(['Extra Truffle', 'Crispy Onions']);

      // Tenant isolation: querying with foreign restaurantId returns null
      const foreign = await repo.findById('prod-10', 'foreign-restaurant');
      expect(foreign).toBeNull();

      const all = await repo.findByRestaurantId('burger-craft');
      expect(all.length).toBe(1);
      expect(all[0].isPopular).toBe(true);
      expect(all[0].isNew).toBe(true);

      await repo.delete('prod-10', 'burger-craft');
      expect(await repo.findById('prod-10', 'burger-craft')).toBeNull();
    });
  });

  describe('SupabaseOrderRepository', () => {
    it('saves and retrieves order with correct domain calculation', async () => {
      const repo = new SupabaseOrderRepository(mockSupabaseClient as unknown as SupabaseClient);

      const order = new Order(
        'order-supabase-1',
        'burger-craft',
        'cust-10',
        [{ productId: 'prod-10', productName: 'Truffle Burger', unitPrice: 32000, quantity: 2, additions: [{ additionId: 'add-1', additionName: 'Extra Truffle', unitPrice: 0, quantity: 1 }] }],
        'pending',
        new Date('2026-08-28T12:00:00Z'),
        5000
      );

      await repo.save(order);

      const retrieved = await repo.findById('order-supabase-1', 'burger-craft');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('order-supabase-1');
      expect(retrieved?.restaurantId).toBe('burger-craft');
      expect(retrieved?.customerId).toBe('cust-10');
      expect(retrieved?.subtotal).toBe(64000);
      expect(retrieved?.deliveryFee).toBe(5000);
      expect(retrieved?.total).toBe(69000);
      expect(retrieved?.status).toBe('pending');

      const all = await repo.findByRestaurantId('burger-craft');
      expect(all.length).toBe(1);

      // Foreign tenant isolation
      const foreign = await repo.findById('order-supabase-1', 'other-tenant');
      expect(foreign).toBeNull();
    });
  });

  describe('SupabaseCustomerRepository', () => {
    it('saves and retrieves customer buyer profile with strict tenant isolation', async () => {
      const repo = new SupabaseCustomerRepository(mockSupabaseClient as unknown as SupabaseClient);

      const customer = new Customer(
        'cust-sb-1',
        'burger-craft',
        'Camila Rivas',
        '+573001112233',
        'Calle 100 # 19-20',
        'Usaquén',
        'Dejar en recepción',
        'camila@example.com'
      );

      await repo.save(customer);

      const retrieved = await repo.findById('cust-sb-1', 'burger-craft');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.restaurantId).toBe('burger-craft');
      expect(retrieved?.name).toBe('Camila Rivas');
      expect(retrieved?.phone).toBe('+573001112233');
      expect(retrieved?.address).toBe('Calle 100 # 19-20');
      expect(retrieved?.barrio).toBe('Usaquén');
      expect(retrieved?.notes).toBe('Dejar en recepción');
      expect(retrieved?.email).toBe('camila@example.com');

      // Tenant isolation: foreign tenant lookup returns null
      const foreign = await repo.findById('cust-sb-1', 'other-tenant');
      expect(foreign).toBeNull();

      const all = await repo.findByRestaurantId('burger-craft');
      expect(all.length).toBe(1);
    });
  });

  describe('SupabaseInventoryRepository', () => {
    it('saves and updates inventory stock item with strict tenant isolation', async () => {
      const repo = new SupabaseInventoryRepository(mockSupabaseClient as unknown as SupabaseClient);

      const inventory: Inventory = {
        id: 'inv-truffle-sauce',
        restaurantId: 'burger-craft',
        name: 'Truffle Aioli Sauce',
        category: 'ingredients',
        quantity: 35,
        unit: 'litros',
        alertThreshold: 5,
        minStockAlert: 5,
        costPerUnit: 8500
      };

      await repo.save(inventory);

      const retrieved = await repo.findById('inv-truffle-sauce', 'burger-craft');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.restaurantId).toBe('burger-craft');
      expect(retrieved?.name).toBe('Truffle Aioli Sauce');
      expect(retrieved?.category).toBe('ingredients');
      expect(retrieved?.quantity).toBe(35);
      expect(retrieved?.alertThreshold).toBe(5);
      expect(retrieved?.minStockAlert).toBe(5);
      expect(retrieved?.costPerUnit).toBe(8500);

      // Foreign tenant returns null
      const foreign = await repo.findById('inv-truffle-sauce', 'other-tenant');
      expect(foreign).toBeNull();

      const all = await repo.findByRestaurantId('burger-craft');
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
