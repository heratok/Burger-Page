import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  price: z.number().positive(),
  category: z.string().min(1),
  isAvailable: z.boolean(),
  additions: z.array(z.string())
});

export const updateProductSchema = createProductSchema.partial();
