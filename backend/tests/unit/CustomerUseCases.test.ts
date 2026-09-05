import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListCustomersUseCase } from '../../src/application/use-cases/ListCustomersUseCase.js';
import { GetCustomerByIdUseCase } from '../../src/application/use-cases/GetCustomerByIdUseCase.js';
import { CreateCustomerUseCase } from '../../src/application/use-cases/CreateCustomerUseCase.js';
import { UpdateCustomerUseCase } from '../../src/application/use-cases/UpdateCustomerUseCase.js';
import { DeleteCustomerUseCase } from '../../src/application/use-cases/DeleteCustomerUseCase.js';
import { CustomerRepository } from '../../src/domain/ports/out/CustomerRepository.js';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/DomainErrors.js';
import { Customer } from '../../src/domain/models/Customer.js';

describe('Customer Use Cases (Unit)', () => {
  let mockCustomerRepo: CustomerRepository;

  beforeEach(() => {
    mockCustomerRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      findByPhone: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
  });

  describe('CreateCustomerUseCase', () => {
    it('should create a buyer profile with name, phone, address, barrio, notes and optional email', async () => {
      const useCase = new CreateCustomerUseCase(mockCustomerRepo);
      vi.mocked(mockCustomerRepo.findByPhone).mockResolvedValue(null);

      const customer = await useCase.execute({
        name: 'Andrés Morales',
        phone: '+57 310 987 6543',
        address: 'Calle 72 # 10-34 Apto 402',
        barrio: 'Chapinero',
        notes: 'Dejar con el portero don Pedro',
        email: ''
      }, 'burger-craft');

      expect(customer.id).toBeDefined();
      expect(customer.restaurantId).toBe('burger-craft');
      expect(customer.name).toBe('Andrés Morales');
      expect(customer.phone).toBe('+57 310 987 6543');
      expect(customer.address).toBe('Calle 72 # 10-34 Apto 402');
      expect(customer.barrio).toBe('Chapinero');
      expect(customer.notes).toBe('Dejar con el portero don Pedro');
      expect(customer.email).toBe('');
      expect(mockCustomerRepo.save).toHaveBeenCalledWith(customer);
    });

    it('should reject customer creation without restaurantId', async () => {
      const useCase = new CreateCustomerUseCase(mockCustomerRepo);
      await expect(useCase.execute({ name: 'Andrés', phone: '123' }, '')).rejects.toThrow(ValidationError);
    });

    it('should reject customer creation without name or phone', async () => {
      const useCase = new CreateCustomerUseCase(mockCustomerRepo);
      await expect(useCase.execute({ name: '', phone: '123' }, 'burger-craft')).rejects.toThrow(ValidationError);
      await expect(useCase.execute({ name: 'Andrés', phone: '' }, 'burger-craft')).rejects.toThrow(ValidationError);
    });

    it('should update existing customer details when phone matches within the same restaurant', async () => {
      const useCase = new CreateCustomerUseCase(mockCustomerRepo);
      const existing = new Customer('cust-1', 'burger-craft', 'Andrés Antiguo', '123', 'Old Address');
      vi.mocked(mockCustomerRepo.findByPhone).mockResolvedValue(existing);

      const updated = await useCase.execute({
        name: 'Andrés Nuevo',
        phone: '123',
        address: 'New Address'
      }, 'burger-craft');

      expect(updated.id).toBe('cust-1');
      expect(updated.name).toBe('Andrés Nuevo');
      expect(updated.address).toBe('New Address');
      expect(mockCustomerRepo.save).toHaveBeenCalledWith(existing);
    });
  });

  describe('GetCustomerByIdUseCase', () => {
    it('should return customer when found within the same tenant', async () => {
      const useCase = new GetCustomerByIdUseCase(mockCustomerRepo);
      const customer = new Customer('cust-1', 'burger-craft', 'Andrés', '123');
      vi.mocked(mockCustomerRepo.findById).mockResolvedValue(customer);

      const res = await useCase.execute('cust-1', 'burger-craft');
      expect(res).toEqual(customer);
    });

    it('should throw EntityNotFoundError when customer belongs to another tenant or not found', async () => {
      const useCase = new GetCustomerByIdUseCase(mockCustomerRepo);
      vi.mocked(mockCustomerRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute('cust-1', 'other-tenant')).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('UpdateCustomerUseCase', () => {
    it('should update customer attributes for the tenant', async () => {
      const useCase = new UpdateCustomerUseCase(mockCustomerRepo);
      const customer = new Customer('cust-1', 'burger-craft', 'Andrés', '123', 'Old Address');
      vi.mocked(mockCustomerRepo.findById).mockResolvedValue(customer);

      const res = await useCase.execute('cust-1', { address: 'Calle 100', barrio: 'Norte' }, 'burger-craft');
      expect(res.address).toBe('Calle 100');
      expect(res.barrio).toBe('Norte');
      expect(mockCustomerRepo.save).toHaveBeenCalledWith(customer);
    });
  });

  describe('DeleteCustomerUseCase', () => {
    it('should delete customer after confirming tenant ownership', async () => {
      const useCase = new DeleteCustomerUseCase(mockCustomerRepo);
      const customer = new Customer('cust-1', 'burger-craft', 'Andrés', '123');
      vi.mocked(mockCustomerRepo.findById).mockResolvedValue(customer);

      await useCase.execute('cust-1', 'burger-craft');
      expect(mockCustomerRepo.delete).toHaveBeenCalledWith('cust-1', 'burger-craft');
    });

    it('should reject deletion if customer belongs to another tenant', async () => {
      const useCase = new DeleteCustomerUseCase(mockCustomerRepo);
      vi.mocked(mockCustomerRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute('cust-1', 'foreign-tenant')).rejects.toThrow(EntityNotFoundError);
      expect(mockCustomerRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('ListCustomersUseCase', () => {
    it('should list customers exclusively for the requested restaurant', async () => {
      const useCase = new ListCustomersUseCase(mockCustomerRepo);
      const list = [
        new Customer('c1', 'burger-craft', 'Andrés', '123'),
        new Customer('c2', 'burger-craft', 'Beatriz', '456'),
      ];
      vi.mocked(mockCustomerRepo.findByRestaurantId).mockResolvedValue(list);

      const result = await useCase.execute('burger-craft');
      expect(result.length).toBe(2);
      expect(result.every((c) => c.restaurantId === 'burger-craft')).toBe(true);
    });
  });
});
