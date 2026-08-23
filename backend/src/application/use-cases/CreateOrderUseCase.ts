import { Order, OrderItem } from '../../domain/models/Order.js';
import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { CreateOrderDTO } from '../dtos/index.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class CreateOrderUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository,
    private customerRepo: CustomerRepository
  ) {}

  async execute(dto: CreateOrderDTO): Promise<Order> {
    const items: OrderItem[] = [];
    for (const itemDto of dto.items) {
      const product = await this.productRepo.findById(itemDto.productId);
      if (!product) throw new EntityNotFoundError(`Product ${itemDto.productId} not found`);
      items.push({
        productId: product.id,
        quantity: itemDto.quantity,
        price: product.price,
        additions: itemDto.additions
      });
    }

    const order = new Order(
      crypto.randomUUID(),
      dto.customerId,
      items,
      'pending',
      new Date(),
      dto.deliveryFee || 0
    );

    await this.orderRepo.save(order);

    const customer = await this.customerRepo.findById(dto.customerId);
    if (customer) {
      customer.addOrderSpend(order.total);
      await this.customerRepo.save(customer);
    }

    return order;
  }
}
