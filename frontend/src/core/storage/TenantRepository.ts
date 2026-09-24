import type { RestaurantRecord, StorageEnvelopeV2 } from "@/types/restaurant"
import { type StorageAdapter, LocalStorageAdapter } from "./StorageAdapter"

export const STORAGE_KEYS = {
  ENVELOPE: "burger_page_platform_v2",
  ACTIVE_REST: "burger_page_active_rest_v2",
} as const

export const DEFAULT_ENVELOPE: StorageEnvelopeV2 = {
  version: 2,
  restaurants: [],
}

export class TenantRepository {
  private adapter: StorageAdapter

  constructor(adapter: StorageAdapter = new LocalStorageAdapter()) {
    this.adapter = adapter
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
          const migratedRestaurants = parsed.restaurants.map((r) => {
            if (!r.categories || r.categories.length === 0) {
              const fromProducts = Array.from(new Set((r.products || []).map((p) => p.category).filter(Boolean)))
              return {
                ...r,
                categories: fromProducts.length > 0 ? fromProducts : ["Platos Principales"],
              }
            }
            return r
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

  getActiveRestaurantId(defaultId = "rest-burger-craft"): string {
    const saved = this.adapter.getItem(STORAGE_KEYS.ACTIVE_REST)
    return saved || defaultId
  }

  setActiveRestaurantId(id: string): void {
    this.adapter.setItem(STORAGE_KEYS.ACTIVE_REST, id)
  }

  /**
   * C3 tenant-isolation purge: removes the whole-platform envelope (orders,
   * customers, inventory, suppliers of every tenant) AND the persisted active
   * restaurant id at once, through the storage adapter. It is invoked only at
   * session end (logout) by AuthProvider's onLogout callback; guest/super
   * storefront caching is intentionally untouched because nothing calls this
   * outside the session-end path.
   */
  purgeTenantData(): void {
    try {
      this.adapter.removeItem(STORAGE_KEYS.ENVELOPE)
      this.adapter.removeItem(STORAGE_KEYS.ACTIVE_REST)
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
