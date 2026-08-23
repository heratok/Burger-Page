import { z } from 'zod';

export const updateInventoryStockSchema = z.object({
  quantityChange: z.number()
});
