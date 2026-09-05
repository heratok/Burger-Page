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
      findAll: vi.fn(),
      save: vi.fn(),
    };

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

  it('should ignore client-provided delivery fee and enforce official restaurant delivery fee', async () => {
    const mockProduct = { id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: 'Desc', restaurantId: 'burger-craft' };
    vi.mocked(mockProductRepo.findById).mockResolvedValue(mockProduct as any);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
      deliveryFee: 0 // Client attempts to send $0 delivery fee
    });

    expect(order.deliveryFee).toBe(5); // Official restaurant delivery fee is $5
    expect(order.finalTotal).toBe(25); // 20 + 5
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
});
