import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'better-sqlite3';
import { createSqliteDatabase } from '../../src/infrastructure/persistence/sqlite/SqliteDatabase.js';
import { SqliteProductRepository } from '../../src/infrastructure/persistence/sqlite/SqliteProductRepository.js';
import { SqliteOrderRepository } from '../../src/infrastructure/persistence/sqlite/SqliteOrderRepository.js';
import { SqliteCustomerRepository } from '../../src/infrastructure/persistence/sqlite/SqliteCustomerRepository.js';
import { SqliteInventoryRepository } from '../../src/infrastructure/persistence/sqlite/SqliteInventoryRepository.js';
import { Product } from '../../src/domain/models/Product.js';
import { Order } from '../../src/domain/models/Order.js';
import { Customer } from '../../src/domain/models/Customer.js';

describe('SQLite Persistence Adapter Suite (TDD)', () => {
  let db: Database;
  let productRepo: SqliteProductRepository;
  let orderRepo: SqliteOrderRepository;
  let customerRepo: SqliteCustomerRepository;
  let inventoryRepo: SqliteInventoryRepository;

  beforeEach(() => {
    db = createSqliteDatabase(':memory:');
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
});
