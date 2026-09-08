import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateOrderUseCase } from '../../src/application/use-cases/UpdateOrderUseCase.js';
import { OrderRepository } from '../../src/domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../src/domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../src/domain/ports/out/ProductAdditionRepository.js';
import { CustomerRepository } from '../../src/domain/ports/out/CustomerRepository.js';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/DomainErrors.js';
import { Order } from '../../src/domain/models/Order.js';

describe('UpdateOrderUseCase (Unit Tests)', () => {
  let mockOrderRepo: OrderRepository;
  let mockProductRepo: ProductRepository;
  let mockAdditionRepo: ProductAdditionRepository;
  let mockCustomerRepo: CustomerRepository;
  let useCase: UpdateOrderUseCase;

  const createBaseOrder = (): Order => ({
    id: 'ord-123',
    restaurantId: 'rest-burger-craft',
    orderNumber: 101,
    status: 'pending',
    items: [
      {
        id: 'item-1',
        productId: 'prod-burger',
        productName: 'Burger Deluxe',
        unitPrice: 20000,
        quantity: 1,
        additions: [],
      },
    ],
    customer: {
      name: 'Carlos Perez',
      phone: '3001234567',
      address: 'Calle 10 # 5-20',
      barrio: 'Centro',
    },
    subtotal: 20000,
    deliveryFee: 3000,
    finalTotal: 23000,
    total: 23000,
    paymentMethod: 'Efectivo',
    paymentAmount: 30000,
    changeAmount: 7000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    mockOrderRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      save: vi.fn(),
      update: vi.fn().mockImplementation((order) => Promise.resolve(order)),
      updateStatus: vi.fn(),
    };

    mockProductRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn().mockResolvedValue([]),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockAdditionRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn().mockResolvedValue([]),
      findByProductId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockCustomerRepo = {
      findById: vi.fn(),
      findByPhone: vi.fn(),
      findByRestaurantId: vi.fn(),
      save: vi.fn(),
    };

    useCase = new UpdateOrderUseCase(
      mockOrderRepo,
      mockProductRepo,
      mockAdditionRepo,
      mockCustomerRepo
    );
  });

  it('throws ValidationError if restaurantId is missing or empty', async () => {
    await expect(useCase.execute('ord-123', {}, '')).rejects.toThrow(ValidationError);
  });

  it('throws EntityNotFoundError if order is not found under restaurantId or alternative prefix', async () => {
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('ord-999', {}, 'rest-burger-craft')
    ).rejects.toThrow(EntityNotFoundError);
    expect(mockOrderRepo.findById).toHaveBeenCalledWith('ord-999', 'rest-burger-craft');
    expect(mockOrderRepo.findById).toHaveBeenCalledWith('ord-999', 'burger-craft');
  });

  it('resolves order when found under alternative restaurant ID prefix', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);

    const result = await useCase.execute('ord-123', { comment: 'Fast delivery' }, 'burger-craft');

    expect(result).toBeDefined();
    expect((result as any).comment).toBe('Fast delivery');
    expect(mockOrderRepo.update).toHaveBeenCalledWith(expect.anything(), 'rest-burger-craft');
  });

  it('updates metadata fields (deliveryFee, status, paymentMethod, comment, receiptUrl)', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);

    const result = await useCase.execute(
      'ord-123',
      {
        deliveryFee: 5000,
        status: 'confirmed',
        paymentMethod: 'Transferencia',
        comment: 'Sin cebolla por favor',
        receiptUrl: 'https://storage.com/receipt.png',
      },
      'rest-burger-craft'
    );

    expect(result.deliveryFee).toBe(5000);
    expect(result.status).toBe('confirmed');
    expect((result as any).paymentMethod).toBe('Transferencia');
    expect((result as any).comment).toBe('Sin cebolla por favor');
    expect(result.receiptUrl).toBe('https://storage.com/receipt.png');
    expect((result as any).paymentAmount).toBeUndefined();
    expect((result as any).changeAmount).toBeUndefined();
  });

  it('updates customer details and syncs existing customer found by phone', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);
    const existingCust: any = {
      id: 'cust-10',
      name: 'Carlos',
      phone: '3009998877',
      address: 'Calle 1',
    };
    vi.mocked(mockCustomerRepo.findByPhone).mockResolvedValue(existingCust);

    const result = await useCase.execute(
      'ord-123',
      {
        customer: {
          name: 'Carlos Alberto',
          phone: '3009998877',
          address: 'Avenida Siempre Viva 123',
          barrio: 'Springfield',
          email: 'carlos@mail.com',
        },
      },
      'rest-burger-craft'
    );

    expect(result.customer?.name).toBe('Carlos Alberto');
    expect(result.customer?.address).toBe('Avenida Siempre Viva 123');
    expect(mockCustomerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cust-10',
        name: 'Carlos Alberto',
        address: 'Avenida Siempre Viva 123',
      })
    );
  });

  it('updates customer details and syncs customer by customerId if phone does not match', async () => {
    const existing = createBaseOrder();
    (existing as any).customerId = 'cust-existing-id';
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockCustomerRepo.findByPhone).mockResolvedValue(null);
    const existingCustomer: any = {
      id: 'cust-existing-id',
      name: 'Old Name',
      phone: '3001112233',
    };
    vi.mocked(mockCustomerRepo.findById).mockResolvedValue(existingCustomer);

    await useCase.execute(
      'ord-123',
      {
        customer: {
          name: 'Updated Name',
          phone: '3005556677',
          address: 'Nueva Direccion',
        },
      },
      'rest-burger-craft'
    );

    expect(mockCustomerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cust-existing-id',
        name: 'Updated Name',
        phone: '3005556677',
        address: 'Nueva Direccion',
      })
    );
  });

  it('continues smoothly without failing if customerRepo.save throws an error', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockCustomerRepo.findByPhone).mockRejectedValue(new Error('DB Connection Timeout'));

    const result = await useCase.execute(
      'ord-123',
      {
        customer: {
          name: 'Robust Customer',
          phone: '3009999999',
        },
      },
      'rest-burger-craft'
    );

    expect(result.customer?.name).toBe('Robust Customer');
  });

  it('throws ValidationError when updating with invalid item quantity (<= 0)', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);

    await expect(
      useCase.execute(
        'ord-123',
        {
          items: [{ productId: 'prod-burger', quantity: 0 }],
        },
        'rest-burger-craft'
      )
    ).rejects.toThrow(ValidationError);
  });

  it('updates items and resolves product by productRepo findById', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockProductRepo.findById).mockResolvedValue({
      id: 'prod-fries',
      name: 'Papas Francesas',
      price: 12000,
    } as any);

    const result = await useCase.execute(
      'ord-123',
      {
        items: [
          {
            productId: 'prod-fries',
            quantity: 2,
            observation: 'Bien crujientes',
          },
        ],
      },
      'rest-burger-craft'
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].productId).toBe('prod-fries');
    expect(result.items[0].productName).toBe('Papas Francesas');
    expect(result.items[0].unitPrice).toBe(12000);
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[0].observation).toBe('Bien crujientes');
  });

  it('resolves product by name in allProducts list when findById returns null', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockProductRepo.findById).mockResolvedValue(null);
    vi.mocked(mockProductRepo.findByRestaurantId).mockResolvedValue([
      { id: 'prod-soda', name: 'Gaseosa 400ml', price: 6000 } as any,
    ]);

    const result = await useCase.execute(
      'ord-123',
      {
        items: [
          {
            productId: 'gaseosa 400ml',
            quantity: 3,
          },
        ],
      },
      'rest-burger-craft'
    );

    expect(result.items[0].productId).toBe('prod-soda');
    expect(result.items[0].unitPrice).toBe(6000);
  });

  it('resolves product from existing order item when neither findById nor findByRestaurantId matches', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockProductRepo.findById).mockResolvedValue(null);
    vi.mocked(mockProductRepo.findByRestaurantId).mockResolvedValue([]);

    const result = await useCase.execute(
      'ord-123',
      {
        items: [
          {
            productId: 'Burger Deluxe',
            quantity: 1,
            unitPrice: 20000,
          } as any,
        ],
      },
      'rest-burger-craft'
    );

    expect(result.items[0].productId).toBe('prod-burger');
    expect(result.items[0].unitPrice).toBe(20000);
  });

  it('validates and resolves additions from additionRepo, additions list and raw fallback', async () => {
    const existing = createBaseOrder();
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockProductRepo.findById).mockResolvedValue({
      id: 'prod-burger',
      name: 'Burger Deluxe',
      price: 20000,
    } as any);

    vi.mocked(mockAdditionRepo.findById).mockResolvedValueOnce({
      id: 'add-bacon',
      name: 'Tocineta Extra',
      price: 4000,
    } as any);

    vi.mocked(mockAdditionRepo.findById).mockResolvedValueOnce(null);
    vi.mocked(mockAdditionRepo.findByRestaurantId).mockResolvedValue([
      { id: 'add-cheese', name: 'Queso Cheddar', price: 3000 } as any,
    ]);

    const result = await useCase.execute(
      'ord-123',
      {
        items: [
          {
            productId: 'prod-burger',
            quantity: 1,
            additions: [
              'add-bacon',
              { additionId: 'add-cheese', quantity: 2 },
              { additionId: 'custom-add', additionName: 'Salsa Especial', unitPrice: 1500, quantity: 1 } as any,
            ],
          },
        ],
      },
      'rest-burger-craft'
    );

    expect(result.items[0].additions).toHaveLength(3);
    expect(result.items[0].additions[0].additionName).toBe('Tocineta Extra');
    expect(result.items[0].additions[0].unitPrice).toBe(4000);
    expect(result.items[0].additions[1].additionName).toBe('Queso Cheddar');
    expect(result.items[0].additions[1].unitPrice).toBe(3000);
    expect(result.items[0].additions[2].additionName).toBe('Salsa Especial');
    expect(result.items[0].additions[2].unitPrice).toBe(1500);
  });

  it('correctly recalculates cash changeAmount when paymentAmount is provided', async () => {
    const existing = createBaseOrder();
    existing.finalTotal = 35000;
    existing.paymentMethod = 'Efectivo';
    vi.mocked(mockOrderRepo.findById).mockResolvedValue(existing);

    const result = await useCase.execute(
      'ord-123',
      {
        paymentAmount: 50000,
      },
      'rest-burger-craft'
    );

    expect((result as any).paymentAmount).toBe(50000);
    expect((result as any).changeAmount).toBe(15000);
  });
});
