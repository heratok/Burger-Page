import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import React from "react"
import { RestaurantProvider, useRestaurant } from "./RestaurantContext"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"

const createTestRepo = () => {
  const adapter = new InMemoryStorageAdapter()
  adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  return new TenantRepository(adapter)
}

describe("RestaurantContext (Multi-Tenant & Super Admin)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RestaurantProvider repository={createTestRepo()}>{children}</RestaurantProvider>
  )

  it("initializes with 3 demo restaurants with distinct slugs and catalogs", () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    expect(result.current.restaurants.length).toBeGreaterThanOrEqual(3)
    const slugs = result.current.restaurants.map((r) => r.slug)
    expect(slugs).toContain("burger-craft")
    expect(slugs).toContain("pizzeria-napoli")
    expect(slugs).toContain("tacos-el-rey")
  })

  it("switches active restaurant by slug and scopes products accordingly", () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    // Initially Burger Craft
    expect(result.current.activeRestaurant.slug).toBe("burger-craft")
    expect(result.current.products.some((p) => p.name.includes("Burger"))).toBe(true)

    // Switch to Pizzería Di Napoli
    act(() => {
      result.current.switchRestaurant("pizzeria-napoli")
    })

    expect(result.current.activeRestaurant.slug).toBe("pizzeria-napoli")
    expect(result.current.products.some((p) => p.name.includes("Pizza"))).toBe(true)
    expect(result.current.storeConfig.primaryColor).toBe("#E63946")
  })

  it("authenticates as Super Admin with master password", () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    expect(result.current.session.role).toBe("guest")

    act(() => {
      const auth = result.current.login("admin")
      expect(auth.success).toBe(true)
      expect(auth.role).toBe("super")
    })

    expect(result.current.session.role).toBe("super")
  })

  it("authenticates as Local Restaurant Admin with local password", () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    act(() => {
      const auth = result.current.login("napoli", "rest-pizzeria-napoli")
      expect(auth.success).toBe(true)
      expect(auth.role).toBe("restaurant")
    })

    expect(result.current.session.role).toBe("restaurant")
    expect(result.current.activeRestaurant.slug).toBe("pizzeria-napoli")
  })

  it("creates a new restaurant and isolates its catalog", () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    let newRest: any
    act(() => {
      newRest = result.current.createRestaurant({
        name: "Sushi Master",
        slug: "sushi-master",
        tagline: "Rolls y nigiris artesanales",
        whatsappNumber: "573001112233",
        adminPassword: "sushi",
        templateType: "blank",
      })
    })

    expect(newRest).toBeDefined()
    expect(newRest.slug).toBe("sushi-master")
    expect(result.current.activeRestaurant.slug).toBe("sushi-master")
    expect(result.current.products).toHaveLength(0)

    // Add product to Sushi Master
    act(() => {
      result.current.addProduct({
        name: "Dragon Roll",
        price: 32000,
        category: "Rolls",
        src: "https://example.com/sushi.jpg",
        description: "Salmón, aguacate y queso crema",
        inStock: true,
      })
    })

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Dragon Roll")

    // Switch back to Burger Craft and verify Dragon Roll is not there
    act(() => {
      result.current.switchRestaurant("burger-craft")
    })

    expect(result.current.activeRestaurant.slug).toBe("burger-craft")
    expect(result.current.products.some((p) => p.name === "Dragon Roll")).toBe(false)
  })

  it("isolates orders and customer directory per restaurant", () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    const initialBurgerOrdersCount = result.current.orders.length

    // Add order to Burger Craft
    act(() => {
      result.current.addOrder({
        customer: {
          nombre: "Pedro Gómez",
          telefono: "3001234567",
          direccion: "Calle 100 # 15-20",
          barrio: "Chicó",
        },
        items: [
          {
            name: "Misisipi Burger",
            price: 27000,
            cantidad: 1,
            total: 27000,
          },
        ],
        total: 27000,
        deliveryFee: 4500,
        finalTotal: 31500,
        metodo: "Efectivo",
        status: "pending",
      })
    })

    expect(result.current.orders.length).toBe(initialBurgerOrdersCount + 1)
    expect(result.current.customers.some((c) => c.nombre === "Pedro Gómez")).toBe(true)

    // Switch to Tacos El Rey
    act(() => {
      result.current.switchRestaurant("tacos-el-rey")
    })

    // Verify Pedro Gómez is not in Tacos El Rey
    expect(result.current.customers.some((c) => c.nombre === "Pedro Gómez")).toBe(false)
  })
})
