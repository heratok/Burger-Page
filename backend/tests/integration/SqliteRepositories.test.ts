import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'better-sqlite3';
import { createSqliteDatabase } from '../../src/infrastructure/persistence/sqlite/SqliteDatabase.js';
import { SqliteProductRepository } from '../../src/infrastructure/persistence/sqlite/SqliteProductRepository.js';
import { SqliteOrderRepository } from '../../src/infrastructure/persistence/sqlite/SqliteOrderRepository.js';
import { SqliteCustomerRepository } from '../../src/infrastructure/persistence/sqlite/SqliteCustomerRepository.js';
import { SqliteInventoryRepository } from '../../src/infrastructure/persistence/sqlite/SqliteInventoryRepository.js';
import { SqliteRestaurantRepository } from '../../src/infrastructure/persistence/sqlite/SqliteRestaurantRepository.js';
import { Product } from '../../src/domain/models/Product.js';
import { Order } from '../../src/domain/models/Order.js';
import { Customer } from '../../src/domain/models/Customer.js';
import { Restaurant } from '../../src/domain/models/Restaurant.js';
import { buildDependencies } from '../../src/infrastructure/http/app.js';

let hasSqliteBinding = false;
try {
  const testDb = createSqliteDatabase(':memory:');
  testDb.close();
  hasSqliteBinding = true;
} catch {
  hasSqliteBinding = false;
}

