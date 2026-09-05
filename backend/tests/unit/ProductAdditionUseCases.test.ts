import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProductAdditionUseCase } from '../../src/application/use-cases/CreateProductAdditionUseCase.js';
import { GetProductAdditionByIdUseCase } from '../../src/application/use-cases/GetProductAdditionByIdUseCase.js';
import { ListProductAdditionsUseCase } from '../../src/application/use-cases/ListProductAdditionsUseCase.js';
import { UpdateProductAdditionUseCase } from '../../src/application/use-cases/UpdateProductAdditionUseCase.js';
import { DeleteProductAdditionUseCase } from '../../src/application/use-cases/DeleteProductAdditionUseCase.js';
import { ProductAdditionRepository } from '../../src/domain/ports/out/ProductAdditionRepository.js';
import { ProductRepository } from '../../src/domain/ports/out/ProductRepository.js';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/DomainErrors.js';
import { ProductAddition } from '../../src/domain/models/ProductAddition.js';

describe('ProductAddition Use Cases (Unit)', () => {
  let mockAdditionRepo: ProductAdditionRepository;
  let mockProductRepo: ProductRepository;

  beforeEach(() => {
    mockAdditionRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      findByProductId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockProductRepo = {
      findById: vi.fn().mockImplementation(async (id: string, rid: string) => {
        if (id === 'prod-1' && rid === 'tenant-a') {
          return {
            id: 'prod-1',
            restaurantId: 'tenant-a',
            name: 'Classic Burger',
            description: '',
            price: 20000,
            category: 'Burgers',
            isAvailable: true,
          };
        }
        return null;
      }),
      findByRestaurantId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      delete: vi.fn(),
    };
  });

  describe('CreateProductAdditionUseCase', () => {
    it('creates global addition when productId is not provided', async () => {
      const useCase = new CreateProductAdditionUseCase(mockAdditionRepo, mockProductRepo);
      const result = await useCase.execute(
        { name: 'Extra Queso', price: 3000, isAvailable: true, displayOrder: 1 },
        'tenant-a'
      );

      expect(result.id).toMatch(/^add_/);
      expect(result.name).toBe('Extra Queso');
      expect(result.price).toBe(3000);
      expect(result.productId).toBeUndefined();
      expect(result.restaurantId).toBe('tenant-a');
      expect(mockAdditionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('creates product-specific addition when valid productId is given', async () => {
      const useCase = new CreateProductAdditionUseCase(mockAdditionRepo, mockProductRepo);
      const result = await useCase.execute(
        { name: 'Doble Tocineta', price: 5000, productId: 'prod-1' },
        'tenant-a'
      );

      expect(result.productId).toBe('prod-1');
      expect(mockAdditionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws ValidationError if product does not exist or belongs to another tenant', async () => {
      const useCase = new CreateProductAdditionUseCase(mockAdditionRepo, mockProductRepo);
      await expect(
        useCase.execute({ name: 'Doble Tocineta', price: 5000, productId: 'prod-999' }, 'tenant-a')
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for empty name or negative price', async () => {
      const useCase = new CreateProductAdditionUseCase(mockAdditionRepo, mockProductRepo);
      await expect(useCase.execute({ name: ' ', price: 1000 }, 'tenant-a')).rejects.toThrow(ValidationError);
      await expect(useCase.execute({ name: 'Extra', price: -500 }, 'tenant-a')).rejects.toThrow(ValidationError);
      await expect(useCase.execute({ name: 'Extra', price: 1000 }, '')).rejects.toThrow(ValidationError);
    });
  });

  describe('GetProductAdditionByIdUseCase', () => {
    it('returns addition if found and matches restaurantId', async () => {
      const addition = new ProductAddition('add-1', 'tenant-a', 'Papas', 4000);
      vi.mocked(mockAdditionRepo.findById).mockResolvedValue(addition);

      const useCase = new GetProductAdditionByIdUseCase(mockAdditionRepo);
      const result = await useCase.execute('add-1', 'tenant-a');

      expect(result).toBe(addition);
      expect(mockAdditionRepo.findById).toHaveBeenCalledWith('add-1', 'tenant-a');
    });

    it('throws EntityNotFoundError if not found', async () => {
      vi.mocked(mockAdditionRepo.findById).mockResolvedValue(null);

      const useCase = new GetProductAdditionByIdUseCase(mockAdditionRepo);
      await expect(useCase.execute('add-999', 'tenant-a')).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('ListProductAdditionsUseCase', () => {
    it('lists additions for restaurant', async () => {
      const additions = [new ProductAddition('add-1', 'tenant-a', 'Queso', 2000)];
      vi.mocked(mockAdditionRepo.findByRestaurantId).mockResolvedValue(additions);

      const useCase = new ListProductAdditionsUseCase(mockAdditionRepo);
      const result = await useCase.execute('tenant-a');

      expect(result).toEqual(additions);
      expect(mockAdditionRepo.findByRestaurantId).toHaveBeenCalledWith('tenant-a');
    });

    it('filters by productId if given', async () => {
      const additions = [new ProductAddition('add-1', 'tenant-a', 'Queso', 2000, true, 'prod-1')];
      vi.mocked(mockAdditionRepo.findByProductId).mockResolvedValue(additions);

      const useCase = new ListProductAdditionsUseCase(mockAdditionRepo);
      const result = await useCase.execute('tenant-a', 'prod-1');

      expect(result).toEqual(additions);
      expect(mockAdditionRepo.findByProductId).toHaveBeenCalledWith('prod-1', 'tenant-a');
    });
  });

  describe('UpdateProductAdditionUseCase', () => {
    it('updates fields correctly', async () => {
      const existing = new ProductAddition('add-1', 'tenant-a', 'Old Name', 2000, true, undefined, 0);
      vi.mocked(mockAdditionRepo.findById).mockResolvedValue(existing);

      const useCase = new UpdateProductAdditionUseCase(mockAdditionRepo, mockProductRepo);
      const result = await useCase.execute(
        'add-1',
        { name: 'New Name', price: 2500, isAvailable: false, displayOrder: 5, productId: 'prod-1' },
        'tenant-a'
      );

      expect(result.name).toBe('New Name');
      expect(result.price).toBe(2500);
      expect(result.isAvailable).toBe(false);
      expect(result.displayOrder).toBe(5);
      expect(result.productId).toBe('prod-1');
      expect(mockAdditionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws EntityNotFoundError if addition not found', async () => {
      vi.mocked(mockAdditionRepo.findById).mockResolvedValue(null);

      const useCase = new UpdateProductAdditionUseCase(mockAdditionRepo, mockProductRepo);
      await expect(useCase.execute('add-999', { name: 'New' }, 'tenant-a')).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('DeleteProductAdditionUseCase', () => {
    it('deletes addition when found and belongs to tenant', async () => {
      const existing = new ProductAddition('add-1', 'tenant-a', 'Queso', 2000);
      vi.mocked(mockAdditionRepo.findById).mockResolvedValue(existing);

      const useCase = new DeleteProductAdditionUseCase(mockAdditionRepo);
      await useCase.execute('add-1', 'tenant-a');

      expect(mockAdditionRepo.delete).toHaveBeenCalledWith('add-1', 'tenant-a');
    });

    it('throws EntityNotFoundError if not found', async () => {
      vi.mocked(mockAdditionRepo.findById).mockResolvedValue(null);

      const useCase = new DeleteProductAdditionUseCase(mockAdditionRepo);
      await expect(useCase.execute('add-999', 'tenant-a')).rejects.toThrow(EntityNotFoundError);
    });
  });
});
