import { describe, it, expect, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { persistQueryClientSave } from "@tanstack/react-query-persist-client"
import { keys, isPublicStorefrontKey } from "./keys"
import {
  PERSISTED_QUERIES_KEY,
  PERSIST_MAX_AGE,
  PERSIST_BUSTER,
  storefrontPersistOptions,
  clearPersistedQueries,
} from "./persistence"

describe("storefront query persistence", () => {
  beforeEach(() => localStorage.clear())

  it("whitelists only the guest storefront keys: restaurant record and public menu", () => {
    expect(isPublicStorefrontKey(keys.restaurant("guest", "burger"))).toBe(true)
    expect(isPublicStorefrontKey(keys.products("r1", "guest", "burger"))).toBe(true)
    expect(isPublicStorefrontKey(keys.additions("r1", "guest", "burger"))).toBe(true)

    // Anything keyed by a non-guest role, even the same resource.
    expect(isPublicStorefrontKey(keys.restaurant("super", "burger"))).toBe(false)
    expect(isPublicStorefrontKey(keys.products("r1", "restaurant", "burger"))).toBe(false)
    expect(isPublicStorefrontKey(keys.additions("r1", "super", "burger"))).toBe(false)
    // Auth-scoped resources, whatever the role.
    for (const key of [
      keys.orders("r1", "guest"),
      keys.inventory("r1", "guest"),
      keys.suppliers("r1", "guest"),
      keys.tables("r1", "guest"),
      keys.restaurants("guest"),
      keys.deletedRestaurants("guest"),
      keys.users("guest"),
      keys.auditLog("guest", {}),
      keys.restaurantStatus("guest", "burger"),
    ]) {
      expect(isPublicStorefrontKey(key)).toBe(false)
    }
  })

  it("never writes auth-scoped queries to storage", async () => {
    const client = new QueryClient()
    client.setQueryData(keys.products("r1", "guest", "burger"), [{ id: "p1" }])
    client.setQueryData(keys.restaurant("guest", "burger"), { id: "r1", slug: "burger" })
    client.setQueryData(keys.orders("r1", "restaurant"), { orders: [{ id: "o1" }], customers: [] })
    client.setQueryData(keys.orders("r1", "guest"), { orders: [{ id: "o2" }], customers: [] })
    client.setQueryData(keys.inventory("r1", "restaurant"), [{ id: "i1" }])
    client.setQueryData(keys.suppliers("r1", "restaurant"), [{ id: "s1" }])
    client.setQueryData(keys.users("super"), [{ id: "u1" }])
    client.setQueryData(keys.restaurants("super"), [{ id: "r1" }])
    client.setQueryData(keys.products("r1", "restaurant", "burger"), [{ id: "p-admin" }])

    await persistQueryClientSave({ queryClient: client, ...storefrontPersistOptions })
    // The storage persister throttles its writes.
    await waitFor(() => expect(localStorage.getItem(PERSISTED_QUERIES_KEY)).not.toBeNull(), { timeout: 3000 })

    const stored = JSON.parse(localStorage.getItem(PERSISTED_QUERIES_KEY)!)
    const storedKeys = stored.clientState.queries.map((q: any) => q.queryKey)
    expect(storedKeys).toHaveLength(2)
    expect(storedKeys).toContainEqual(keys.products("r1", "guest", "burger"))
    expect(storedKeys).toContainEqual(keys.restaurant("guest", "burger"))
    expect(stored.buster).toBe(PERSIST_BUSTER)
  })

  it("keeps the persisted cache for 24h with a cache version buster", () => {
    expect(PERSIST_MAX_AGE).toBe(24 * 60 * 60 * 1000)
    expect(storefrontPersistOptions.maxAge).toBe(PERSIST_MAX_AGE)
    expect(storefrontPersistOptions.buster).toBe(PERSIST_BUSTER)
  })

  it("clearPersistedQueries removes the stored cache", async () => {
    const client = new QueryClient()
    client.setQueryData(keys.products("r1", "guest", "burger"), [{ id: "p1" }])
    await persistQueryClientSave({ queryClient: client, ...storefrontPersistOptions })
    await waitFor(() => expect(localStorage.getItem(PERSISTED_QUERIES_KEY)).not.toBeNull(), { timeout: 3000 })

    await clearPersistedQueries()
    expect(localStorage.getItem(PERSISTED_QUERIES_KEY)).toBeNull()
  })
})