describe.skipIf(!hasSqliteBinding)('SQLite Persistence Adapter Suite (TDD)', () => {
  let db: Database;
  let restaurantRepo: SqliteRestaurantRepository;
  let productRepo: SqliteProductRepository;
  let orderRepo: SqliteOrderRepository;
  let customerRepo: SqliteCustomerRepository;
  let inventoryRepo: SqliteInventoryRepository;

  beforeEach(() => {
    db = createSqliteDatabase(':memory:');
    restaurantRepo = new SqliteRestaurantRepository(db);
    productRepo = new SqliteProductRepository(db);
    orderRepo = new SqliteOrderRepository(db);
    customerRepo = new SqliteCustomerRepository(db);
    inventoryRepo = new SqliteInventoryRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should save and retrieve products from SQLite', async () => {
    const product: Product = {
      id: 'p-100',
      name: 'Artisan BBQ Burger',
      description: 'Smoked bacon with homemade BBQ sauce',
      price: 29000,
      category: 'Especiales',
      isAvailable: true,
      additions: ['Extra Bacon', 'Cheddar'],
    };

    await productRepo.save(product);
    const retrieved = await productRepo.findById('p-100');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Artisan BBQ Burger');
    expect(retrieved?.price).toBe(29000);
    expect(retrieved?.additions).toEqual(['Extra Bacon', 'Cheddar']);

    const all = await productRepo.findAll();
    expect(all.length).toBe(1);

    await productRepo.delete('p-100');
    expect(await productRepo.findById('p-100')).toBeNull();
  });

  it('should save, update and list orders from SQLite', async () => {
    const order = new Order(
      'ord-999',
      'cust-501',
      [{ productId: 'p-100', quantity: 2, price: 25000, additions: [] }],
      'pending',
      new Date(),
      4500
    );

    await orderRepo.save(order);
    const retrieved = await orderRepo.findById('ord-999');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('ord-999');
    expect(retrieved?.status).toBe('pending');
    expect(retrieved?.total).toBe(54500);

    // State transition
    retrieved?.transitionTo('cooking');
    await orderRepo.save(retrieved!);

    const updated = await orderRepo.findById('ord-999');
    expect(updated?.status).toBe('cooking');
  });

  it('should track customer spend and loyalty tiers in SQLite', async () => {
    const customer = new Customer('cust-777', 'Laura Gómez', 'laura@test.com', '3151234567');
    customer.addOrderSpend(350000);

    await customerRepo.save(customer);
    const retrieved = await customerRepo.findById('cust-777');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Laura Gómez');
    expect(retrieved?.email).toBe('laura@test.com');
    expect(retrieved?.phone).toBe('3151234567');
    expect(retrieved?.totalSpend).toBe(350000);
    expect(retrieved?.loyaltyTier).toBe('Gold');

    const allCustomers = await customerRepo.findAll();
    expect(allCustomers.length).toBe(1);
    expect(allCustomers[0].email).toBe('laura@test.com');
    expect(allCustomers[0].phone).toBe('3151234567');
  });

  it('should manage inventory items and stock changes in SQLite', async () => {
    await inventoryRepo.save({
      id: 'inv-pan-brioche',
      name: 'Pan Brioche Sellado',
      quantity: 50,
      unit: 'unidades',
      alertThreshold: 15
    });

    const item = await inventoryRepo.findById('inv-pan-brioche');
    expect(item).not.toBeNull();
    expect(item?.quantity).toBe(50);
  });

  it('should support multi-tenant restaurants with distinct slugs and isolated updates', async () => {
    const restaurant1: Restaurant = {
      id: 'rest-burger',
      name: 'Burger Craft',
      slug: 'burger-craft',
      theme: 'dark-charcoal',
      openingHours: { open: '10:00', close: '22:00' },
      isActive: true,
    };

    const restaurant2: Restaurant = {
      id: 'rest-tacos',
      name: 'Tacos El Rey',
      slug: 'tacos-el-rey',
      theme: 'fiesta-red',
      openingHours: { open: '11:00', close: '23:00' },
      isActive: true,
    };

    await restaurantRepo.save(restaurant1);
    await restaurantRepo.save(restaurant2);

    // Verify both exist and can be retrieved by id
    const retrievedById1 = await restaurantRepo.findById('rest-burger');
    const retrievedById2 = await restaurantRepo.findById('rest-tacos');

    expect(retrievedById1).not.toBeNull();
    expect(retrievedById1?.id).toBe('rest-burger');
    expect(retrievedById1?.slug).toBe('burger-craft');
    expect(retrievedById1?.name).toBe('Burger Craft');
    expect(retrievedById1?.theme).toBe('dark-charcoal');
    expect(retrievedById1?.openingHours).toEqual({ open: '10:00', close: '22:00' });

    expect(retrievedById2).not.toBeNull();
    expect(retrievedById2?.id).toBe('rest-tacos');
    expect(retrievedById2?.slug).toBe('tacos-el-rey');
    expect(retrievedById2?.name).toBe('Tacos El Rey');
    expect(retrievedById2?.theme).toBe('fiesta-red');
    expect(retrievedById2?.openingHours).toEqual({ open: '11:00', close: '23:00' });

    // Verify both can be retrieved by slug
    const retrievedBySlug1 = await restaurantRepo.findBySlug('burger-craft');
    const retrievedBySlug2 = await restaurantRepo.findBySlug('tacos-el-rey');

    expect(retrievedBySlug1).not.toBeNull();
    expect(retrievedBySlug1?.id).toBe('rest-burger');
    expect(retrievedBySlug1?.slug).toBe('burger-craft');
    expect(retrievedBySlug1?.name).toBe('Burger Craft');

    expect(retrievedBySlug2).not.toBeNull();
    expect(retrievedBySlug2?.id).toBe('rest-tacos');
    expect(retrievedBySlug2?.slug).toBe('tacos-el-rey');
    expect(retrievedBySlug2?.name).toBe('Tacos El Rey');

    // Verify updating one does not conflict with or affect the other
    const updated1: Restaurant = {
      ...restaurant1,
      name: 'Burger Craft Artisanal',
      theme: 'midnight-gold',
      openingHours: { open: '12:00', close: '23:30' },
    };

    await restaurantRepo.save(updated1);

    const refreshed1 = await restaurantRepo.findById('rest-burger');
    const refreshedSlug1 = await restaurantRepo.findBySlug('burger-craft');
    const refreshed2 = await restaurantRepo.findById('rest-tacos');
    const refreshedSlug2 = await restaurantRepo.findBySlug('tacos-el-rey');

    // Tenant 1 updated properly
    expect(refreshed1?.name).toBe('Burger Craft Artisanal');
    expect(refreshed1?.theme).toBe('midnight-gold');
    expect(refreshed1?.openingHours).toEqual({ open: '12:00', close: '23:30' });
    expect(refreshedSlug1?.name).toBe('Burger Craft Artisanal');

    // Tenant 2 untouched and uncorrupted
    expect(refreshed2?.name).toBe('Tacos El Rey');
    expect(refreshed2?.slug).toBe('tacos-el-rey');
    expect(refreshed2?.theme).toBe('fiesta-red');
    expect(refreshed2?.openingHours).toEqual({ open: '11:00', close: '23:00' });
    expect(refreshedSlug2?.name).toBe('Tacos El Rey');
  });

  it('should derive slug from restaurant name when slug is omitted', async () => {
    const restaurantWithoutSlug: Restaurant = {
      id: 'rest-pizza',
      name: 'Pizza Di Napoli',
      theme: 'italian-green',
      openingHours: { open: '12:00', close: '23:00' },
      isActive: true,
    };

    await restaurantRepo.save(restaurantWithoutSlug);

    const retrieved = await restaurantRepo.findBySlug('pizza-di-napoli');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('rest-pizza');
    expect(retrieved?.slug).toBe('pizza-di-napoli');
    expect(retrieved?.name).toBe('Pizza Di Napoli');
  });

  it('should return null for non-existent restaurant id or slug', async () => {
    expect(await restaurantRepo.findById('non-existent')).toBeNull();
    expect(await restaurantRepo.findBySlug('non-existent-slug')).toBeNull();
  });

  it('should build dependencies with sqlite or memory storage driver', () => {
    const sqliteDeps = buildDependencies(':memory:', 'sqlite');
    expect(sqliteDeps).toBeDefined();
    expect(sqliteDeps.restaurantController).toBeDefined();
    expect(sqliteDeps.productController).toBeDefined();
    expect(sqliteDeps.orderController).toBeDefined();
    expect(sqliteDeps.customerController).toBeDefined();
    expect(sqliteDeps.inventoryController).toBeDefined();

    const memoryDeps = buildDependencies(undefined, 'memory');
    expect(memoryDeps).toBeDefined();
    expect(memoryDeps.restaurantController).toBeDefined();
    expect(memoryDeps.productController).toBeDefined();
    expect(memoryDeps.orderController).toBeDefined();
    expect(memoryDeps.customerController).toBeDefined();
    expect(memoryDeps.inventoryController).toBeDefined();
  });
});
