import { z } from 'zod';
import { isValidTimeZone, weeklyScheduleSchema } from './schedule.js';

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

/** Minimum length of any account password (mirrors the backend User model). */
export const MIN_PASSWORD_LENGTH = 8;

export const createRestaurantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Restaurant name is required'),
  slug: z.string().min(1, 'Restaurant slug is required'),
  tagline: z.string().optional(),
  whatsappNumber: z.string().optional(),
  adminPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Admin password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .optional(),
  adminUsername: z.string().optional(),
  primaryColor: z.string().optional(),
  templateType: z.enum(['burger', 'pizza', 'tacos', 'blank']).optional(),
  categories: z.array(z.string()).optional(),
  theme: z.string().optional(),
  isActive: z.boolean().optional(),
  config: storefrontConfigSchema.partial().optional(),
  // Weekly opening hours (source of truth), the IANA timezone they are read in
  // and the manual "pause orders" switch. config.openingHours (text) and the
  // top-level openingHours object are legacy read-only projections of schedule.
  schedule: weeklyScheduleSchema.optional(),
  timezone: z.string().refine(isValidTimeZone, 'Timezone must be a valid IANA timezone').optional(),
  ordersPaused: z.boolean().optional(),
  // Money of the store (restaurant_settings): ISO 4217 code and display symbol.
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO 4217 code')
    .optional(),
  currencySymbol: z.string().trim().min(1, 'Currency symbol is required').max(8).optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

/** One entry of GET /restaurants/templates: counts are derived from the template data. */
export const restaurantTemplateSummarySchema = z.object({
  id: z.enum(['burger', 'pizza', 'tacos', 'blank']),
  name: z.string(),
  description: z.string(),
  productCount: z.number().int().nonnegative(),
  additionCount: z.number().int().nonnegative(),
  /** Currencies the sample prices support; null = any (blank template). */
  supportedCurrencies: z.array(z.string()).nullable().optional(),
});
export type RestaurantTemplateSummary = z.infer<typeof restaurantTemplateSummarySchema>;

export const updateRestaurantSchema = createRestaurantSchema.partial();
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

/** Body of POST /restaurants/:id/restore: optionally restore under a new slug. */
export const restoreRestaurantSchema = z.object({
  slug: z.string().min(1, 'Restaurant slug is required').optional(),
});
export type RestoreRestaurantInput = z.infer<typeof restoreRestaurantSchema>;

export const restaurantDTOSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string().optional(),
  theme: z.string().optional(),
  adminPassword: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  categories: z.array(z.string()).default([]),
  config: storefrontConfigSchema.partial().optional(),
  openingHours: z.object({ open: z.string(), close: z.string() }).optional(),
  schedule: weeklyScheduleSchema.optional(),
  timezone: z.string().optional(),
  ordersPaused: z.boolean().optional(),
});

export type RestaurantDTO = z.infer<typeof restaurantDTOSchema>;

export const updateRestaurantCategoriesSchema = z.object({
  // A restaurant may exist with zero categories, so an empty array is valid;
  // individual category names still must not be empty.
  categories: z.array(z.string().min(1, 'Category name cannot be empty')),
  // Renames are applied in place on the category row so products keep their
  // category. `to` must also appear in `categories`.
  renames: z
    .array(
      z.object({
        from: z.string().min(1, 'Category name cannot be empty'),
        to: z.string().min(1, 'Category name cannot be empty'),
      })
    )
    .optional(),
});
export type UpdateRestaurantCategoriesInput = z.infer<typeof updateRestaurantCategoriesSchema>;

// ==========================================
// PRODUCT / MENU CONTRACTS
// ==========================================

