import { z } from 'zod';

// ==========================================
// RESTAURANT / STOREFRONT CONTRACTS
// ==========================================

export const storefrontConfigSchema = z.object({
  name: z.string().min(1),
  tagline: z.string(),
  logoUrl: z.string().url().or(z.string()),
  bannerUrl: z.string().url().or(z.string()),
  showBanner: z.boolean(),
  announcementText: z.string(),
  showAnnouncement: z.boolean(),
  whatsappNumber: z.string(),
  currency: z.string(),
  currencySymbol: z.string(),
  deliveryFee: z.number().nonnegative(),
  minOrderAmount: z.number().nonnegative(),
  estimatedDeliveryTime: z.string(),
  openingHours: z.string(),
  address: z.string(),
  primaryColor: z.string(),
  primaryHoverColor: z.string(),
  bgTheme: z.enum(['dark-charcoal', 'deep-midnight', 'warm-cream', 'clean-white']),
  fontFamily: z.enum(['sans', 'serif', 'mono', 'display']),
  cardRadius: z.enum(['sm', 'md', 'lg', 'full']),
  cardStyle: z.enum(['elevated', 'bordered', 'glass', 'minimal']),
  compactGrid: z.boolean(),
  showBadges: z.boolean(),
});

export type StorefrontConfigDTO = z.infer<typeof storefrontConfigSchema>;

export const updateRestaurantCategoriesSchema = z.object({
  categories: z.array(z.string().min(1, 'Category name cannot be empty')).min(1, 'At least one category is required'),
});
export type UpdateRestaurantCategoriesInput = z.infer<typeof updateRestaurantCategoriesSchema>;

// ==========================================
// PRODUCT / MENU CONTRACTS
// ==========================================

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string(),
  price: z.number().positive('Price must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  isAvailable: z.boolean().default(true),
  additions: z.array(z.string()).default([]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productDTOSchema = createProductSchema.extend({
  id: z.string(),
});
export type ProductDTO = z.infer<typeof productDTOSchema>;

// ==========================================
// ORDER CONTRACTS
// ==========================================

export const orderStatusEnum = z.enum([
  'pending',
  'cooking',
  'delivering',
  'delivered',
  'cancelled',
]);
export type OrderStatusType = z.infer<typeof orderStatusEnum>;

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  additions: z.array(z.string()).default([]),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  items: z.array(orderItemInputSchema).min(1, 'Order must have at least one item'),
  deliveryFee: z.number().nonnegative().optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// ==========================================
// INVENTORY CONTRACTS
// ==========================================

export const updateInventoryStockSchema = z.object({
  quantityChange: z.number(),
});
export type UpdateInventoryStockInput = z.infer<typeof updateInventoryStockSchema>;

// ==========================================
// REAL-TIME ORDER EVENTS (SSE)
// ==========================================

export const orderEventSchema = z.object({
  eventType: z.enum(['ORDER_CREATED', 'ORDER_STATUS_UPDATED', 'ORDER_CANCELLED']),
  orderId: z.string(),
  orderNumber: z.number().optional(),
  status: orderStatusEnum,
  timestamp: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
});
export type OrderEvent = z.infer<typeof orderEventSchema>;
