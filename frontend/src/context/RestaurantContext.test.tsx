import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
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
    vi.restoreAllMocks()
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

      it("authenticates as Super Admin through the backend", async () => {
        const { apiClient } = await import("@/core/api/apiClient")
        vi.spyOn(apiClient, "login").mockResolvedValue({
          success: true,
          token: "server-token",
          user: { id: "u1", username: "root", role: "super_admin" },
        } as any)
        const { result } = renderHook(() => useRestaurant(), { wrapper })

        expect(result.current.session.role).toBe("guest")

        await act(async () => {
          const auth = await result.current.login("root", "admin")
          expect(auth.success).toBe(true)
          expect(auth.role).toBe("super")
        })

        expect(result.current.session.role).toBe("super")
      })

      it("authenticates as Restaurant Admin through the backend", async () => {
        const { apiClient } = await import("@/core/api/apiClient")
        vi.spyOn(apiClient, "login").mockResolvedValue({
          success: true,
          token: "server-token",
          user: { id: "u2", username: "napoli", role: "restaurant_admin", restaurantId: "rest-pizzeria-napoli" },
        } as any)
        const { result } = renderHook(() => useRestaurant(), { wrapper })

        await act(async () => {
          const auth = await result.current.login("napoli", "napoli-pass")
          expect(auth.success).toBe(true)
          expect(auth.role).toBe("restaurant")
        })

        expect(result.current.session.role).toBe("restaurant")
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

  it("purges the whole-tenant envelope and persisted active restaurant from storage on logout (C3)", async () => {
    const adapter = new InMemoryStorageAdapter()
    adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
    adapter.setItem(STORAGE_KEYS.ACTIVE_REST, "rest-pizzeria-napoli")
    const repo = new TenantRepository(adapter)
    const purgeSpy = vi.spyOn(repo, "purgeTenantData")

    const w = ({ children }: { children: React.ReactNode }) => (
      <RestaurantProvider repository={repo}>{children}</RestaurantProvider>
    )
    const { result } = renderHook(() => useRestaurant(), { wrapper: w })

    expect(adapter.getItem(STORAGE_KEYS.ENVELOPE)).not.toBeNull()

    act(() => {
      result.current.logout()
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(purgeSpy).toHaveBeenCalledTimes(1)
    expect(adapter.getItem(STORAGE_KEYS.ENVELOPE)).toBeNull()
    expect(adapter.getItem(STORAGE_KEYS.ACTIVE_REST)).toBeNull()
  })

  it("derives effectiveRestaurantId from the session for restaurant admins, ignoring a stale persisted active restaurant, and binds first-render fetches to the session tenant (A1)", async () => {
    // Shared-browser scenario: a restaurant session restored next day while the
    // persisted activeRestaurant still points at a DIFFERENT tenant.
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({
        role: "restaurant",
        restaurantId: "rest-pizzeria-napoli",
        authenticatedAt: new Date().toISOString(),
      })
    )
    const adapter = new InMemoryStorageAdapter()
    adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
    adapter.setItem(STORAGE_KEYS.ACTIVE_REST, "rest-burger-craft")
    const repo = new TenantRepository(adapter)

    const { apiClient } = await import("@/core/api/apiClient")
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    // Keep the seeded envelope stable: the mount refresh must not rewrite it.
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))
    const fetchOrdersSpy = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([])
    const fetchCustomersSpy = vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])

    const w = ({ children }: { children: React.ReactNode }) => (
      <RestaurantProvider repository={repo}>{children}</RestaurantProvider>
    )
    const { result } = renderHook(() => useRestaurant(), { wrapper: w })

    // The stale persisted id never wins: session tenant wins for both the
    // derived value and the rendered active restaurant.
    expect(result.current.effectiveRestaurantId).toBe("rest-pizzeria-napoli")
    expect(result.current.activeRestaurantId).toBe("rest-pizzeria-napoli")
    expect(result.current.activeRestaurant.slug).toBe("pizzeria-napoli")

    // First-render order/customer fetch targets the SESSION tenant, never the
    // stale persisted rest-burger-craft.
    await waitFor(() => {
      expect(fetchOrdersSpy).toHaveBeenCalledWith("rest-pizzeria-napoli")
      expect(fetchCustomersSpy).toHaveBeenCalledWith("rest-pizzeria-napoli")
    })
    expect(fetchOrdersSpy).not.toHaveBeenCalledWith("rest-burger-craft")
  })

  it("keeps the persisted active restaurant for guest and super admin sessions (A1)", async () => {
    const adapter = new InMemoryStorageAdapter()
    adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
    adapter.setItem(STORAGE_KEYS.ACTIVE_REST, "rest-tacos-el-rey")
    const repo = new TenantRepository(adapter)

    const w = ({ children }: { children: React.ReactNode }) => (
      <RestaurantProvider repository={repo}>{children}</RestaurantProvider>
    )
    const { result } = renderHook(() => useRestaurant(), { wrapper: w })

    expect(result.current.effectiveRestaurantId).toBe("rest-tacos-el-rey")
    expect(result.current.activeRestaurant.slug).toBe("tacos-el-rey")

    // Same rule for super admin: the persisted switch must still win.
    act(() => {
      result.current.setSession({ role: "super", authenticatedAt: new Date().toISOString() })
    })
    expect(result.current.effectiveRestaurantId).toBe("rest-tacos-el-rey")
    expect(result.current.activeRestaurant.slug).toBe("tacos-el-rey")
  })

  it("prevents a restaurant admin from switching to another tenant, allowing only the session tenant (M5)", async () => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({
        role: "restaurant",
        restaurantId: "rest-burger-craft",
        authenticatedAt: new Date().toISOString(),
      })
    )
    const { result } = renderHook(() => useRestaurant(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestaurantProvider repository={createTestRepo()}>{children}</RestaurantProvider>
      ),
    })

    expect(result.current.activeRestaurant.slug).toBe("burger-craft")

    // Direct switch to another tenant (id or slug) is ignored.
    act(() => {
      result.current.switchRestaurant("rest-tacos-el-rey")
    })
    expect(result.current.activeRestaurant.slug).toBe("burger-craft")
    act(() => {
      result.current.switchRestaurant("pizzeria-napoli")
    })
    expect(result.current.activeRestaurant.slug).toBe("burger-craft")

    // Switching to the OWN tenant (by slug or id) still works.
    act(() => {
      result.current.switchRestaurant("rest-burger-craft")
    })
    expect(result.current.activeRestaurant.slug).toBe("burger-craft")
  })

  it("rejects creating a restaurant with a duplicate slug and persists nothing (M9)", async () => {
    const { apiClient } = await import("@/core/api/apiClient")
    const createSpy = vi.spyOn(apiClient, "createRestaurant")
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))
    const { toast } = await import("sonner")
    const errorSpy = vi.spyOn(toast, "error")

    const { result } = renderHook(() => useRestaurant(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestaurantProvider repository={createTestRepo()}>{children}</RestaurantProvider>
      ),
    })
    const before = result.current.restaurants.length

    let created: any
    act(() => {
      created = result.current.createRestaurant({
        name: "Burger Craft Duplicado",
        slug: "burger-craft",
        tagline: "Dup",
        whatsappNumber: "111",
      })
    })

    expect(created).toBeUndefined()
    expect(result.current.restaurants).toHaveLength(before)
    expect(result.current.restaurants.some((r) => r.config.name === "Burger Craft Duplicado")).toBe(false)
    expect(createSpy).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith("Ya existe un restaurante con ese slug")
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
