import { randomUUID } from 'node:crypto';
import { Order, OrderItem, OrderItemAddition } from '../../domain/models/Order.js';
import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { UpdateOrderDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateOrderUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo?: ProductRepository,
    private additionRepo?: ProductAdditionRepository,
    private customerRepo?: CustomerRepository
  ) {}

  async execute(id: string, dto: UpdateOrderDTO, restaurantId: string): Promise<Order> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant context is required to update an order.');
    }

    // 1. Validate order exists for restaurantId
    const order = await this.orderRepo.findById(id, restaurantId);
    if (!order) {
      throw new EntityNotFoundError(`Order '${id}' not found for restaurant '${restaurantId}'.`);
    }

    // 2. Update customer info if provided
    if (dto.customer) {
      order.customer = {
        name: dto.customer.name ?? order.customer?.name ?? '',
        nombre: dto.customer.name ?? order.customer?.nombre ?? '',
        phone: dto.customer.phone ?? order.customer?.phone ?? '',
        telefono: dto.customer.phone ?? order.customer?.telefono ?? '',
        address: dto.customer.address ?? order.customer?.address ?? '',
        direccion: dto.customer.address ?? order.customer?.direccion ?? '',
        barrio: dto.customer.barrio ?? order.customer?.barrio ?? '',
        email: dto.customer.email ?? order.customer?.email ?? '',
      };

      if (this.customerRepo && order.customerId) {
        try {
          const customer = await this.customerRepo.findById(order.customerId, restaurantId);
          if (customer) {
            if (dto.customer.name) customer.name = dto.customer.name;
            if (dto.customer.phone) customer.phone = dto.customer.phone;
            if (dto.customer.address) customer.address = dto.customer.address;
            if (dto.customer.barrio) customer.barrio = dto.customer.barrio;
            if (dto.customer.email) customer.email = dto.customer.email;
            customer.updatedAt = new Date().toISOString();
            await this.customerRepo.save(customer);
          }
        } catch {
          // Gracefully continue without failing order update
        }
      }
    }

    // 3. Update delivery fee if provided
    if (dto.deliveryFee !== undefined) {
      order.deliveryFee = dto.deliveryFee;
    }

    // 4. Update payment method and amounts
    if (dto.paymentMethod !== undefined) {
      (order as any).paymentMethod = dto.paymentMethod;
    }

    if (dto.comment !== undefined) {
      (order as any).comment = dto.comment;
    }

    if (dto.receiptUrl !== undefined) {
      order.receiptUrl = dto.receiptUrl;
    }

    if (dto.status !== undefined) {
      order.status = dto.status;
    }

    // 5. Update items & additions and recalculate subtotal / finalTotal
    if (dto.items !== undefined) {
      const validatedItems: OrderItem[] = [];

      for (const itemDto of dto.items) {
        if (!itemDto.quantity || itemDto.quantity <= 0) {
          throw new ValidationError(`Invalid quantity for product ${itemDto.productId}`);
        }

        let product = this.productRepo ? await this.productRepo.findById(itemDto.productId, restaurantId) : null;
        if (!product && this.productRepo && typeof this.productRepo.findByRestaurantId === 'function') {
          const allProducts = await this.productRepo.findByRestaurantId(restaurantId);
          product = allProducts.find((p) => p.id === itemDto.productId || p.name.toLowerCase() === itemDto.productId.toLowerCase()) || null;
        }

        const unitPrice = product ? Number(product.price) : ((itemDto as any).unitPrice ?? (itemDto as any).price ?? 0);
        const productName = product ? product.name : ((itemDto as any).productName ?? 'Product');

        const validatedAdditions: OrderItemAddition[] = [];
        if (itemDto.additions && itemDto.additions.length > 0) {
          for (const rawAdd of itemDto.additions) {
            const additionId = typeof rawAdd === 'string' ? rawAdd : rawAdd.additionId;
            const addQuantity = typeof rawAdd === 'string' ? 1 : (rawAdd.quantity || 1);

            let addition = this.additionRepo ? await this.additionRepo.findById(additionId, restaurantId) : null;
            if (!addition && this.additionRepo && typeof this.additionRepo.findByRestaurantId === 'function') {
              const allAdditions = await this.additionRepo.findByRestaurantId(restaurantId);
              addition = allAdditions.find((a) => a.id === additionId || a.name.toLowerCase() === additionId.toLowerCase()) || null;
            }

            const additionPrice = addition
              ? Number(addition.price)
              : typeof rawAdd !== 'string' && (rawAdd as any).unitPrice !== undefined
                ? Number((rawAdd as any).unitPrice)
                : 0;
            const additionName = addition
              ? addition.name
              : typeof rawAdd !== 'string' && (rawAdd as any).additionName
                ? (rawAdd as any).additionName
                : additionId;

            validatedAdditions.push({
              id: (rawAdd as any).id || `ord_add_${randomUUID()}`,
              additionId,
              additionName,
              unitPrice: additionPrice,
              quantity: addQuantity,
            });
          }
        }

        validatedItems.push({
          id: (itemDto as any).id || `ord_item_${randomUUID()}`,
          productId: itemDto.productId,
          productName,
          unitPrice,
          quantity: itemDto.quantity,
          observation: itemDto.observation || undefined,
          additions: validatedAdditions,
        });
      }

      order.items = validatedItems;
    }

    // 6. Recalculate payment & change if cash
    if (order.paymentMethod === 'Efectivo') {
      const paymentAmount = dto.paymentAmount !== undefined ? dto.paymentAmount : order.paymentAmount;
      (order as any).paymentAmount = paymentAmount;
      if (paymentAmount !== undefined) {
        (order as any).changeAmount = Math.max(0, paymentAmount - order.finalTotal);
      }
    } else if (order.paymentMethod === 'Transferencia') {
      (order as any).paymentAmount = undefined;
      (order as any).changeAmount = undefined;
    }

    // 7. Save via orderRepository.update(updatedOrder, restaurantId)
    const updated = await this.orderRepo.update(order, restaurantId);

    // Return updated Order
    return updated || order;
  }
}
