import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOrderUseCase } from '../../src/application/use-cases/CreateOrderUseCase.js';
import { OrderRepository } from '../../src/domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../src/domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../src/domain/ports/out/ProductAdditionRepository.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import { CustomerRepository } from '../../src/domain/ports/out/CustomerRepository.js';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/DomainErrors.js';
import { Customer } from '../../src/domain/models/Customer.js';
import { Restaurant } from '../../src/domain/models/Restaurant.js';
import { ProductAddition } from '../../src/domain/models/ProductAddition.js';

describe('CreateOrderUseCase', () => {
  let mockOrderRepo: OrderRepository;
  let mockProductRepo: ProductRepository;
  let mockRestaurantRepo: RestaurantRepository;
  let mockAdditionRepo: ProductAdditionRepository;
  let mockCustomerRepo: CustomerRepository;
  let useCase: CreateOrderUseCase;

  const mockRestaurant: any = {
    id: 'burger-craft',
    slug: 'burger-craft',
    name: 'Burger Craft',
    tagline: 'Tasty burgers',
    primaryColor: '#ff5722',
    isActive: true,
    deliveryFee: 5,
    minOrderAmount: 15,
  };

  beforeEach(() => {
    mockOrderRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      save: vi.fn(),
      updateStatus: vi.fn(),
    };

    mockProductRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn().mockResolvedValue([]),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockRestaurantRepo = {
      findById: vi.fn().mockResolvedValue(mockRestaurant),
      findBySlug: vi.fn().mockResolvedValue(mockRestaurant),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockAdditionRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      findByProductId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockCustomerRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      findByPhone: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as any;

    useCase = new CreateOrderUseCase(
      mockOrderRepo,
      mockProductRepo,
      mockRestaurantRepo,
      mockAdditionRepo,
      mockCustomerRepo
    );
  });

  it('should create an order successfully with authoritative prices and additions', async () => {
    const mockProduct1 = { id: 'p1', name: 'Burger', price: 10, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    const mockProduct2 = { id: 'p2', name: 'Fries', price: 5, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    const mockAddition = new ProductAddition('add-cheese', 'burger-craft', 'Extra Cheese', 2, true);

    vi.mocked(mockProductRepo.findById).mockImplementation(async (id: string) => {
      if (id === 'p1') return mockProduct1 as any;
      if (id === 'p2') return mockProduct2 as any;
      return null;
    });

    vi.mocked(mockAdditionRepo.findById).mockResolvedValue(mockAddition);

    const mockCustomer = new Customer('c1', 'burger-craft', 'John', '123456');
    vi.mocked(mockCustomerRepo.findById).mockResolvedValue(mockCustomer);

    const result = await useCase.execute({
      restaurantId: 'burger-craft',
      customerId: 'c1',
      items: [
        { productId: 'p1', quantity: 2, additions: [{ additionId: 'add-cheese', quantity: 1 }] },
        { productId: 'p2', quantity: 1, additions: [] }
      ],
      paymentMethod: 'Efectivo',
      paymentAmount: 40,
    });

    // Subtotal: 2 * (10 + 2) + 1 * 5 = 24 + 5 = 29
    // FinalTotal: 29 + 5 (deliveryFee) = 34
    // ChangeAmount: 40 - 34 = 6
    expect(result.id).toBeDefined();
    expect(result.restaurantId).toBe('burger-craft');
    expect(result.customerId).toBe('c1');
    expect(result.status).toBe('pending');
    expect(result.subtotal).toBe(29);
    expect(result.finalTotal).toBe(34);
    expect(result.paymentAmount).toBe(40);
    expect(result.changeAmount).toBe(6);

    expect(mockOrderRepo.save).toHaveBeenCalledWith(result);
  });

  it('should reject order if subtotal is below minOrderAmount', async () => {
    const mockProduct = { id: 'p2', name: 'Fries', price: 5, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    await expect(useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p2', quantity: 1, additions: [] }] // Subtotal = 5 < 15
    })).rejects.toThrow(ValidationError);
  });

  it('should throw EntityNotFoundError if a product is not found', async () => {
    vi.mocked(mockProductRepo.findById).mockResolvedValue(null);

    await expect(useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'non-existent', quantity: 1, additions: [] }]
    })).rejects.toThrow(EntityNotFoundError);
  });

  it('should reject if product belongs to another tenant', async () => {
    const foreignProduct = { id: 'p-foreign', name: 'Other Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'other-restaurant' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(foreignProduct as any);

    await expect(useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p-foreign', quantity: 1, additions: [] }]
    })).rejects.toThrow(ValidationError);
  });

  it('should reject if addition belongs to another tenant', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    const foreignAddition = new ProductAddition('add-foreign', 'other-restaurant', 'Foreign Sauce', 3, true);

    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);
    vi.mocked(mockAdditionRepo.findById).mockResolvedValue(foreignAddition);

    await expect(useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [{ additionId: 'add-foreign', quantity: 1 }] }]
    })).rejects.toThrow(ValidationError);
  });

  it('should reject if customer belongs to another tenant', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    const foreignCustomer = new Customer('c-foreign', 'other-restaurant', 'Foreign User', '123');

    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);
    vi.mocked(mockCustomerRepo.findById).mockResolvedValue(foreignCustomer);

    await expect(useCase.execute({
      restaurantId: 'burger-craft',
      customerId: 'c-foreign',
      items: [{ productId: 'p1', quantity: 1, additions: [] }]
    })).rejects.toThrow(ValidationError);
  });

  it('should honor a valid client-provided delivery fee of 0 for counter sales (JD-CRIT-02)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute(
      {
        restaurantId: 'burger-craft',
        items: [{ productId: 'p1', quantity: 1, additions: [] }],
        deliveryFee: 0, // Counter sale waives the $5 restaurant delivery fee
      },
      { authenticated: true } // counter/table POS is an authenticated staff session
    );

    expect(order.deliveryFee).toBe(0); // Client fee honored
    expect(order.finalTotal).toBe(20); // 20 + 0 (no inflated restaurant fee)
  });

  it('should fall back to the restaurant delivery fee when the client omits it (JD-CRIT-02)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }]
    });

    expect(order.deliveryFee).toBe(5); // Restaurant fee as fallback
    expect(order.finalTotal).toBe(25); // 20 + 5
  });

  it('should fall back to the restaurant delivery fee when the client fee is negative (JD-CRIT-02)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      deliveryFee: -100 // Invalid: must never reach the payment validation
    });

    expect(order.deliveryFee).toBe(5);
    expect(order.finalTotal).toBe(25);
  });

  it('enforces the restaurant delivery fee for anonymous orders, ignoring deliveryFee: 0 (SUS-12)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      deliveryFee: 0, // anonymous visitor attempts the fee bypass
    });

    expect(order.deliveryFee).toBe(5); // restaurant's configured fee enforced
    expect(order.finalTotal).toBe(25); // 20 + 5
  });

  it('honors the client delivery fee of 0 for an authenticated POS session (SUS-12 waiver preserved)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute(
      {
        restaurantId: 'burger-craft',
        items: [{ productId: 'p1', quantity: 1, additions: [] }],
        deliveryFee: 0, // counter/table POS waives the fee
      },
      { authenticated: true }
    );

    expect(order.deliveryFee).toBe(0); // waiver preserved for staff sessions
    expect(order.finalTotal).toBe(20);
  });

  it('ignores an anonymous client delivery fee different from the configured fee (SUS-12)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      deliveryFee: 7, // anonymous visitor sends a fee different from the configured 5
    });

    expect(order.deliveryFee).toBe(5); // configured fee wins for anonymous
    expect(order.finalTotal).toBe(25);
  });

  it('should accept a mostrador cash payment equal to the subtotal when delivery fee is 0 (JD-CRIT-02)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute(
      {
        restaurantId: 'burger-craft',
        items: [{ productId: 'p1', quantity: 1, additions: [] }],
        deliveryFee: 0,
        paymentMethod: 'Efectivo',
        paymentAmount: 20, // == subtotal == finalTotal (fee waived)
      },
      { authenticated: true }
    );

    expect(order.deliveryFee).toBe(0);
    expect(order.subtotal).toBe(20);
    expect(order.finalTotal).toBe(20);
    expect(order.paymentAmount).toBe(20);
    expect(order.changeAmount).toBe(0); // exact payment, no change owed
  });

  it('should reject a cash payment below the corrected final total (JD-CRIT-02)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    await expect(useCase.execute(
      {
        restaurantId: 'burger-craft',
        items: [{ productId: 'p1', quantity: 1, additions: [] }],
        deliveryFee: 0,
        paymentMethod: 'Efectivo',
        paymentAmount: 19,
      },
      { authenticated: true }
    )).rejects.toThrow(ValidationError);
  });

  it('should apply minOrderAmount including additions in subtotal calculation', async () => {
    const mockProduct = { id: 'p1', name: 'Small Burger', price: 10, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    const mockAddition = new ProductAddition('add-patty', 'burger-craft', 'Extra Patty', 6, true);

    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);
    vi.mocked(mockAdditionRepo.findById).mockResolvedValue(mockAddition);

    // minOrderAmount is 15.
    // Product (10) + Addition (6) = 16 >= 15 -> should pass!
    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [{ additionId: 'add-patty', quantity: 1 }] }]
    });

    expect(order.subtotal).toBe(16);
    expect(order.finalTotal).toBe(21); // 16 + 5
  });

  it('throws ValidationError when restaurantId is missing', async () => {
    await expect(
      useCase.execute({
        restaurantId: '',
        items: [{ productId: 'p1', quantity: 1, additions: [] }],
      })
    ).rejects.toThrow(ValidationError);
  });

  it('throws EntityNotFoundError when restaurant does not exist', async () => {
    vi.mocked(mockRestaurantRepo.findById).mockResolvedValue(null);
    vi.mocked(mockRestaurantRepo.findBySlug).mockResolvedValue(null);

    await expect(
      useCase.execute({
        restaurantId: 'non-existent-rest',
        items: [{ productId: 'p1', quantity: 1, additions: [] }],
      })
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws ValidationError when restaurant is inactive', async () => {
    vi.mocked(mockRestaurantRepo.findById).mockResolvedValue({
      ...mockRestaurant,
      isActive: false,
    });

    await expect(
      useCase.execute({
        restaurantId: 'burger-craft',
        items: [{ productId: 'p1', quantity: 1, additions: [] }],
      })
    ).rejects.toThrow(ValidationError);
  });

  it('calculates cash changeAmount when paymentAmount is provided', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      paymentMethod: 'Efectivo',
      paymentAmount: 50,
    });

    expect(order.paymentAmount).toBe(50);
    expect(order.changeAmount).toBe(25); // 50 - 25
  });

  it('updates existing customer when phone matches and customerId is not provided', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const existingCustomer = new Customer(
      'cust-existing-1',
      'burger-craft',
      'Old Name',
      '1234567890',
      'Old Address',
      'Old Barrio',
      '',
      'old@example.com',
      '2026-01-01',
      '2026-01-01'
    );
    vi.mocked(mockCustomerRepo.findByPhone).mockResolvedValue(existingCustomer);

    const order = await useCase.execute(
      {
        restaurantId: 'burger-craft',
        items: [{ productId: 'p1', quantity: 1, additions: [] }],
        customer: {
          name: 'New Name',
          phone: '1234567890',
          address: 'New Street 123',
          barrio: 'New Barrio',
        },
      },
      { authenticated: true } // staff POS may update a matched CRM profile
    );

    expect(order.customerId).toBe('cust-existing-1');
    expect(existingCustomer.name).toBe('New Name');
    expect(existingCustomer.address).toBe('New Street 123');
    expect(mockCustomerRepo.save).toHaveBeenCalledWith(existingCustomer);
  });

  it('creates and saves new customer when phone is not found and customerId is not provided', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);
    vi.mocked(mockCustomerRepo.findByPhone).mockResolvedValue(null);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      customer: {
        name: 'Brand New Customer',
        phone: '9876543210',
        address: 'Sunset Blvd 456',
        barrio: 'West',
      },
    });

    expect(order.customerId).toBeDefined();
    expect(order.customerId).toMatch(/^cust_/);
    expect(mockCustomerRepo.save).toHaveBeenCalled();
  });

  it('does not overwrite an existing CRM profile from anonymous order input (SUS-15)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const existingCustomer = new Customer(
      'cust-existing-2',
      'burger-craft',
      'Old Name',
      '1234567890',
      'Old Address',
      'Old Barrio',
      '',
      'old@example.com',
      '2026-01-01',
      '2026-01-01'
    );
    vi.mocked(mockCustomerRepo.findByPhone).mockResolvedValue(existingCustomer);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      customer: {
        name: 'Attacker Name',
        phone: '1234567890',
        address: 'Hacker Address',
        barrio: 'Bad Barrio',
      },
    });

    expect(order.customerId).toBe('cust-existing-2'); // order reuses the stored profile
    expect(existingCustomer.name).toBe('Old Name'); // profile not mutated
    expect(existingCustomer.address).toBe('Old Address');
    expect(existingCustomer.barrio).toBe('Old Barrio');
    expect(existingCustomer.updatedAt).toBe('2026-01-01');
    expect(mockCustomerRepo.save).not.toHaveBeenCalled(); // no mutation write
  });

  it('gracefully creates order even if customer resolution fails', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);
    vi.mocked(mockCustomerRepo.findByPhone).mockRejectedValue(new Error('DB failure'));

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      customer: {
        name: 'Customer DB Error',
        phone: '5551234567',
      },
    });

    expect(order.customerId).toBeUndefined();
    expect(order.id).toBeDefined();
  });

  it('threads the client clientOrderId into the persisted order (SUS-19)', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      clientOrderId: 'cli-attempt-1',
    });

    expect(order.clientOrderId).toBe('cli-attempt-1');
    const saved = vi.mocked(mockOrderRepo.save).mock.calls[0][0];
    expect(saved.clientOrderId).toBe('cli-attempt-1');
  });

  it('returns the originally persisted id on replay of the same clientOrderId (SUS-19, in-memory)', async () => {
    const { InMemoryOrderRepository } = await import('../../src/infrastructure/persistence/InMemoryOrderRepository.js');
    const inMemoryRepo = new InMemoryOrderRepository();
    const inMemoryUseCase = new CreateOrderUseCase(
      inMemoryRepo,
      mockProductRepo,
      mockRestaurantRepo,
      mockAdditionRepo,
      mockCustomerRepo
    );
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const dto = {
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      clientOrderId: 'cli-same-attempt',
    };
    const first = await inMemoryUseCase.execute(dto);
    // A lost-response retry re-POSTs the same correlation id: the server must
    // return the SAME persisted identity, never a freshly generated phantom id.
    const replay = await inMemoryUseCase.execute(dto);
    expect(replay.id).toBe(first.id);
  });

  it('replays a save with the same clientOrderId instead of duplicating (SUS-19, in-memory)', async () => {
    const { InMemoryOrderRepository } = await import('../../src/infrastructure/persistence/InMemoryOrderRepository.js');
    const inMemoryRepo = new InMemoryOrderRepository();
    const inMemoryUseCase = new CreateOrderUseCase(
      inMemoryRepo,
      mockProductRepo,
      mockRestaurantRepo,
      mockAdditionRepo,
      mockCustomerRepo
    );
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const dto = {
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      clientOrderId: 'cli-same-attempt',
    };
    const first = await inMemoryUseCase.execute(dto);
    await inMemoryUseCase.execute(dto);
    const all = await inMemoryRepo.findByRestaurantId('burger-craft');
    // The repo seeds its own orders; only orders carrying the correlation id
    // must be deduplicated (SUS-19).
    const correlated = all.filter((o) => (o as any).clientOrderId === 'cli-same-attempt');
    expect(correlated).toHaveLength(1);
    expect(correlated[0].id).toBe(first.id);
  });
});
