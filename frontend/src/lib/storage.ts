import type {
  Modifier,
  Order,
  OrderStatus,
  Product,
  Restaurant,
  RestaurantConfig,
  RestaurantPalette,
  StorageEnvelopeV2,
} from "./domain"
import type { RestaurantRepository } from "./repository"
import {
  DEFAULT_CONFIG,
  DEFAULT_PALETTE,
  DEFAULT_SUPER_ADMIN_PASSWORD,
  SEED_RESTAURANTS,
  initialModifiers,
  initialProducts,
} from "../data/data"
import { canTransition, createUniqueOrderId } from "./orders"

export const STORAGE_KEY = "burger-page:crm"
export const STORAGE_VERSION = 2

/**
 * Single storage envelope (design decision): atomic seed/migrate/persist,
 * no orphan states. Missing storage seeds from data.ts; stale versions run
 * the migration chain (v0/v1 → v2), which wraps legacy data into the first
 * restaurant (slug `burger-page`); corrupt envelopes reseed.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isV2Envelope(value: unknown): value is StorageEnvelopeV2 {
  if (!isRecord(value)) return false
  return (
    typeof value.superAdminPassword === "string" &&
    Array.isArray(value.restaurants) &&
    value.restaurants.length > 0 &&
    value.restaurants.every(
      (r) =>
        isRecord(r) &&
        typeof r.id === "string" &&
        typeof r.slug === "string" &&
        isRecord(r.config) &&
        isRecord(r.palette) &&
        Array.isArray(r.products) &&
        Array.isArray(r.modifiers) &&
        Array.isArray(r.orders)
    )
  )
}

export class LocalStorageRepository implements RestaurantRepository {
  constructor(
    private readonly store: Storage,
    private readonly restaurantId?: string
  ) {}

  getConfig(): RestaurantConfig {
    const restaurant = this.restaurant(this.read())
    // Accent's single source of truth is palette.accent (design D1).
    return { ...restaurant.config, accent: restaurant.palette.accent }
  }

  saveConfig(config: RestaurantConfig): void {
    const envelope = this.read()
    const restaurant = this.restaurant(envelope)
    restaurant.config = config
    restaurant.palette.accent = config.accent
    this.persist(envelope)
  }

  listProducts(): Product[] {
    return this.restaurant(this.read()).products
  }

  saveProduct(product: Product): void {
    const envelope = this.read()
    const restaurant = this.restaurant(envelope)
    const index = restaurant.products.findIndex((p) => p.id === product.id)
    if (index === -1) {
      restaurant.products.push(product)
    } else {
      restaurant.products[index] = product
    }
    this.persist(envelope)
  }

  deleteProduct(id: string): void {
    const envelope = this.read()
    const restaurant = this.restaurant(envelope)
    restaurant.products = restaurant.products.filter((p) => p.id !== id)
    this.persist(envelope)
  }

  listModifiers(): Modifier[] {
    return this.restaurant(this.read()).modifiers
  }

  saveModifier(modifier: Modifier): void {
    const envelope = this.read()
    const restaurant = this.restaurant(envelope)
    const index = restaurant.modifiers.findIndex((m) => m.id === modifier.id)
    if (index === -1) {
      restaurant.modifiers.push(modifier)
    } else {
      restaurant.modifiers[index] = modifier
    }
    this.persist(envelope)
  }

  deleteModifier(id: string): void {
    const envelope = this.read()
    const restaurant = this.restaurant(envelope)
    restaurant.modifiers = restaurant.modifiers.filter((m) => m.id !== id)
    this.persist(envelope)
  }

  listOrders(): Order[] {
    return this.restaurant(this.read()).orders
  }

  saveOrder(order: Omit<Order, "id" | "status" | "createdAt">): Order {
    const envelope = this.read()
    const restaurant = this.restaurant(envelope)
    const used = new Set(restaurant.orders.map((o) => o.id))
    const saved: Order = {
      ...order,
      id: createUniqueOrderId(used),
      status: "new",
      createdAt: new Date().toISOString(),
    }
    restaurant.orders.push(saved)
    this.persist(envelope)
    return saved
  }

  updateOrderStatus(id: number, next: OrderStatus): boolean {
    const envelope = this.read()
    const restaurant = this.restaurant(envelope)
    const order = restaurant.orders.find((o) => o.id === id)
    if (!order || !canTransition(order.status, next)) return false
    order.status = next
    this.persist(envelope)
    return true
  }

  /** Scoped view: the configured restaurant, or the first one (legacy default). */
  private restaurant(envelope: StorageEnvelopeV2): Restaurant {
    const match = this.restaurantId
      ? envelope.restaurants.find((r) => r.id === this.restaurantId)
      : undefined
    return match ?? envelope.restaurants[0]
  }

  private read(): StorageEnvelopeV2 {
    const raw = this.store.getItem(STORAGE_KEY)
    if (raw === null) return this.seed()
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed)) return this.seed()
      const version = typeof parsed.version === "number" ? parsed.version : 0
      if (version < STORAGE_VERSION) return this.migrate(parsed)
      if (version === STORAGE_VERSION && isV2Envelope(parsed)) return parsed
      // Unknown future version: forward-compatible pass-through. Corrupt v2
      // shape or garbage: reseed (current behavior preserved).
      if (version > STORAGE_VERSION) return parsed as unknown as StorageEnvelopeV2
      return this.seed()
    } catch {
      // Corrupt storage: reset to seed (rollback boundary for every slice).
      return this.seed()
    }
  }

  private persist(envelope: StorageEnvelopeV2): void {
    this.store.setItem(STORAGE_KEY, JSON.stringify(envelope))
  }

  private seed(): StorageEnvelopeV2 {
    const envelope: StorageEnvelopeV2 = {
      version: STORAGE_VERSION,
      superAdminPassword: DEFAULT_SUPER_ADMIN_PASSWORD,
      // Copy collections so runtime writes never mutate the seed module data.
      restaurants: SEED_RESTAURANTS.map((r) => ({
        ...r,
        products: r.products.map((p) => ({ ...p })),
        modifiers: r.modifiers.map((m) => ({ ...m })),
        orders: [],
      })),
    }
    this.persist(envelope)
    return envelope
  }

  /**
   * Migrates older envelopes (v0/v1) to the current version without losing
   * stored data: legacy config/products/modifiers/orders become the first
   * restaurant (slug `burger-page`), with palette derived from config.accent
   * plus default background/surface (design D1, spec MT-1).
   */
  private migrate(raw: Record<string, unknown>): StorageEnvelopeV2 {
    const config: RestaurantConfig = isRecord(raw.config)
      ? { ...DEFAULT_CONFIG, ...raw.config }
      : DEFAULT_CONFIG
    const palette: RestaurantPalette = {
      accent: config.accent,
      primary: config.accent,
      background: DEFAULT_PALETTE.background,
      surface: DEFAULT_PALETTE.surface,
    }
    const envelope: StorageEnvelopeV2 = {
      version: STORAGE_VERSION,
      superAdminPassword: DEFAULT_SUPER_ADMIN_PASSWORD,
      restaurants: [
        {
          id: "rest-burger-page",
          slug: "burger-page",
          config,
          palette,
          products: Array.isArray(raw.products)
            ? (raw.products as Product[])
            : initialProducts,
          modifiers: Array.isArray(raw.modifiers)
            ? (raw.modifiers as Modifier[])
            : initialModifiers,
          orders: Array.isArray(raw.orders) ? (raw.orders as Order[]) : [],
        },
      ],
    }
    this.persist(envelope)
    return envelope
  }
}

/** App-wide repository singleton used by the storefront and admin pages. */
export const storage = new LocalStorageRepository(window.localStorage)