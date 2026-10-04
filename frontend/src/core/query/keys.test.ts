import { describe, it, expect } from "vitest"
import { keys, keyPrefixes } from "./keys"

describe("query key factory", () => {
  it("builds tenant-scoped keys with the tenant id and the session role", () => {
    expect(keys.orders("rest-1", "restaurant")).toEqual(["orders", "rest-1", "restaurant"])
    expect(keys.inventory("rest-1", "super")).toEqual(["inventory", "rest-1", "super"])
    expect(keys.suppliers("rest-1", "guest")).toEqual(["suppliers", "rest-1", "guest"])
    expect(keys.tables("rest-1", "restaurant")).toEqual(["tables", "rest-1", "restaurant"])
    expect(keys.products("rest-1", "guest", "burger")).toEqual(["products", "rest-1", "guest", "burger"])
    expect(keys.additions("rest-1", "guest", undefined)).toEqual(["additions", "rest-1", "guest", undefined])
  })

  it("builds directory keys with the session role", () => {
    expect(keys.restaurants("super")).toEqual(["restaurants", "super"])
    expect(keys.restaurant("guest", "burger")).toEqual(["restaurant", "guest", "burger"])
    expect(keys.restaurantStatus("guest", "burger")).toEqual(["restaurant-status", "guest", "burger"])
    expect(keys.users("super")).toEqual(["users", "super"])
    expect(keys.deletedRestaurants("super")).toEqual(["deleted-restaurants", "super"])
    expect(keys.auditLog("super", { action: "user.create" })).toEqual(["audit-log", "super", { action: "user.create" }])
    expect(keys.users("super", "rest-1")).toEqual(["users", "super", "rest-1"])
  })

  it("never lets two tenants or two roles share a key", () => {
    const tenantScoped = [keys.orders, keys.inventory, keys.suppliers, keys.tables] as const
    for (const build of tenantScoped) {
      expect(build("a", "restaurant")).not.toEqual(build("b", "restaurant"))
      expect(build("a", "restaurant")).not.toEqual(build("a", "super"))
    }
    expect(keys.products("a", "guest", "s")).not.toEqual(keys.products("a", "super", "s"))
    expect(keys.restaurants("guest")).not.toEqual(keys.restaurants("super"))
  })

  it("keeps the tenant id and role positions even when the tenant is unknown", () => {
    // Disabled queries still carry a full-length key: the slot is never dropped.
    expect(keys.orders(undefined, "guest")).toHaveLength(3)
    expect(keys.products(undefined, "guest", undefined)).toHaveLength(4)
  })

  it("exposes per-resource prefixes that match every key of that tenant", () => {
    const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
      prefix.every((part, i) => key[i] === part)

    expect(startsWith(keys.orders("t", "super"), keyPrefixes.orders("t"))).toBe(true)
    expect(startsWith(keys.products("t", "super", "s"), keyPrefixes.products("t"))).toBe(true)
    expect(startsWith(keys.additions("t", "super", "s"), keyPrefixes.additions("t"))).toBe(true)
    expect(startsWith(keys.inventory("t", "super"), keyPrefixes.inventory("t"))).toBe(true)
    expect(startsWith(keys.suppliers("t", "super"), keyPrefixes.suppliers("t"))).toBe(true)
    expect(startsWith(keys.tables("t", "super"), keyPrefixes.tables("t"))).toBe(true)
    expect(startsWith(keys.restaurants("super"), keyPrefixes.restaurants())).toBe(true)
    expect(startsWith(keys.restaurant("super", "x"), keyPrefixes.restaurant())).toBe(true)
    expect(startsWith(keys.restaurantStatus("super", "x"), keyPrefixes.restaurantStatus())).toBe(true)
    expect(startsWith(keys.users("super", "r"), keys.users("super"))).toBe(true)
    expect(startsWith(keys.users("super"), keyPrefixes.users())).toBe(true)
    expect(startsWith(keys.deletedRestaurants("super"), keyPrefixes.deletedRestaurants())).toBe(true)
    // A tenant prefix never matches another tenant's key.
    expect(startsWith(keys.orders("other", "super"), keyPrefixes.orders("t"))).toBe(false)
  })
})
