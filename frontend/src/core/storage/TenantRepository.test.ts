import { describe, it, expect, beforeEach } from "vitest"
import { TenantRepository, STORAGE_KEYS } from "./TenantRepository"
import { InMemoryStorageAdapter } from "./StorageAdapter"
import { PendingOrdersQueue } from "./pendingOrdersQueue"
import { TEST_STORAGE_ENVELOPE, readPersistedQuery } from "@/test/fixtures"
import { keys } from "@/core/query/keys"
import { PERSISTED_QUERIES_KEY } from "@/core/query/persistence"
import type { RestaurantRecord } from "@/types/restaurant"

describe("TenantRepository: active restaurant and legacy envelope retirement", () => {
  let adapter: InMemoryStorageAdapter
  let queue: PendingOrdersQueue
  let repo: TenantRepository

  beforeEach(() => {
    localStorage.clear()
    adapter = new InMemoryStorageAdapter()
    queue = new PendingOrdersQueue(adapter)
    repo = new TenantRepository(adapter, queue)
  })

  const seedLegacy = (envelope: unknown) => adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(envelope))

  it("persists and retrieves the active restaurant id (the only tenant state it keeps)", () => {
    repo.setActiveRestaurantId("rest-test-123")
    expect(repo.getActiveRestaurantId()).toBe("rest-test-123")
  })

  it("exposes no envelope read/write API any more", () => {
    expect("loadEnvelope" in repo).toBe(false)
    expect("saveEnvelope" in repo).toBe(false)
    expect("findRestaurant" in repo).toBe(false)
  })

  it("moves a legacy envelope's public storefront data to the persisted cache and removes the envelope", () => {
    seedLegacy(TEST_STORAGE_ENVELOPE)

    repo.migrateLegacyEnvelope()

    expect(adapter.getItem(STORAGE_KEYS.ENVELOPE)).toBeNull()
    const legacy = TEST_STORAGE_ENVELOPE.restaurants[0]
    const record = readPersistedQuery<RestaurantRecord>(keys.restaurant("guest", legacy.slug))
    expect(record?.id).toBe(legacy.id)
    expect(record?.config.name).toBe(legacy.config.name)
    expect(readPersistedQuery(keys.products(legacy.id, "guest", legacy.slug))).toEqual(legacy.products)
  })

  it("never carries orders, customers, stock, suppliers or the admin password over", () => {
    seedLegacy({
      version: 2,
      superAdminPassword: "platform-secret",
      restaurants: TEST_STORAGE_ENVELOPE.restaurants.map((r) => ({ ...r, adminPassword: "legacy-secret" })),
    })

    repo.migrateLegacyEnvelope()

    const persisted = localStorage.getItem(PERSISTED_QUERIES_KEY) ?? ""
    expect(persisted).not.toContain("secret")
    for (const r of TEST_STORAGE_ENVELOPE.restaurants) {
      for (const o of r.orders ?? []) expect(persisted).not.toContain(o.id)
      for (const c of r.customers ?? []) expect(persisted).not.toContain(c.telefono)
      for (const i of r.inventory ?? []) expect(persisted).not.toContain(i.name)
      for (const s of r.suppliers ?? []) expect(persisted).not.toContain(s.name)
    }
  })

  it("moves legacy pendingSync sales to the pending-orders queue", () => {
    const [first] = TEST_STORAGE_ENVELOPE.restaurants
    seedLegacy({
      version: 2,
      restaurants: [{ ...first, orders: [{ ...first.orders![0], id: "ord-offline", pendingSync: true }] }],
    })

    repo.migrateLegacyEnvelope()

    expect(queue.list(first.id).map((o) => o.id)).toEqual(["ord-offline"])
  })

  it("derives categories from the legacy products when the record has none", () => {
    seedLegacy({
      version: 2,
      restaurants: [
        {
          id: "rest-1",
          slug: "rest-1",
          products: [{ category: "Burgers" }, { category: "Bebidas" }, { category: "Burgers" }],
        },
      ],
    })

    repo.migrateLegacyEnvelope()

    expect(readPersistedQuery<RestaurantRecord>(keys.restaurant("guest", "rest-1"))?.categories).toEqual([
      "Burgers",
      "Bebidas",
    ])
  })

  it("drops a corrupted legacy envelope without failing", () => {
    adapter.setItem(STORAGE_KEYS.ENVELOPE, "{not-json")
    expect(() => repo.migrateLegacyEnvelope()).not.toThrow()
    expect(adapter.getItem(STORAGE_KEYS.ENVELOPE)).toBeNull()
  })
})

describe("TenantRepository purgeTenantData (C3 isolation)", () => {
  let adapter: InMemoryStorageAdapter
  let repo: TenantRepository

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter()
    repo = new TenantRepository(adapter)
  })

  it("removes BOTH the whole-tenant envelope and the persisted active restaurant id", () => {
    adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
    adapter.setItem(STORAGE_KEYS.ACTIVE_REST, "rest-pizzeria-napoli")

    repo.purgeTenantData()

    expect(adapter.getItem(STORAGE_KEYS.ENVELOPE)).toBeNull()
    expect(adapter.getItem(STORAGE_KEYS.ACTIVE_REST)).toBeNull()
  })

  it("leaves unrelated storage keys untouched (session/UI keys survive)", () => {
    adapter.setItem("burger_page_sidebar_collapsed", "true")
    adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))

    repo.purgeTenantData()

    expect(adapter.getItem("burger_page_sidebar_collapsed")).toBe("true")
    expect(adapter.getItem(STORAGE_KEYS.ENVELOPE)).toBeNull()
  })

  it("is idempotent when nothing is stored", () => {
    expect(() => repo.purgeTenantData()).not.toThrow()
    expect(adapter.getItem(STORAGE_KEYS.ENVELOPE)).toBeNull()
    expect(adapter.getItem(STORAGE_KEYS.ACTIVE_REST)).toBeNull()
  })
})
