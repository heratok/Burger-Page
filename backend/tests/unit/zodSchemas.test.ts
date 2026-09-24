import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import {
  createProductSchema,
  updateProductSchema,
  createProductAdditionSchema,
  updateProductAdditionSchema,
  createRestaurantSchema,
  updateRestaurantSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  updateOrderReceiptSchema,
  orderStatusEnum,
} from '@burger-page/contracts';
import { jsonSchemaFromZod, ORDER_STATUS_JSON } from '../../src/infrastructure/http/zodSchemas.js';

// Mirrors buildApp's AJV setup (`strict: false`, `keywords: ['example']`).
// Like the Fastify runtime, bare AJV ignores unknown `format` keywords, which
// is exactly how the app validates today.
const ajv = new Ajv({ strict: false });

// The request bodies wired into the route files. createOrderBody and
// updateOrderBody are intentionally absent: the openApi3 target renders
// z.number().int().positive() (orderItemInputSchema.quantity) as a boolean
// `exclusiveMinimum`, which AJV (draft-07) refuses to compile, so those two
// routes keep inline bodies — see zodSchemas.ts and order.routes.ts.
const derivedBodies = {
  createProductBody: jsonSchemaFromZod(createProductSchema, 'createProductBody'),
  updateProductBody: jsonSchemaFromZod(updateProductSchema, 'updateProductBody'),
  createAdditionBody: jsonSchemaFromZod(createProductAdditionSchema, 'createAdditionBody'),
  updateAdditionBody: jsonSchemaFromZod(updateProductAdditionSchema, 'updateAdditionBody'),
  createRestaurantBody: jsonSchemaFromZod(createRestaurantSchema, 'createRestaurantBody'),
  updateRestaurantBody: jsonSchemaFromZod(updateRestaurantSchema, 'updateRestaurantBody'),
  updateOrderStatusBody: jsonSchemaFromZod(updateOrderStatusSchema, 'updateOrderStatusBody'),
  updateOrderReceiptBody: jsonSchemaFromZod(updateOrderReceiptSchema, 'updateOrderReceiptBody'),
} as const;

describe('jsonSchemaFromZod', () => {
  it('derives self-contained schemas (no $refs/definitions) that AJV compiles', () => {
    for (const [name, schema] of Object.entries(derivedBodies)) {
      const text = JSON.stringify(schema);
      expect(text, `${name} must not contain $ref`).not.toContain('$ref');
      expect(text, `${name} must not carry a definitions bag`).not.toContain('definitions');
      expect(() => ajv.compile(schema), `${name} must compile in AJV`).not.toThrow();
    }
  });

  it('memoizes by name: the same name returns the same object reference', () => {
    const first = jsonSchemaFromZod(createProductSchema, 'createProductBody');
    const second = jsonSchemaFromZod(createProductSchema, 'createProductBody');
    expect(second).toBe(first);
    const differentName = jsonSchemaFromZod(createProductSchema, 'someOtherBody');
    expect(differentName).not.toBe(first);
    expect(differentName).toEqual(first);
  });

  it('exposes ORDER_STATUS_JSON as the contract status enum values', () => {
    expect(ORDER_STATUS_JSON).toEqual([...orderStatusEnum.options]);
  });
});

describe('parity: derived AJV schemas accept what zod accepts and reject what zod rejects', () => {
  const zodRejects = (contract: any) => (payload: unknown) => !contract.safeParse(payload).success;

  const checkParity = (
    bodyName: keyof typeof derivedBodies,
    contract: any,
    valid: unknown,
    invalid: unknown,
  ) => {
    const validate = ajv.compile(derivedBodies[bodyName]);
    expect(validate(valid), `ajv should accept ${JSON.stringify(valid)}`).toBe(true);
    expect(zodRejects(contract)(valid), `zod should accept ${JSON.stringify(valid)}`).toBe(false);
    expect(validate(invalid), `ajv should reject ${JSON.stringify(invalid)}`).toBe(false);
    expect(zodRejects(contract)(invalid), `zod should reject ${JSON.stringify(invalid)}`).toBe(true);
  };

  it('createProductBody: valid payload accepted, missing-name payload rejected', () => {
    checkParity('createProductBody', createProductSchema, { name: 'Burger', price: 10 }, { price: 10 });
  });

  it('updateProductBody: partial update accepted, negative price rejected', () => {
    checkParity('updateProductBody', updateProductSchema, { price: 10 }, { price: -1 });
  });

  it('updateAdditionBody: valid update accepted, negative price rejected', () => {
    checkParity('updateAdditionBody', updateProductAdditionSchema, { price: 0 }, { price: -2 });
  });

  it('createOrderBody: bad enum rejected at contract level, enum rendered faithfully', () => {
    // createOrderBody cannot be compiled by AJV under the openApi3 target
    // (int().positive() renders a boolean exclusiveMinimum), so the controller
    // zod safeParse is its enforcement point. Assert the contract rejects the
    // bad enum value and the derived schema encodes the exact same enum.
    const badPaymentMethod = {
      restaurantId: 'r',
      items: [{ productId: 'p', quantity: 1 }],
      paymentMethod: 'Visa',
    };
    expect(zodRejects(createOrderSchema)(badPaymentMethod)).toBe(true);
    const derived = jsonSchemaFromZod(createOrderSchema, 'createOrderBody');
    expect((derived as any).properties.paymentMethod.enum).toEqual(['Efectivo', 'Transferencia']);
  });

  it('updateOrderStatusBody: every contract status accepted, bad status rejected', () => {
    const validate = ajv.compile(derivedBodies.updateOrderStatusBody);
    for (const status of orderStatusEnum.options) {
      expect(validate({ status }), `ajv should accept status ${status}`).toBe(true);
    }
    expect(validate({ status: 'cookingg' })).toBe(false);
    expect(validate({})).toBe(false);
    expect(zodRejects(updateOrderStatusSchema)({ status: 'cookingg' })).toBe(true);
  });

  it('updateOrderReceiptBody: valid receipt accepted, missing receiptUrl rejected', () => {
    checkParity('updateOrderReceiptBody', updateOrderReceiptSchema, { receiptUrl: 'https://x/y.png' }, {});
  });

  it('createRestaurantBody: valid create accepted, missing slug and bad config type rejected', () => {
    const validate = ajv.compile(derivedBodies.createRestaurantBody);
    const valid = { name: 'R', slug: 'r', config: { deliveryFee: 5, bgTheme: 'warm-cream', extraKey: 'x' } };
    expect(validate(valid)).toBe(true);
    expect(zodRejects(createRestaurantSchema)(valid)).toBe(false);
    expect(validate({ name: 'R' })).toBe(false);
    expect(validate({ name: 'R', slug: 'r', config: { deliveryFee: 'nope' } })).toBe(false);
    expect(validate({ name: 'R', slug: 'r', config: { bgTheme: 'neon' } })).toBe(false);
  });

  it('updateRestaurantBody: partial update accepted, bad config type rejected', () => {
    const validate = ajv.compile(derivedBodies.updateRestaurantBody);
    expect(validate({ name: 'R2', config: { deliveryFee: 9, primaryColor: '#fff' } })).toBe(true);
    expect(validate({})).toBe(true);
    expect(zodRejects(updateRestaurantSchema)({})).toBe(false);
    expect(validate({ config: { deliveryFee: 'nope' } })).toBe(false);
    expect(zodRejects(updateRestaurantSchema)({ config: { deliveryFee: 'nope' } })).toBe(true);
  });
});