import { ID_PREFIX, isValidId, newId } from '../../domain/shared/newId.js';
import { Order, OrderItem, OrderItemAddition } from '../../domain/models/Order.js';
import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { resolveOrderTable } from './resolveOrderTable.js';
import { UpdateOrderDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { UserRole } from '../../domain/models/User.js';

const MAX_ITEM_QUANTITY = 100;
const MAX_ADDITION_QUANTITY = 10;

export class UpdateOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly productRepo?: ProductRepository,
    private readonly additionRepo?: ProductAdditionRepository,
    private readonly customerRepo?: CustomerRepository,
    private readonly tableRepo?: RestaurantTableRepository
  ) {}

  async execute(
    id: string,
    dto: UpdateOrderDTO,
    restaurantId: string,
    actorId?: string,
    actorRole?: UserRole
  ): Promise<Order> {
    const { order, resolvedRestId } = await this.findAndValidateOrder(id, restaurantId);

    await this.applyTable(order, dto.tableId, resolvedRestId);
    await this.updateCustomerInfo(order, dto.customer, resolvedRestId);
    // Snapshot BEFORE applyOrderMetadata mutates it: the CAS compares against the
    // state the domain validated, not the target (same contract as
    // UpdateOrderStatusUseCase).
    const previousStatus = order.status;
    this.applyOrderMetadata(order, dto);

    if (dto.items !== undefined) {
      order.items = await this.validateAndBuildItems(dto.items, order, resolvedRestId);
    }

    this.recalculatePayment(order, dto.paymentAmount);

    // 4.1: orderRepo.update never writes status (it would revert a concurrent
    // status change with this stale snapshot). A status carried by the payload is
    // applied through the status path with CAS + actor, before the edit, so a
    // concurrent change aborts the whole edit instead of being overwritten.
    if (dto.status !== undefined && dto.status !== previousStatus) {
      await this.orderRepo.updateStatus(id, dto.status as Order['status'], resolvedRestId, actorId, actorRole, previousStatus);
    }

    const updated = await this.orderRepo.update(order, resolvedRestId);
    return updated || order;
  }

  /**
   * undefined leaves the table alone, null detaches it, an id attaches/moves it
   * (validated in the order's restaurant, active). Re-sending the table the
   * order already sits on is a no-op even if it was deactivated since.
   */
  private async applyTable(order: Order, tableId: string | null | undefined, restaurantId: string): Promise<void> {
    if (tableId === undefined) return;
    if (tableId === null) {
      order.tableId = undefined;
      order.tableLabel = undefined;
      return;
    }
    if (tableId === order.tableId) return;
    const table = await resolveOrderTable(this.tableRepo, tableId, restaurantId);
    order.tableId = table.id;
    order.tableLabel = table.name;
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
    const previousCustomerId = order.customerId;
    if (rawPhone) {
      const existingWithPhone = await this.customerRepo.findByPhone(rawPhone, resolvedRestId);
      if (existingWithPhone) {
        (order as any).customerId = existingWithPhone.id;
        // 4.2: only the order's OWN customer profile may be edited from an order.
        // A different customer matched by phone is just linked (customer_id is
        // persisted by the repository); the typed contact stays on this order's
        // snapshot and never overwrites that customer's stored profile.
        if (existingWithPhone.id === previousCustomerId) {
          this.applyCustomerFields(existingWithPhone, customerDto);
          await this.customerRepo.save(existingWithPhone);
        }
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
      // Status changes must go through the domain state machine (same as
      // UpdateOrderStatusUseCase); arbitrary jumps are rejected.
      order.transitionTo(dto.status as Order['status']);
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
    if (itemDto.quantity > MAX_ITEM_QUANTITY) {
      throw new ValidationError(`Quantity exceeds the maximum of ${MAX_ITEM_QUANTITY} for product ${itemDto.productId}`);
    }

    const { product, resolvedProductId } = await this.resolveProduct(itemDto, existingOrder, resolvedRestId);
    const existingItem = this.findExistingOrderItem(existingOrder.items, itemDto);

    // Authoritative pricing only: catalog price, then the price already stored
    // on the order (which was catalog-priced at creation time). Client-supplied
    // prices are never trusted for unknown products.
    let unitPrice: number;
    let productName: string;
    if (product) {
      unitPrice = Number(product.price);
      productName = product.name;
    } else if (existingItem) {
      unitPrice = Number(existingItem.unitPrice);
      productName = existingItem.productName || (itemDto as any).productName || (itemDto as any).name || 'Product';
    } else {
      throw new ValidationError(
        `Product '${itemDto.productId}' is not available in the catalog for this restaurant.`
      );
    }

    const additions = await this.validateAndBuildAdditions(
      itemDto.additions,
      resolvedRestId,
      existingItem?.additions
    );

    return {
      id: this.resolveClientId((itemDto as any).id, ID_PREFIX.orderItem),
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
    const rawId = itemDto.productId || itemDto.id;
    const idMatch = (i: OrderItem) => i.id === rawId || i.productId === rawId;
    const nameMatch = (i: OrderItem) => {
      const name = itemDto.productName || itemDto.name || itemDto.productId;
      return name ? i.productName?.toLowerCase() === name.toLowerCase() : false;
    };
    return existingItems.find((i) => idMatch(i) || nameMatch(i));
  }

  private async validateAndBuildAdditions(
    rawAdditions: any[] | undefined,
    resolvedRestId: string,
    existingAdditions?: OrderItemAddition[]
  ): Promise<OrderItemAddition[]> {
    if (!rawAdditions || rawAdditions.length === 0) {
      return [];
    }

    const additions: OrderItemAddition[] = [];
    for (const rawAdd of rawAdditions) {
      additions.push(await this.resolveAddition(rawAdd, resolvedRestId, existingAdditions));
    }
    return additions;
  }

  /**
   * Keeps a client-supplied line id (an existing line being edited) when it
   * satisfies the database id format; mints one when absent; rejects anything
   * else instead of letting the database CHECK surface as a 500.
   */
  private resolveClientId(raw: unknown, prefix: string): string {
    if (raw === undefined || raw === null || raw === '') return newId(prefix);
    if (!isValidId(raw)) {
      throw new ValidationError('Order line ids must be 1-64 characters: letters, digits, "_" or "-"');
    }
    return raw;
  }

  private async resolveAddition(
    rawAdd: any,
    resolvedRestId: string,
    existingAdditions?: OrderItemAddition[]
  ): Promise<OrderItemAddition> {
    const additionId = typeof rawAdd === 'string' ? rawAdd : rawAdd.additionId;
    const addQuantity = typeof rawAdd === 'string' ? 1 : (rawAdd.quantity || 1);
    if (addQuantity <= 0 || addQuantity > MAX_ADDITION_QUANTITY) {
      throw new ValidationError(`Invalid addition quantity for addition '${additionId}'`);
    }

    let addition = this.additionRepo ? await this.additionRepo.findById(additionId, resolvedRestId) : null;
    if (!addition && this.additionRepo && typeof this.additionRepo.findByRestaurantId === 'function') {
      const allAdditions = await this.additionRepo.findByRestaurantId(resolvedRestId);
      addition = allAdditions.find((a) => a.id === additionId || a.name.toLowerCase() === additionId.toLowerCase()) || null;
    }

    // Authoritative pricing: catalog first, then the price already stored on
    // the order item (catalog-priced at creation). Client prices are rejected.
    let unitPrice: number;
    let additionName: string;
    if (addition) {
      unitPrice = Number(addition.price);
      additionName = addition.name;
    } else {
      const existing = (existingAdditions || []).find(
        (a) => a.additionId === additionId || a.additionName?.toLowerCase() === String(additionId).toLowerCase()
      );
      if (existing) {
        unitPrice = Number(existing.unitPrice);
        additionName = existing.additionName || additionId;
      } else {
        throw new ValidationError(`Addition '${additionId}' is not available in the catalog for this restaurant.`);
      }
    }

    return {
      id: this.resolveClientId(rawAdd.id, ID_PREFIX.orderAddition),
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
            // Mirror the creation path: a cash payment below the final total is a
            // silent underpayment and must be rejected, not recorded.
            if (paymentAmount < order.finalTotal) {
            throw new ValidationError(`Payment amount (${paymentAmount}) is less than final total (${order.finalTotal}).`);
            }
        (order as any).changeAmount = Math.max(0, paymentAmount - order.finalTotal);
      }
    } else if (order.paymentMethod === 'Transferencia') {
      (order as any).paymentAmount = undefined;
      (order as any).changeAmount = undefined;
    }
  }
}