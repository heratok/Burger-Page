import { describe, it, expect } from "vitest"
import { resolveRoute } from "./useAppRouter"
import type { RestaurantRecord } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/data/initialData"

const mockRestaurants: RestaurantRecord[] = [
  {
    id: "rest-burger-craft",
    slug: "burger-craft",
    isActive: true,
    createdAt: "2026-08-01T12:00:00.000Z",
    config: DEFAULT_STORE_CONFIG,
    products: [],
    additions: [],
    orders: [],
    customers: [],
  },
  {
    id: "rest-pizzeria-napoli",
    slug: "pizzeria-napoli",
    isActive: true,
    createdAt: "2026-08-05T15:00:00.000Z",
    config: DEFAULT_STORE_CONFIG,
    products: [],
    additions: [],
    orders: [],
    customers: [],
  },
  {
    id: "rest-tacos-el-rey",
    slug: "tacos-el-rey",
    isActive: true,
    createdAt: "2026-08-10T10:00:00.000Z",
    config: DEFAULT_STORE_CONFIG,
    products: [],
    additions: [],
    orders: [],
    customers: [],
  },
]

describe("Router Engine - resolveRoute", () => {
  it("resolves root path '/' as platform landing page", () => {
    const res = resolveRoute("/", mockRestaurants)
    expect(res.view).toBe("landing")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves '/admin' path as admin backoffice without specific tab", () => {
    const res = resolveRoute("/admin", mockRestaurants)
    expect(res.view).toBe("admin")
    expect(res.adminTab).toBeUndefined()
    expect(res.isNotFound).toBe(false)
  })

  it("resolves '/admin/orders' path with adminTab 'orders'", () => {
    const res = resolveRoute("/admin/orders", mockRestaurants)
    expect(res.view).toBe("admin")
    expect(res.adminTab).toBe("orders")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves '/admin/menu', '/admin/inventory', '/admin/customizer' paths correctly", () => {
    expect(resolveRoute("/admin/menu", mockRestaurants).adminTab).toBe("menu")
    expect(resolveRoute("/admin/inventory", mockRestaurants).adminTab).toBe("inventory")
    expect(resolveRoute("/admin/customizer", mockRestaurants).adminTab).toBe("customizer")
    expect(resolveRoute("/admin/customers", mockRestaurants).adminTab).toBe("customers")
    expect(resolveRoute("/admin/restaurants", mockRestaurants).adminTab).toBe("restaurants")
  })

  it("resolves admin subroutes case-insensitively with slashes", () => {
    const res = resolveRoute("///ADMIN/ORDERS///", mockRestaurants)
    expect(res.view).toBe("admin")
    expect(res.adminTab).toBe("orders")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves registered tenant slug to the matching restaurant ID", () => {
    const res = resolveRoute("/pizzeria-napoli", mockRestaurants)
    expect(res.view).toBe("store")
    expect(res.restaurantId).toBe("rest-pizzeria-napoli")
    expect(res.isNotFound).toBe(false)
  })

  it("resolves slug case-insensitively with leading and trailing slashes", () => {
    const res = resolveRoute("///TACOS-EL-REY///", mockRestaurants)
    expect(res.view).toBe("store")
    expect(res.restaurantId).toBe("rest-tacos-el-rey")
    expect(res.isNotFound).toBe(false)
  })

  it("marks unregistered slug as not found", () => {
    const res = resolveRoute("/unknown-restaurant-123", mockRestaurants)
    expect(res.view).toBe("not-found")
    expect(res.isNotFound).toBe(true)
    expect(res.attemptedSlug).toBe("unknown-restaurant-123")
  })

  it("marks invalid admin subroute as not found", () => {
    const res = resolveRoute("/admin/invalid-tab", mockRestaurants)
    expect(res.view).toBe("not-found")
    expect(res.isNotFound).toBe(true)
    expect(res.attemptedSlug).toBe("admin/invalid-tab")
  })
})
