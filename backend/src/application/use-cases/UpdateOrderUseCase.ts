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
    private readonly orderRepo: OrderRepository,
    private readonly productRepo?: ProductRepository,
    private readonly additionRepo?: ProductAdditionRepository,
    private readonly customerRepo?: CustomerRepository
  ) {}

  async execute(id: string, dto: UpdateOrderDTO, restaurantId: string): Promise<Order> {
    const { order, resolvedRestId } = await this.findAndValidateOrder(id, restaurantId);

    await this.updateCustomerInfo(order, dto.customer, resolvedRestId);
    this.applyOrderMetadata(order, dto);

    if (dto.items !== undefined) {
      order.items = await this.validateAndBuildItems(dto.items, order, resolvedRestId);
    }

    this.recalculatePayment(order, dto.paymentAmount);

    const updated = await this.orderRepo.update(order, resolvedRestId);
    return updated || order;
  }

  private async findAndValidateOrder(
    id: string,
    restaurantId: string
  ): Promise<{ order: Order; resolvedRestId: string }> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant context is required to update an order.');
    }

    let order = await this.orderRepo.findById(id, restaurantId);
    let resolvedRestId = restaurantId;

    if (!order) {
      const altRestId = restaurantId.startsWith('rest-')
        ? restaurantId.replace(/^rest-/, '')
        : `rest-${restaurantId}`;
      const altOrder = await this.orderRepo.findById(id, altRestId);
      if (altOrder) {
        order = altOrder;
        resolvedRestId = altRestId;
      }
    }

    if (!order) {
      throw new EntityNotFoundError(`Order '${id}' not found for restaurant '${restaurantId}'.`);
    }

    return { order, resolvedRestId };
  }

  private async updateCustomerInfo(
    order: Order,
    customerDto: UpdateOrderDTO['customer'],
    resolvedRestId: string
  ): Promise<void> {
    if (!customerDto) return;

    order.customer = {
      name: customerDto.name ?? order.customer?.name ?? '',
      nombre: customerDto.name ?? order.customer?.nombre ?? '',
      phone: customerDto.phone ?? order.customer?.phone ?? '',
      telefono: customerDto.phone ?? order.customer?.telefono ?? '',
      address: customerDto.address ?? order.customer?.address ?? '',
      direccion: customerDto.address ?? order.customer?.direccion ?? '',
      barrio: customerDto.barrio ?? order.customer?.barrio ?? '',
      email: customerDto.email ?? order.customer?.email ?? '',
    };

    if (!this.customerRepo) return;

    try {
      await this.syncCustomerProfile(order, customerDto, resolvedRestId);
    } catch {
      // Gracefully continue without failing order update
    }
  }

  private async syncCustomerProfile(
    order: Order,
    customerDto: NonNullable<UpdateOrderDTO['customer']>,
    resolvedRestId: string
  ): Promise<void> {
    if (!this.customerRepo) return;

    const rawPhone = customerDto.phone?.trim();
    if (rawPhone) {
      const existingWithPhone = await this.customerRepo.findByPhone(rawPhone, resolvedRestId);
      if (existingWithPhone) {
        (order as any).customerId = existingWithPhone.id;
        this.applyCustomerFields(existingWithPhone, customerDto);
        await this.customerRepo.save(existingWithPhone);
        return;
      }
    }

    if (order.customerId) {
      const currentCust = await this.customerRepo.findById(order.customerId, resolvedRestId);
      if (currentCust) {
        if (rawPhone) currentCust.phone = rawPhone;
        this.applyCustomerFields(currentCust, customerDto);
        await this.customerRepo.save(currentCust);
      }
    }
  }

  private applyCustomerFields(
    target: { name?: string; address?: string; barrio?: string; email?: string; updatedAt?: string },
    dto: NonNullable<UpdateOrderDTO['customer']>
  ): void {
    if (dto.name) target.name = dto.name;
    if (dto.address) target.address = dto.address;
    if (dto.barrio) target.barrio = dto.barrio;
    if (dto.email) target.email = dto.email;
    target.updatedAt = new Date().toISOString();
  }

  private applyOrderMetadata(order: Order, dto: UpdateOrderDTO): void {
    if (dto.deliveryFee !== undefined) {
      order.deliveryFee = dto.deliveryFee;
    }
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
  }

  private async validateAndBuildItems(
    itemDtos: NonNullable<UpdateOrderDTO['items']>,
    existingOrder: Order,
    resolvedRestId: string
  ): Promise<OrderItem[]> {
    const validatedItems: OrderItem[] = [];
    for (const itemDto of itemDtos) {
      validatedItems.push(await this.validateAndBuildItem(itemDto, existingOrder, resolvedRestId));
    }
    return validatedItems;
  }

  private async validateAndBuildItem(
    itemDto: NonNullable<UpdateOrderDTO['items']>[number],
    existingOrder: Order,
    resolvedRestId: string
  ): Promise<OrderItem> {
    if (!itemDto.quantity || itemDto.quantity <= 0) {
      throw new ValidationError(`Invalid quantity for product ${itemDto.productId}`);
    }

    const { product, resolvedProductId } = await this.resolveProduct(itemDto, existingOrder, resolvedRestId);

    const unitPrice = product
      ? Number(product.price)
      : ((itemDto as any).unitPrice ?? (itemDto as any).price ?? 0);
    const productName = product
      ? product.name
      : ((itemDto as any).productName ?? (itemDto as any).name ?? 'Product');

    const additions = await this.validateAndBuildAdditions(itemDto.additions, resolvedRestId);

    return {
      id: (itemDto as any).id || `ord_item_${randomUUID()}`,
      productId: resolvedProductId,
      productName,
      unitPrice,
      quantity: itemDto.quantity,
      observation: itemDto.observation || undefined,
      additions,
    };
  }

  private async resolveProduct(
    itemDto: NonNullable<UpdateOrderDTO['items']>[number],
    existingOrder: Order,
    resolvedRestId: string
  ): Promise<{ product: any; resolvedProductId: string }> {
    let product = this.productRepo ? await this.productRepo.findById(itemDto.productId, resolvedRestId) : null;

    if (!product && this.productRepo && typeof this.productRepo.findByRestaurantId === 'function') {
      const allProducts = await this.productRepo.findByRestaurantId(resolvedRestId);
      product = this.findProductInList(allProducts, itemDto);
    }

    let resolvedProductId = product ? product.id : itemDto.productId;
    if (!product) {
      const existingItem = this.findExistingOrderItem(existingOrder.items, itemDto);
      if (existingItem?.productId) {
        resolvedProductId = existingItem.productId;
        if (this.productRepo) {
          product = await this.productRepo.findById(existingItem.productId, resolvedRestId);
        }
      }
    }

    return { product, resolvedProductId };
  }

  private findProductInList(allProducts: any[], itemDto: any): any {
    const idLower = itemDto.productId.toLowerCase();
    const nameLower = (itemDto.productName || itemDto.name || '').toLowerCase();
    return (
      allProducts.find(
        (p) =>
          p.id === itemDto.productId ||
          p.name.toLowerCase() === idLower ||
          (nameLower && p.name.toLowerCase() === nameLower)
      ) || null
    );
  }

  private findExistingOrderItem(existingItems: OrderItem[], itemDto: any): OrderItem | undefined {
    const idMatch = (i: OrderItem) => i.id === itemDto.productId || i.id === itemDto.id;
    const nameMatch = (i: OrderItem) => {
      const name = itemDto.productName || itemDto.name;
      return name ? i.productName?.toLowerCase() === name.toLowerCase() : false;
    };
    return existingItems.find((i) => idMatch(i) || nameMatch(i));
  }

  private async validateAndBuildAdditions(
    rawAdditions: any[] | undefined,
    resolvedRestId: string
  ): Promise<OrderItemAddition[]> {
    if (!rawAdditions || rawAdditions.length === 0) {
      return [];
    }

    const additions: OrderItemAddition[] = [];
    for (const rawAdd of rawAdditions) {
      additions.push(await this.resolveAddition(rawAdd, resolvedRestId));
    }
    return additions;
  }

  private async resolveAddition(rawAdd: any, resolvedRestId: string): Promise<OrderItemAddition> {
    const additionId = typeof rawAdd === 'string' ? rawAdd : rawAdd.additionId;
    const addQuantity = typeof rawAdd === 'string' ? 1 : (rawAdd.quantity || 1);

    let addition = this.additionRepo ? await this.additionRepo.findById(additionId, resolvedRestId) : null;
    if (!addition && this.additionRepo && typeof this.additionRepo.findByRestaurantId === 'function') {
      const allAdditions = await this.additionRepo.findByRestaurantId(resolvedRestId);
      addition = allAdditions.find((a) => a.id === additionId || a.name.toLowerCase() === additionId.toLowerCase()) || null;
    }

    let unitPrice = 0;
    if (addition) {
      unitPrice = Number(addition.price);
    } else if (typeof rawAdd !== 'string' && rawAdd.unitPrice !== undefined) {
      unitPrice = Number(rawAdd.unitPrice);
    }

    let additionName = additionId;
    if (addition) {
      additionName = addition.name;
    } else if (typeof rawAdd !== 'string' && rawAdd.additionName) {
      additionName = rawAdd.additionName;
    }

    return {
      id: rawAdd.id || `ord_add_${randomUUID()}`,
      additionId,
      additionName,
      unitPrice,
      quantity: addQuantity,
    };
  }

  private recalculatePayment(order: Order, dtoPaymentAmount?: number): void {
    if (order.paymentMethod === 'Efectivo') {
      const paymentAmount = dtoPaymentAmount ?? order.paymentAmount;
      (order as any).paymentAmount = paymentAmount;
      if (paymentAmount !== undefined) {
        (order as any).changeAmount = Math.max(0, paymentAmount - order.finalTotal);
      }
    } else if (order.paymentMethod === 'Transferencia') {
      (order as any).paymentAmount = undefined;
      (order as any).changeAmount = undefined;
    }
  }
}
