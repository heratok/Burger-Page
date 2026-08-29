import { FastifyRequest, FastifyReply } from 'fastify';
import { ListProductsUseCase } from '../../../application/use-cases/ListProductsUseCase.js';
import { GetProductByIdUseCase } from '../../../application/use-cases/GetProductByIdUseCase.js';
import { CreateProductUseCase } from '../../../application/use-cases/CreateProductUseCase.js';
import { UpdateProductUseCase } from '../../../application/use-cases/UpdateProductUseCase.js';
import { DeleteProductUseCase } from '../../../application/use-cases/DeleteProductUseCase.js';
import { createProductSchema, updateProductSchema } from '@burger-page/contracts';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';
import { CreateProductDTO, UpdateProductDTO } from '../../../application/dtos/index.js';

export class ProductController {
  constructor(
    private listProducts: ListProductsUseCase,
    private getProduct: GetProductByIdUseCase,
    private createProductUseCase: CreateProductUseCase,
    private updateProductUseCase: UpdateProductUseCase,
    private deleteProductUseCase: DeleteProductUseCase
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const products = await this.listProducts.execute();
    return reply.status(200).send(products);
  }

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const product = await this.getProduct.execute(req.params.id);
    return reply.status(200).send(product);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const product = await this.createProductUseCase.execute(parsed.data as CreateProductDTO);
    return reply.status(201).send(product);
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    await this.updateProductUseCase.execute(req.params.id, parsed.data as UpdateProductDTO);
    return reply.status(200).send({ message: 'Product updated successfully' });
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await this.deleteProductUseCase.execute(req.params.id);
    return reply.status(204).send();
  }
}
