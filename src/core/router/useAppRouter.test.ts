import { describe, it, expect } from "vitest"
import { resolveRoute } from "./useAppRouter"
import { SEED_RESTAURANTS } from "@/data/initialData"

describe("Router Engine - resolveRoute", () => {
  it("resolves root path '/' as public storefront", () => {
    const res = resolveRoute("/", SEED_RESTAURANTS)
    expect(res.view).toBe("store")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves '/admin' path as admin backoffice", () => {
    const res = resolveRoute("/admin", SEED_RESTAURANTS)
    expect(res.view).toBe("admin")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves registered tenant slug to the matching restaurant ID", () => {
    const res = resolveRoute("/pizzeria-napoli", SEED_RESTAURANTS)
    expect(res.view).toBe("store")
    expect(res.restaurantId).toBe("rest-pizzeria-napoli")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves slug case-insensitively with leading and trailing slashes", () => {
    const res = resolveRoute("///TACOS-EL-REY///", SEED_RESTAURANTS)
    expect(res.view).toBe("store")
    expect(res.restaurantId).toBe("rest-tacos-el-rey")
    expect(res.isNotFound).toBe(false)
  })

  it("marks unregistered slug as not found", () => {
    const res = resolveRoute("/unknown-restaurant-123", SEED_RESTAURANTS)
    expect(res.view).toBe("not-found")
    expect(res.isNotFound).toBe(true)
    expect(res.attemptedSlug).toBe("unknown-restaurant-123")
  })
})