export const createProductSchema = z.object({
  restaurantId: z.string().optional(), // Injected from JWT on backend
  name: z.string().min(1, 'Product name is required'),
  description: z.string().default(''),
  price: z.number().nonnegative('Price must be greater than or equal to 0'),
  categoryId: z.string().optional(),
  category: z.string().optional(), // Optional label; backend resolves canonical category name from categoryId
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().optional(),
  isNew: z.boolean().optional(),
  preparationTimeMinutes: z.number().nonnegative().optional(),
  displayOrder: z.number().optional(),
  additions: z.array(z.string()).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productDTOSchema = createProductSchema.extend({
  id: z.string(),
  restaurantId: z.string(),
});
export type ProductDTO = z.infer<typeof productDTOSchema>;

// ==========================================
// PRODUCT ADDITION CONTRACTS
// ==========================================

export const createProductAdditionSchema = z.object({
  restaurantId: z.string().optional(), // Injected from JWT on backend
  productId: z.string().optional(), // NULL/optional = global addition for restaurant
  name: z.string().min(1, 'Addition name is required'),
  price: z.number().nonnegative('Price must be greater than or equal to 0').default(0),
  isAvailable: z.boolean().default(true),
  displayOrder: z.number().optional().default(0),
});
export type CreateProductAdditionInput = z.infer<typeof createProductAdditionSchema>;

export const updateProductAdditionSchema = createProductAdditionSchema.partial();
export type UpdateProductAdditionInput = z.infer<typeof updateProductAdditionSchema>;

export const productAdditionDTOSchema = createProductAdditionSchema.extend({
  id: z.string(),
  restaurantId: z.string(),
});
export type ProductAdditionDTO = z.infer<typeof productAdditionDTOSchema>;


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

export const orderItemAdditionInputSchema = z.object({
  additionId: z.string().min(1, 'Addition ID is required'),
  quantity: z.number().int().positive().optional().default(1),
});
export type OrderItemAdditionInput = z.infer<typeof orderItemAdditionInputSchema>;

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  productName: z.string().optional(),
  name: z.string().optional(),
  unitPrice: z.number().nonnegative().optional(),
  price: z.number().nonnegative().optional(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  observation: z.string().optional(),
  additions: z.array(z.union([z.string(), orderItemAdditionInputSchema])).default([]),
}).passthrough();
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const orderCustomerInputSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  barrio: z.string().optional(),
  email: z.string().optional(),
});
export type OrderCustomerInput = z.infer<typeof orderCustomerInputSchema>;

