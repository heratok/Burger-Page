import type { RestaurantRecord, StorageEnvelopeV2 } from "@/types/restaurant"
import { type StorageAdapter, LocalStorageAdapter } from "./StorageAdapter"
import { PendingOrdersQueue, pendingOrdersQueue } from "./pendingOrdersQueue"
import { keys } from "@/core/query/keys"
import { writePersistedQueries } from "@/core/query/persistence"

export const STORAGE_KEYS = {
  ENVELOPE: "burger_page_platform_v2",
  ACTIVE_REST: "burger_page_active_rest_v2",
} as const

export const DEFAULT_ENVELOPE: StorageEnvelopeV2 = {
  version: 2,
  restaurants: [],
}

/**
 * Catalog, stock and suppliers persisted inside a tenant record by an older
 * version are dropped: they are server state now (query cache). Categories
 * stay: they are owner data of the tenant record.
 */
function dropServerState(record: RestaurantRecord): RestaurantRecord {
  const {
    products: _products,
    additions: _additions,
    inventory: _inventory,
    suppliers: _suppliers,
    ...rest
  } = record
  const changed = [_products, _additions, _inventory, _suppliers].some((field) => field !== undefined)
  return changed ? rest : record
}

export class TenantRepository {
  private adapter: StorageAdapter
  private pendingQueue: PendingOrdersQueue

  constructor(adapter: StorageAdapter = new LocalStorageAdapter(), pendingQueue: PendingOrdersQueue = pendingOrdersQueue) {
    this.adapter = adapter
    this.pendingQueue = pendingQueue
  }

  loadEnvelope(): StorageEnvelopeV2 {
    try {
      const raw = this.adapter.getItem(STORAGE_KEYS.ENVELOPE)
      if (raw) {
        const parsed = JSON.parse(raw) as StorageEnvelopeV2
        if (
          parsed.version === 2 &&
          Array.isArray(parsed.restaurants) &&
          parsed.restaurants.length > 0
        ) {
          const migratedRestaurants = parsed.restaurants.map((stored) => {
            let r = this.movePendingOrdersToQueue(stored)
            if (!r.categories || r.categories.length === 0) {
              const fromProducts = Array.from(new Set((r.products || []).map((p) => p.category).filter(Boolean)))
              // Derive from products, or keep it empty. A category the owner
              // never created must not be fabricated here.
              r = {
                ...r,
                categories: fromProducts,
              }
            }
            return dropServerState(r)
          })
          return {
            ...parsed,
            restaurants: migratedRestaurants,
          }
        }
      }
      return DEFAULT_ENVELOPE
    } catch {
      return DEFAULT_ENVELOPE
    }
  }

  /**
   * Orders and customers persisted inside a tenant record by an older version
   * are dropped: they are server state now (query cache). Offline sales
   * (pendingSync) among them move to the pending-orders queue first.
   */
  private movePendingOrdersToQueue(record: RestaurantRecord): RestaurantRecord {
    if (record.orders === undefined && record.customers === undefined) return record
    const orders = Array.isArray(record.orders) ? record.orders : []
    const pending = orders.filter((o) => o.pendingSync)
    // Oldest first, so the queue keeps the newest sale on top.
    for (const order of [...pending].reverse()) this.pendingQueue.add(record.id, order)
    const { orders: _serverOrders, customers: _serverCustomers, ...rest } = record
    return rest
  }

  /**
   * Retires the tenant envelope persisted by older versions (call once on
   * load): unsynced offline sales move to the pending-orders queue, the public
   * storefront data (restaurant records and menus, never orders, customers or
   * stock) moves to the persisted storefront query cache as stale data under
   * guest keys, and the envelope key is removed.
   */
  migrateLegacyEnvelope(): void {
    const raw = this.adapter.getItem(STORAGE_KEYS.ENVELOPE)
    if (raw === null) return
    try {
      const envelope = this.loadEnvelope()
      const legacy = (JSON.parse(raw)?.restaurants ?? []) as RestaurantRecord[]
      writePersistedQueries((client) => {
        envelope.restaurants.forEach((stored, i) => {
          // SUS-20: only the public fields move; a legacy record may still
          // carry the one-time admin password.
          const record: RestaurantRecord = {
            id: stored.id,
            slug: stored.slug,
            isActive: stored.isActive,
            createdAt: stored.createdAt,
            config: stored.config,
            categories: stored.categories ?? [],
          }
          const { products, additions } = legacy[i] ?? {}
          const options = { updatedAt: 0 }
          client.setQueryData(keys.restaurant("guest", record.id), record, options)
          client.setQueryData(keys.restaurant("guest", record.slug), record, options)
          if (products?.length) client.setQueryData(keys.products(record.id, "guest", record.slug), products, options)
          if (additions?.length) client.setQueryData(keys.additions(record.id, "guest", record.slug), additions, options)
        })
      })
    } catch (err) {
      console.error("Failed to migrate the legacy tenant envelope:", err)
    } finally {
      this.adapter.removeItem(STORAGE_KEYS.ENVELOPE)
    }
  }

  saveEnvelope(envelope: StorageEnvelopeV2): void {
    try {
      // SUS-20: the one-time admin password is a secret and must never be
      // persisted at rest inside the localStorage envelope. Sanitize at the
      // persistence boundary so that no caller (current or future) can leak
      // it into storage, even if a record still carries it in memory.
      const sanitized: StorageEnvelopeV2 = {
        ...envelope,
        restaurants: envelope.restaurants.map((r) => {
          const { adminPassword: _oneTimeSecret, ...safeRecord } = r
          return safeRecord
        }),
      }
      this.adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(sanitized))
    } catch (err) {
      console.error("Failed to save storage envelope to localStorage (quota exceeded or storage blocked):", err)
    }
  }

  getActiveRestaurantId(defaultId = ""): string {
    const saved = this.adapter.getItem(STORAGE_KEYS.ACTIVE_REST)
    return saved || defaultId
  }

  setActiveRestaurantId(id: string): void {
    this.adapter.setItem(STORAGE_KEYS.ACTIVE_REST, id)
  }

  /**
   * C3 tenant-isolation purge: removes the whole-platform envelope (orders,
   * customers, inventory, suppliers of every tenant), every tenant's queue of
   * unsynced offline sales AND the persisted active restaurant id at once. It is invoked only at
   * session end (logout) by AuthProvider's onLogout callback; guest/super
   * storefront caching is intentionally untouched because nothing calls this
   * outside the session-end path.
   */
  purgeTenantData(): void {
    try {
      this.adapter.removeItem(STORAGE_KEYS.ENVELOPE)
      this.adapter.removeItem(STORAGE_KEYS.ACTIVE_REST)
      this.pendingQueue.purge()
    } catch (err) {
      console.error("Failed to purge tenant data from storage:", err)
    }
  }

  findRestaurant(
    envelope: StorageEnvelopeV2,
    idOrSlug: string
  ): RestaurantRecord | undefined {
    return envelope.restaurants.find(
      (r) =>
        r.id.toLowerCase() === idOrSlug.toLowerCase() ||
        r.slug.toLowerCase() === idOrSlug.toLowerCase()
    )
  }
}

export const defaultTenantRepository = new TenantRepository()
