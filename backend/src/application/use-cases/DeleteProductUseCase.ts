import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';

export class DeleteProductUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string): Promise<void> {
    await this.productRepo.delete(id);
  }
}
