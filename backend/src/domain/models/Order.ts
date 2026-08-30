import { InvalidOrderStateError } from '../errors/DomainErrors.js';

export type OrderStatus = 'pending' | 'cooking' | 'delivering' | 'delivered' | 'cancelled';
export type PaymentMethod = 'Efectivo' | 'Transferencia';

export interface OrderItemAddition {
  id?: string;
  additionId: string;
  additionName: string;
  unitPrice: number;
  quantity?: number;
}

export interface OrderItem {
  id?: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  observation?: string;
  additions?: OrderItemAddition[];
}

export class Order {
  constructor(
    public readonly id: string,
    public readonly restaurantId: string,
    public readonly customerId: string | undefined,
    public items: OrderItem[],
    public status: OrderStatus,
    public createdAt: Date,
    public deliveryFee: number = 0,
    public orderNumber?: number,
    public readonly paymentMethod: PaymentMethod = 'Efectivo',
    public readonly paymentAmount?: number,
    public readonly changeAmount?: number,
    public readonly comment?: string
  ) {}

  public get subtotal(): number {
    return this.items.reduce((acc, item) => {
      const itemPrice = item.unitPrice ?? (item as any).price ?? 0;
      const additionsPrice = (item.additions || []).reduce((addAcc, add) => {
        const addPrice = typeof add === 'string' ? 0 : (add.unitPrice ?? (add as any).price ?? 0);
        const addQty = typeof add === 'string' ? 1 : (add.quantity ?? 1);
        return addAcc + (addPrice * addQty);
      }, 0);
      return acc + ((itemPrice + additionsPrice) * item.quantity);
    }, 0);
  }

  public get finalTotal(): number {
    return this.subtotal + (this.deliveryFee || 0);
  }

  public get total(): number {
    return this.finalTotal;
  }

  public transitionTo(newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      'pending': ['cooking', 'cancelled'],
      'cooking': ['delivering', 'cancelled'],
      'delivering': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    };

    if (!validTransitions[this.status].includes(newStatus)) {
      throw new InvalidOrderStateError(`Cannot transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;
  }

  public toJSON() {
    return {
      id: this.id,
      restaurantId: this.restaurantId,
      customerId: this.customerId,
      items: this.items,
      status: this.status,
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      deliveryFee: this.deliveryFee,
      orderNumber: this.orderNumber,
      subtotal: this.subtotal,
      finalTotal: this.finalTotal,
      total: this.total,
      paymentMethod: this.paymentMethod,
      paymentAmount: this.paymentAmount,
      changeAmount: this.changeAmount,
      comment: this.comment,
    };
  }
}
