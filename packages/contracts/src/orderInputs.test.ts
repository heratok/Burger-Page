import { describe, it, expect } from 'vitest';
import { createOrderSchema, isSafeReceiptUrl, updateOrderReceiptSchema } from './index.js';

describe('isSafeReceiptUrl', () => {
  it.each([
    'https://abc.supabase.co/storage/v1/object/public/image/rest_1/general/r.webp',
    'http://localhost:3001/uploads/r.webp',
    'rest_1/general/r.webp',
    'data:image/webp;base64,UklGRg==',
    'data:image/jpeg;base64,/9j/4AAQ',
  ])('accepts %s', (value) => {
    expect(isSafeReceiptUrl(value)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zz4=',
    '//evil.example/r.webp',
    '',
  ])('rejects %s', (value) => {
    expect(isSafeReceiptUrl(value)).toBe(false);
  });
});

describe('receipt URL in order contracts', () => {
  const order = { restaurantId: 'rest_1', items: [{ productId: 'prod_1', quantity: 1 }] };

  it('rejects a script URL on order creation and on receipt update', () => {
    expect(createOrderSchema.safeParse({ ...order, receiptUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(updateOrderReceiptSchema.safeParse({ receiptUrl: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('keeps accepting uploaded receipts', () => {
    expect(createOrderSchema.safeParse({ ...order, receiptUrl: 'https://cdn.example/r.webp' }).success).toBe(true);
    expect(updateOrderReceiptSchema.safeParse({ receiptUrl: 'data:image/png;base64,iVBORw0KGgo=' }).success).toBe(true);
  });
});

describe('order free-text bounds', () => {
  const order = { restaurantId: 'rest_1', items: [{ productId: 'prod_1', quantity: 1 }] };

  it('accepts what the storefront form allows', () => {
    const ok = createOrderSchema.safeParse({
      ...order,
      customer: { name: 'a'.repeat(60), phone: '3'.repeat(15), address: 'd'.repeat(100), barrio: 'b'.repeat(60) },
      comment: 'c'.repeat(300),
    });
    expect(ok.success).toBe(true);
  });

  it('rejects oversized values', () => {
    expect(createOrderSchema.safeParse({ ...order, comment: 'c'.repeat(1001) }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...order, customer: { name: 'a'.repeat(121) } }).success).toBe(false);
    expect(
      createOrderSchema.safeParse({ ...order, items: [{ productId: 'prod_1', quantity: 1, observation: 'o'.repeat(501) }] }).success
    ).toBe(false);
  });
});
