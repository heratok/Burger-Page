import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProductUseCase } from '../../src/application/use-cases/CreateProductUseCase.js';
import { UpdateProductUseCase } from '../../src/application/use-cases/UpdateProductUseCase.js';
import { DeleteProductUseCase } from '../../src/application/use-cases/DeleteProductUseCase.js';
import { GetProductByIdUseCase } from '../../src/application/use-cases/GetProductByIdUseCase.js';
import { ListProductsUseCase } from '../../src/application/use-cases/ListProductsUseCase.js';
import { ProductRepository } from '../../src/domain/ports/out/ProductRepository.js';
import { EntityNotFoundError } from '../../src/domain/errors/DomainErrors.js';

describe('Product Use Cases', () => {
  let mockProductRepo: ProductRepository;

  beforeEach(() => {
    mockProductRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
  });

  describe('CreateProductUseCase', () => {
    it('should create and save a new product', async () => {
      const useCase = new CreateProductUseCase(mockProductRepo);
      const dto = { name: 'Burger', price: 10, category: 'Food', isAvailable: true, additions: [], description: 'desc' };
      
      const result = await useCase.execute(dto);
      
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Burger');
      expect(mockProductRepo.save).toHaveBeenCalledWith(result);
    });
  });

  describe('UpdateProductUseCase', () => {
    it('should update and save an existing product', async () => {
      const useCase = new UpdateProductUseCase(mockProductRepo);
      const existingProduct = { id: 'p1', name: 'Burger', price: 10, category: 'Food', isAvailable: true, additions: [], description: 'desc' };
      
      vi.mocked(mockProductRepo.findById).mockResolvedValue(existingProduct);
      
      const result = await useCase.execute('p1', { price: 12 });
      
      expect(result.price).toBe(12);
      expect(mockProductRepo.save).toHaveBeenCalledWith(expect.objectContaining({ price: 12 }));
    });

    it('should throw EntityNotFoundError if product not found', async () => {
      const useCase = new UpdateProductUseCase(mockProductRepo);
      vi.mocked(mockProductRepo.findById).mockResolvedValue(null);
      
      await expect(useCase.execute('p1', { price: 12 })).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('GetProductByIdUseCase', () => {
    it('should return a product by ID', async () => {
      const useCase = new GetProductByIdUseCase(mockProductRepo);
      const product = { id: 'p1', name: 'Burger', price: 10, category: 'Food', isAvailable: true, additions: [], description: 'desc' };
      
      vi.mocked(mockProductRepo.findById).mockResolvedValue(product);
      const result = await useCase.execute('p1');
      expect(result).toEqual(product);
    });
  });

  describe('ListProductsUseCase', () => {
    it('should list all products', async () => {
      const useCase = new ListProductsUseCase(mockProductRepo);
      const products = [{ id: 'p1', name: 'Burger', price: 10, category: 'Food', isAvailable: true, additions: [], description: 'desc' }];
      
      vi.mocked(mockProductRepo.findAll).mockResolvedValue(products);
      const result = await useCase.execute();
      expect(result).toEqual(products);
    });
  });

  describe('DeleteProductUseCase', () => {
    it('should delete a product by ID', async () => {
      const useCase = new DeleteProductUseCase(mockProductRepo);
      await useCase.execute('p1');
      expect(mockProductRepo.delete).toHaveBeenCalledWith('p1');
    });
  });
});
