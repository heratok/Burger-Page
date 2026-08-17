import type {
  Modifier,
  Order,
  OrderStatus,
  Product,
  RestaurantConfig,
} from "./domain"
import type { RestaurantRepository } from "./repository"
import { DEFAULT_CONFIG, initialModifiers, initialProducts } from "../data/data"
import { canTransition, createUniqueOrderId } from "./orders"

export const STORAGE_KEY = "burger-page:crm"
export const STORAGE_VERSION = 1

/**
 * Single storage envelope (design decision): atomic seed/migrate/persist,
 * no orphan states. Missing storage seeds from data.ts; stale versions run
 * the migration chain (v1 only today).
 */
interface StorageEnvelope {
  version: number
  config: RestaurantConfig
  products: Product[]
  modifiers: Modifier[]
  orders: Order[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export class LocalStorageRepository implements RestaurantRepository {
  constructor(private readonly store: Storage) {}

  getConfig(): RestaurantConfig {
    return this.read().config
  }

  saveConfig(config: RestaurantConfig): void {
    const envelope = this.read()
    envelope.config = config
    this.persist(envelope)
  }

  listProducts(): Product[] {
    return this.read().products
  }

  saveProduct(product: Product): void {
    const envelope = this.read()
    const index = envelope.products.findIndex((p) => p.id === product.id)
    if (index === -1) {
      envelope.products.push(product)
    } else {
      envelope.products[index] = product
    }
    this.persist(envelope)
  }

  deleteProduct(id: string): void {
    const envelope = this.read()
    envelope.products = envelope.products.filter((p) => p.id !== id)
    this.persist(envelope)
  }

  listModifiers(): Modifier[] {
    return this.read().modifiers
  }

  saveModifier(modifier: Modifier): void {
    const envelope = this.read()
    const index = envelope.modifiers.findIndex((m) => m.id === modifier.id)
    if (index === -1) {
      envelope.modifiers.push(modifier)
    } else {
      envelope.modifiers[index] = modifier
    }
    this.persist(envelope)
  }

  deleteModifier(id: string): void {
    const envelope = this.read()
    envelope.modifiers = envelope.modifiers.filter((m) => m.id !== id)
    this.persist(envelope)
  }

  listOrders(): Order[] {
    return this.read().orders
  }

  saveOrder(order: Omit<Order, "id" | "status" | "createdAt">): Order {
    const envelope = this.read()
    const used = new Set(envelope.orders.map((o) => o.id))
    const saved: Order = {
      ...order,
      id: createUniqueOrderId(used),
      status: "new",
      createdAt: new Date().toISOString(),
    }
    envelope.orders.push(saved)
    this.persist(envelope)
    return saved
  }

  updateOrderStatus(id: number, next: OrderStatus): boolean {
    const envelope = this.read()
    const order = envelope.orders.find((o) => o.id === id)
    if (!order || !canTransition(order.status, next)) return false
    order.status = next
    this.persist(envelope)
    return true
  }

  private read(): StorageEnvelope {
    const raw = this.store.getItem(STORAGE_KEY)
    if (raw === null) return this.seed()
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed)) return this.seed()
      const version = typeof parsed.version === "number" ? parsed.version : 0
      if (version < STORAGE_VERSION) return this.migrate(parsed)
      return parsed as unknown as StorageEnvelope
    } catch {
      // Corrupt storage: reset to seed (rollback boundary for every slice).
      return this.seed()
    }
  }

  private persist(envelope: StorageEnvelope): void {
    this.store.setItem(STORAGE_KEY, JSON.stringify(envelope))
  }

  private seed(): StorageEnvelope {
    const envelope: StorageEnvelope = {
      version: STORAGE_VERSION,
      config: DEFAULT_CONFIG,
      products: initialProducts,
      modifiers: initialModifiers,
      orders: [],
    }
    this.persist(envelope)
    return envelope
  }

  /** Migrates older envelopes to the current version without losing stored data. */
  private migrate(raw: Record<string, unknown>): StorageEnvelope {
    const envelope: StorageEnvelope = {
      version: STORAGE_VERSION,
      config: isRecord(raw.config)
        ? { ...DEFAULT_CONFIG, ...raw.config }
        : DEFAULT_CONFIG,
      products: Array.isArray(raw.products)
        ? (raw.products as Product[])
        : initialProducts,
      modifiers: Array.isArray(raw.modifiers)
        ? (raw.modifiers as Modifier[])
        : initialModifiers,
      orders: Array.isArray(raw.orders) ? (raw.orders as Order[]) : [],
    }
    this.persist(envelope)
    return envelope
  }
}

/** App-wide repository singleton used by the storefront and admin pages. */
export const storage = new LocalStorageRepository(window.localStorage)