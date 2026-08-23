import { describe, it, expect } from "vitest"
import { resolveRoute } from "./useAppRouter"
import { SEED_RESTAURANTS } from "@/data/initialData"

describe("Router Engine - resolveRoute", () => {
  it("resolves root path '/' as platform landing page", () => {
    const res = resolveRoute("/", SEED_RESTAURANTS)
    expect(res.view).toBe("landing")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves '/admin' path as admin backoffice without specific tab", () => {
    const res = resolveRoute("/admin", SEED_RESTAURANTS)
    expect(res.view).toBe("admin")
    expect(res.adminTab).toBeUndefined()
    expect(res.isNotFound).toBe(false)
  })

  it("resolves '/admin/orders' path with adminTab 'orders'", () => {
    const res = resolveRoute("/admin/orders", SEED_RESTAURANTS)
    expect(res.view).toBe("admin")
    expect(res.adminTab).toBe("orders")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves '/admin/menu', '/admin/inventory', '/admin/customizer' paths correctly", () => {
    expect(resolveRoute("/admin/menu", SEED_RESTAURANTS).adminTab).toBe("menu")
    expect(resolveRoute("/admin/inventory", SEED_RESTAURANTS).adminTab).toBe("inventory")
    expect(resolveRoute("/admin/customizer", SEED_RESTAURANTS).adminTab).toBe("customizer")
    expect(resolveRoute("/admin/customers", SEED_RESTAURANTS).adminTab).toBe("customers")
    expect(resolveRoute("/admin/restaurants", SEED_RESTAURANTS).adminTab).toBe("restaurants")
  })

  it("resolves admin subroutes case-insensitively with slashes", () => {
    const res = resolveRoute("///ADMIN/ORDERS///", SEED_RESTAURANTS)
    expect(res.view).toBe("admin")
    expect(res.adminTab).toBe("orders")
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

  it("marks invalid admin subroute as not found", () => {
    const res = resolveRoute("/admin/invalid-tab", SEED_RESTAURANTS)
    expect(res.view).toBe("not-found")
    expect(res.isNotFound).toBe(true)
    expect(res.attemptedSlug).toBe("admin/invalid-tab")
  })
})
