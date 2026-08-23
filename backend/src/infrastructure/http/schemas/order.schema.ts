import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  additions: z.array(z.string())
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(orderItemSchema).min(1),
  deliveryFee: z.number().nonnegative().optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'cooking', 'delivering', 'delivered', 'cancelled'])
});
