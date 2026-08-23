import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOrderUseCase } from '../../src/application/use-cases/CreateOrderUseCase.js';
import { OrderRepository } from '../../src/domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../src/domain/ports/out/ProductRepository.js';
import { CustomerRepository } from '../../src/domain/ports/out/CustomerRepository.js';
import { EntityNotFoundError } from '../../src/domain/errors/DomainErrors.js';
import { Customer } from '../../src/domain/models/Customer.js';

describe('CreateOrderUseCase', () => {
  let mockOrderRepo: OrderRepository;
  let mockProductRepo: ProductRepository;
  let mockCustomerRepo: CustomerRepository;
  let useCase: CreateOrderUseCase;

  beforeEach(() => {
    mockOrderRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
    };

    mockProductRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockCustomerRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
    };

    useCase = new CreateOrderUseCase(mockOrderRepo, mockProductRepo, mockCustomerRepo);
  });

  it('should create an order successfully and update customer spend', async () => {
    const mockProduct1 = { id: 'p1', name: 'Burger', price: 10, isAvailable: true, additions: [], category: 'Food', description: 'Desc' };
    const mockProduct2 = { id: 'p2', name: 'Fries', price: 5, isAvailable: true, additions: [], category: 'Food', description: 'Desc' };
    
    vi.mocked(mockProductRepo.findById).mockImplementation(async (id: string) => {
      if (id === 'p1') return mockProduct1;
      if (id === 'p2') return mockProduct2;
      return null;
    });

    const mockCustomer = new Customer('c1', 'John', 'john@example.com', '123456');
    vi.mocked(mockCustomerRepo.findById).mockResolvedValue(mockCustomer);

    const result = await useCase.execute({
      customerId: 'c1',
      items: [
        { productId: 'p1', quantity: 2, additions: [] },
        { productId: 'p2', quantity: 1, additions: [] }
      ],
      deliveryFee: 5
    });

    // 2*10 + 1*5 + 5 = 30
    expect(result.id).toBeDefined();
    expect(result.customerId).toBe('c1');
    expect(result.status).toBe('pending');
    expect(result.total).toBe(30);

    expect(mockOrderRepo.save).toHaveBeenCalledWith(result);
    expect(mockCustomer.totalSpend).toBe(30);
    expect(mockCustomer.totalOrders).toBe(1);
    expect(mockCustomerRepo.save).toHaveBeenCalledWith(mockCustomer);
  });

  it('should throw EntityNotFoundError if a product is not found', async () => {
    vi.mocked(mockProductRepo.findById).mockResolvedValue(null);

    await expect(useCase.execute({
      customerId: 'c1',
      items: [{ productId: 'nonexistent', quantity: 1, additions: [] }]
    })).rejects.toThrow(EntityNotFoundError);
  });
});