export const createOrderSchema = z.object({
  restaurantId: z.string().min(1, 'Restaurant ID is required'),
  customerId: z.string().optional(),
  customer: orderCustomerInputSchema.optional(),
  items: z.array(orderItemInputSchema).min(1, 'Order must have at least one item').max(100, 'Order cannot exceed 100 items'),
  deliveryFee: z.number().nonnegative().optional(),
  paymentMethod: z.enum(['Efectivo', 'Transferencia']).optional(),
  paymentAmount: z.number().nonnegative().optional(),
  changeAmount: z.number().nonnegative().optional(),
  comment: z.string().optional(),
  receiptUrl: z.string().optional(),
  // Staff "Mesa / Salón" sales only: the restaurant table the sale was taken on.
  // The public storefront never sends it (the API rejects it for guests).
  tableId: z.string().min(1).max(64).optional(),
  // SUS-19: client-generated correlation id for idempotent order creation.
  // The frontend generates one per sale attempt and reuses it on offline
  // retries; the server replays (returns) an order already persisted for the
  // same (restaurantId, clientOrderId) instead of inserting a duplicate.
  clientOrderId: z.string().min(1).max(100).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const updateOrderReceiptSchema = z.object({
  receiptUrl: z.string().min(1, 'Receipt URL is required'),
});
export type UpdateOrderReceiptInput = z.infer<typeof updateOrderReceiptSchema>;

export const updateOrderSchema = z.object({
  customer: orderCustomerInputSchema.optional(),
  items: z.array(orderItemInputSchema).max(100, 'Order cannot exceed 100 items').optional(),
  deliveryFee: z.number().nonnegative().optional(),
  paymentMethod: z.enum(['Efectivo', 'Transferencia']).optional(),
  paymentAmount: z.number().nonnegative().optional(),
  changeAmount: z.number().nonnegative().optional(),
  comment: z.string().optional(),
  // null detaches the order from its table.
  tableId: z.string().min(1).max(64).nullable().optional(),
  status: orderStatusEnum.optional(),
});
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

// ==========================================
// INVENTORY CONTRACTS
// ==========================================

export const updateInventoryStockSchema = z.object({
  quantityChange: z.number(),
});
export type UpdateInventoryStockInput = z.infer<typeof updateInventoryStockSchema>;

export const createSupplierSchema = z.object({
  id: z.string().optional(),
  restaurantId: z.string().optional(),
  name: z.string().min(1, 'Supplier name is required'),
  category: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

// ==========================================
// RESTAURANT TABLES (Mesa / Salón)
// ==========================================

export const MAX_TABLE_NAME_LENGTH = 40;

export const createRestaurantTableSchema = z.object({
  id: z.string().optional(),
  restaurantId: z.string().optional(),
  name: z.string().trim().min(1, 'El nombre de la mesa es obligatorio').max(MAX_TABLE_NAME_LENGTH, `El nombre de la mesa no puede superar ${MAX_TABLE_NAME_LENGTH} caracteres`),
  isActive: z.boolean().optional(),
});
export type CreateRestaurantTableInput = z.infer<typeof createRestaurantTableSchema>;

export const updateRestaurantTableSchema = createRestaurantTableSchema.omit({ id: true }).partial();
export type UpdateRestaurantTableInput = z.infer<typeof updateRestaurantTableSchema>;

export const reorderRestaurantTablesSchema = z.object({
  restaurantId: z.string().optional(),
  ids: z.array(z.string().min(1)).max(500),
});
export type ReorderRestaurantTablesInput = z.infer<typeof reorderRestaurantTablesSchema>;

// ==========================================
// REAL-TIME ORDER EVENTS (SSE)
// ==========================================

export const orderEventSchema = z.object({
  eventType: z.enum(['ORDER_CREATED', 'ORDER_STATUS_UPDATED', 'ORDER_CANCELLED', 'ORDER_RECEIPT_UPDATED', 'ORDER_DELETED', 'ORDER_UPDATED']),
  orderId: z.string(),
  orderNumber: z.number().optional(),
  status: orderStatusEnum.optional(),
  timestamp: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
});
export type OrderEvent = z.infer<typeof orderEventSchema>;

// ==========================================
// CUSTOMER CONTRACTS
// ==========================================

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().min(1, 'Customer phone is required'),
  address: z.string().optional(),
  barrio: z.string().optional(),
  notes: z.string().optional(),
  email: z.string().optional(),
  restaurantId: z.string().optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  barrio: z.string().optional(),
  notes: z.string().optional(),
  email: z.string().optional(),
  restaurantId: z.string().optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;



// ==========================================
// SUPER ADMIN AUDIT LOG
// ==========================================

/** Every super admin mutation recorded in the audit log. */
export const AUDIT_ACTIONS = [
  'restaurant.create',
  'restaurant.update',
  'restaurant.pause',
  'restaurant.activate',
  'restaurant.delete',
  'restaurant.restore',
  'user.create',
  'user.update',
  'user.activate',
  'user.deactivate',
  'user.delete',
  'user.reset_password',
] as const;
export const auditActionEnum = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof auditActionEnum>;

export const AUDIT_LOG_DEFAULT_LIMIT = 50;
export const AUDIT_LOG_MAX_LIMIT = 200;

/** Query string of GET /audit-log. Newest first; `cursor` is the opaque nextCursor of the previous page. */
export const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(AUDIT_LOG_MAX_LIMIT).default(AUDIT_LOG_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
  action: auditActionEnum.optional(),
  restaurantId: z.string().min(1).optional(),
  actorUserId: z.string().min(1).optional(),
  /** Inclusive lower bound (ISO 8601). */
  from: z.string().datetime({ offset: true }).optional(),
  /** Inclusive upper bound (ISO 8601). */
  to: z.string().datetime({ offset: true }).optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogItemSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  actorUserId: z.string().nullable(),
  actorUsername: z.string(),
  action: auditActionEnum,
  targetType: z.enum(['restaurant', 'user']),
  targetId: z.string(),
  targetLabel: z.string(),
  restaurantId: z.string().nullable(),
  /** Changed field names and non-secret before/after values; never credentials. */
  details: z.record(z.string(), z.unknown()),
});
export type AuditLogItem = z.infer<typeof auditLogItemSchema>;

export const auditLogPageSchema = z.object({
  items: z.array(auditLogItemSchema),
  nextCursor: z.string().nullable(),
});
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;

// ==========================================
// PLATFORM STATS (super admin)
// ==========================================

/** A real calendar date written as YYYY-MM-DD (UTC day). */
const isoCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    // Date rejects 2026-02-30 outright, but rolls 2026-02-29 over to March.
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Not a real calendar date');

/**
 * Query string of GET /platform-stats. `from`/`to` are inclusive UTC calendar
 * days and only narrow the ORDERS counted (revenue and order count); the
 * restaurant and customer totals are always the current platform totals.
 */
export const platformStatsQuerySchema = z
  .object({
    from: isoCalendarDate.optional(),
    to: isoCalendarDate.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '`from` must not be after `to`',
    path: ['from'],
  });
export type PlatformStatsQuery = z.infer<typeof platformStatsQuerySchema>;

/**
 * Platform-wide totals across live (not soft-deleted) restaurants.
 * totalRevenue sums final_total of non-cancelled orders; totalOrders counts
 * non-cancelled orders; cancelledOrders counts the cancelled ones. The orders
 * window (from/to) applies to all three.
 */
export const platformStatsSchema = z.object({
  totalRevenue: z.number().nonnegative(),
  totalOrders: z.number().int().nonnegative(),
  cancelledOrders: z.number().int().nonnegative(),
  totalCustomers: z.number().int().nonnegative(),
  totalRestaurants: z.number().int().nonnegative(),
  activeRestaurants: z.number().int().nonnegative(),
});
export type PlatformStats = z.infer<typeof platformStatsSchema>;

export * from './schedule.js';
