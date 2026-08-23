import { describe, it, expect } from 'vitest';
import { Order } from '../../src/domain/models/Order.js';
import { Customer } from '../../src/domain/models/Customer.js';
import { InvalidOrderStateError } from '../../src/domain/errors/DomainErrors.js';

describe('Order Domain Entity', () => {
  const createMockOrder = () => new Order(
    '1',
    'customer-1',
    [
      { productId: 'p1', quantity: 2, price: 10, additions: [] },
      { productId: 'p2', quantity: 1, price: 15, additions: ['cheese'] }
    ],
    'pending',
    new Date(),
    5 // deliveryFee
  );

  it('should calculate subtotal correctly', () => {
    const order = createMockOrder();
    // 2 * 10 + 1 * 15 = 35
    expect(order.subtotal).toBe(35);
  });

  it('should calculate total correctly (subtotal + deliveryFee)', () => {
    const order = createMockOrder();
    // 35 + 5 = 40
    expect(order.total).toBe(40);
  });

  it('should transition to valid states', () => {
    const order = createMockOrder();
    order.transitionTo('cooking');
    expect(order.status).toBe('cooking');

    order.transitionTo('delivering');
    expect(order.status).toBe('delivering');

    order.transitionTo('delivered');
    expect(order.status).toBe('delivered');
  });

  it('should throw InvalidOrderStateError for invalid state transitions', () => {
    const order = createMockOrder();
    expect(() => order.transitionTo('delivered')).toThrow(InvalidOrderStateError);
    expect(() => order.transitionTo('delivered')).toThrow('Cannot transition from pending to delivered');

    order.transitionTo('cooking');
    expect(() => order.transitionTo('pending')).toThrow(InvalidOrderStateError);
  });
});

describe('Customer Loyalty (Domain Entity)', () => {
  it('should calculate total spend and total orders correctly', () => {
    const customer = new Customer('1', 'John Doe', 'john@example.com', '123456');
    expect(customer.totalSpend).toBe(0);
    expect(customer.totalOrders).toBe(0);

    customer.addOrderSpend(100);
    expect(customer.totalSpend).toBe(100);
    expect(customer.totalOrders).toBe(1);

    customer.addOrderSpend(150);
    expect(customer.totalSpend).toBe(250);
    expect(customer.totalOrders).toBe(2);
  });

  it('should update loyalty tier based on total spend', () => {
    const customer = new Customer('1', 'John Doe', 'john@example.com', '123456');
    expect(customer.loyaltyTier).toBe('Bronze');

    customer.addOrderSpend(250); // total 250 > 200
    expect(customer.loyaltyTier).toBe('Silver');

    customer.addOrderSpend(300); // total 550 > 500
    expect(customer.loyaltyTier).toBe('Gold');
  });
});
