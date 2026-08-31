import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProductUseCase } from '../../src/application/use-cases/CreateProductUseCase.js';
import { UpdateProductUseCase } from '../../src/application/use-cases/UpdateProductUseCase.js';
import { DeleteProductUseCase } from '../../src/application/use-cases/DeleteProductUseCase.js';
import { GetProductByIdUseCase } from '../../src/application/use-cases/GetProductByIdUseCase.js';
import { ListProductsUseCase } from '../../src/application/use-cases/ListProductsUseCase.js';
import { ProductRepository } from '../../src/domain/ports/out/ProductRepository.js';
import { CategoryRepository } from '../../src/domain/ports/out/CategoryRepository.js';
import { ProductAdditionRepository } from '../../src/domain/ports/out/ProductAdditionRepository.js';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/DomainErrors.js';
import { Product } from '../../src/domain/models/Product.js';
import { ProductAddition } from '../../src/domain/models/ProductAddition.js';

describe('Product Use Cases (Unit)', () => {
  let mockProductRepo: ProductRepository;
  let mockCategoryRepo: CategoryRepository;
  let mockAdditionRepo: ProductAdditionRepository;

  beforeEach(() => {
    mockProductRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockCategoryRepo = {
      findById: vi.fn().mockImplementation(async (id: string, rid: string) => {
        if (id === 'cat-burgers' || id === 'cat-1') {
          return { id, restaurantId: rid, name: 'Burgers', isActive: true };
        }
        return null;
      }),
      findByRestaurantId: vi.fn().mockResolvedValue([]),
      findByName: vi.fn().mockImplementation(async (name: string, rid: string) => {
        if (name === 'Burgers' || name === 'Food') {
          return { id: `cat-${name.toLowerCase()}`, restaurantId: rid, name, isActive: true };
        }
        return null;
      }),
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
  });

  describe('CreateProductUseCase', () => {
    it('should create and save a new product for a specific tenant', async () => {
      const useCase = new CreateProductUseCase(mockProductRepo, mockCategoryRepo, mockAdditionRepo);
      const dto = { name: 'Gourmet Burger', price: 25, category: 'Burgers', isAvailable: true, additions: [] };

      const result = await useCase.execute(dto, 'burger-craft');

      expect(result.id).toBeDefined();
      expect(result.restaurantId).toBe('burger-craft');
      expect(result.name).toBe('Gourmet Burger');
      expect(result.price).toBe(25);
      expect(mockProductRepo.save).toHaveBeenCalledWith(result);
    });

    it('should reject product creation without restaurantId', async () => {
      const useCase = new CreateProductUseCase(mockProductRepo, mockCategoryRepo, mockAdditionRepo);
      await expect(useCase.execute({ name: 'Burger', price: 10, category: 'Food' }, '')).rejects.toThrow(ValidationError);
    });

    it('should reject product with negative price or empty name', async () => {
      const useCase = new CreateProductUseCase(mockProductRepo, mockCategoryRepo, mockAdditionRepo);
      await expect(useCase.execute({ name: '', price: 10, category: 'Food' }, 'burger-craft')).rejects.toThrow(ValidationError);
      await expect(useCase.execute({ name: 'Burger', price: -5, category: 'Food' }, 'burger-craft')).rejects.toThrow(ValidationError);
    });

    it('should reject product creation if category does not exist', async () => {
      const useCase = new CreateProductUseCase(mockProductRepo, mockCategoryRepo, mockAdditionRepo);
      await expect(useCase.execute({ name: 'Burger', price: 10, categoryId: 'non-existent' }, 'burger-craft')).rejects.toThrow(ValidationError);
    });

    it('should reject product creation if an addition belongs to another tenant', async () => {
      const useCase = new CreateProductUseCase(mockProductRepo, mockCategoryRepo, mockAdditionRepo);
      const foreignAddition = new ProductAddition('add-foreign', 'other-restaurant', 'Foreign Sauce', 3, true);
      vi.mocked(mockAdditionRepo.findById).mockResolvedValue(foreignAddition);

      await expect(useCase.execute({
        name: 'Burger',
        price: 15,
        category: 'Food',
        additions: ['add-foreign']
      }, 'burger-craft')).rejects.toThrow(ValidationError);
    });
  });

  describe('UpdateProductUseCase', () => {
    it('should update and save an existing product of the same tenant', async () => {
      const useCase = new UpdateProductUseCase(mockProductRepo, mockCategoryRepo, mockAdditionRepo);
      const existingProduct: Product = {
        id: 'p1',
        restaurantId: 'burger-craft',
        name: 'Burger',
        price: 10,
        category: 'Food',
        isAvailable: true,
        additions: [],
        description: 'desc'
      };

      vi.mocked(mockProductRepo.findById).mockResolvedValue(existingProduct);

      const result = await useCase.execute('p1', { price: 12, isAvailable: false }, 'burger-craft');

      expect(result.price).toBe(12);
      expect(result.isAvailable).toBe(false);
      expect(mockProductRepo.save).toHaveBeenCalledWith(expect.objectContaining({ price: 12, isAvailable: false }));
    });

    it('should throw EntityNotFoundError if product belongs to another tenant', async () => {
      const useCase = new UpdateProductUseCase(mockProductRepo, mockCategoryRepo, mockAdditionRepo);
      vi.mocked(mockProductRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute('p1', { price: 12 }, 'other-restaurant')).rejects.toThrow(EntityNotFoundError);
    });

    it('should reject update if specified categoryId does not exist', async () => {
      const useCase = new UpdateProductUseCase(mockProductRepo, mockCategoryRepo, mockAdditionRepo);
      const existingProduct: Product = {
        id: 'p1',
        restaurantId: 'burger-craft',
        name: 'Burger',
        price: 10,
        category: 'Food',
        isAvailable: true,
        additions: [],
        description: 'desc'
      };
      vi.mocked(mockProductRepo.findById).mockResolvedValue(existingProduct);

      await expect(useCase.execute('p1', { categoryId: 'non-existent' }, 'burger-craft')).rejects.toThrow(ValidationError);
    });
  });

  describe('GetProductByIdUseCase', () => {
    it('should return a product by ID for the tenant', async () => {
      const useCase = new GetProductByIdUseCase(mockProductRepo);
      const product: Product = {
        id: 'p1',
        restaurantId: 'burger-craft',
        name: 'Burger',
        price: 10,
        category: 'Food',
        isAvailable: true,
        additions: [],
        description: 'desc'
      };

      vi.mocked(mockProductRepo.findById).mockResolvedValue(product);
      const result = await useCase.execute('p1', 'burger-craft');
      expect(result).toEqual(product);
    });
  });

  describe('ListProductsUseCase', () => {
    it('should list only products of the requested tenant and filter availability if requested', async () => {
      const useCase = new ListProductsUseCase(mockProductRepo);
      const products: Product[] = [
        { id: 'p1', restaurantId: 'burger-craft', name: 'Burger', price: 10, category: 'Food', isAvailable: true, additions: [], description: 'desc' },
        { id: 'p2', restaurantId: 'burger-craft', name: 'Sold Out Burger', price: 12, category: 'Food', isAvailable: false, additions: [], description: 'desc' }
      ];

      vi.mocked(mockProductRepo.findByRestaurantId).mockResolvedValue(products);

      // Admin mode: all products
      const all = await useCase.execute('burger-craft', false);
      expect(all.length).toBe(2);

      // Storefront mode: available only
      const availableOnly = await useCase.execute('burger-craft', true);
      expect(availableOnly.length).toBe(1);
      expect(availableOnly[0].id).toBe('p1');
    });
  });

  describe('DeleteProductUseCase', () => {
    it('should delete a product after verifying tenant ownership', async () => {
      const useCase = new DeleteProductUseCase(mockProductRepo);
      const product: Product = {
        id: 'p1',
        restaurantId: 'burger-craft',
        name: 'Burger',
        price: 10,
        category: 'Food',
        isAvailable: true,
        additions: [],
        description: 'desc'
      };

      vi.mocked(mockProductRepo.findById).mockResolvedValue(product);
      await useCase.execute('p1', 'burger-craft');
      expect(mockProductRepo.delete).toHaveBeenCalledWith('p1', 'burger-craft');
    });

    it('should reject deletion if product belongs to another tenant', async () => {
      const useCase = new DeleteProductUseCase(mockProductRepo);
      vi.mocked(mockProductRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute('p1', 'other-tenant')).rejects.toThrow(EntityNotFoundError);
      expect(mockProductRepo.delete).not.toHaveBeenCalled();
    });
  });
});
