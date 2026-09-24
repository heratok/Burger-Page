import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import React from "react"
import { TenantProvider, useTenant } from "./TenantContext"
import { AuthProvider } from "./AuthContext"
import { apiClient } from "@/core/api/apiClient"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

describe("TenantContext - Backend Multi-Tenant Integration", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it("calls public restaurants list when there is no auth token (guest)", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const listSpy = vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([] as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalled()
    })
  })

  it("syncs restaurants from backend API on mount", async () => {
    const mockBackendRestaurants: any[] = [
      {
        id: "rest-tacos",
        slug: "tacos-el-rey",
        name: "Tacos El Rey",
        tagline: "Sabor mexicano",
        theme: "clean-white",
        isActive: true,
        categories: ["Tacos", "Bebidas"],
      },
    ]

    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockBackendRestaurants as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants.some((r) => r.slug === "tacos-el-rey")).toBe(true)
    })
  })

  it("persists newly created restaurant to backend API", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
    const createSpy = vi.spyOn(apiClient, "createRestaurant").mockResolvedValue({
      id: "rest-created-123",
      slug: "burgers-and-co",
      name: "Burgers & Co",
      tagline: "Best burgers in town",
      categories: ["General"],
    } as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    act(() => {
      result.current.createRestaurant({
        name: "Burgers & Co",
        slug: "burgers-and-co",
        tagline: "Best burgers in town",
        whatsappNumber: "573001234567",
      })
    })

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Burgers & Co",
        slug: "burgers-and-co",
      })
    )

    expect(result.current.restaurants.some((r) => r.slug === "burgers-and-co")).toBe(true)
  })

  it("calls backend delete endpoint when deleteRestaurant is called", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
    const deleteSpy = vi.spyOn(apiClient, "deleteRestaurant").mockResolvedValue({
      message: "Deleted",
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    // Add two restaurants so we have > 1 to delete
    act(() => {
      result.current.createRestaurant({
        name: "Restaurant 1",
        slug: "rest-1",
        tagline: "Tagline 1",
        whatsappNumber: "111",
      })
      result.current.createRestaurant({
        name: "Restaurant 2",
        slug: "rest-2",
        tagline: "Tagline 2",
        whatsappNumber: "222",
      })
    })

    const restToDelete = result.current.restaurants[0]
    expect(restToDelete).toBeDefined()

    act(() => {
      result.current.deleteRestaurant(restToDelete.id)
    })

    expect(deleteSpy).toHaveBeenCalledWith(restToDelete.id)
  })

  it("updates restaurants to empty array when backend database is empty", async () => {
    // Seed local storage with old stale data
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({
        version: 2,
        superAdminPassword: "admin",
        restaurants: [
          {
            id: "rest-stale",
            slug: "stale-burger",
            adminPassword: "stale",
            isActive: true,
            config: { name: "Stale Burger", tagline: "Old" },
          },
        ],
      })
    )

    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants).toEqual([])
    })
  })
})

describe("TenantContext - effective tenant derivation and mutation identity (A1/M5/M10)", () => {
  const seedEnvelope = (restaurants: any[]) => {
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({ version: 2, restaurants })
    )
  }

  const makeRestaurant = (id: string, slug: string, name: string): any => ({
    id,
    slug,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    config: { ...DEFAULT_STORE_CONFIG, name },
    categories: ["General"],
    products: [],
    additions: [],
    orders: [],
    customers: [],
  })

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("derives effectiveRestaurantId from a restaurant session, while guests keep the persisted value (A1)", async () => {
    seedEnvelope([makeRestaurant("rest-alive", "alive", "Alive")])
    localStorage.setItem("burger_page_active_rest_v2", "rest-alive")
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "restaurant", restaurantId: "rest-session", authenticatedAt: new Date().toISOString() })
    )
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>
        <TenantProvider>{children}</TenantProvider>
      </AuthProvider>
    )
    const { result } = renderHook(() => useTenant(), { wrapper })

    // Session-bound: a session restaurantId that is NOT the persisted one wins
    // for every derived binding, even though the display record falls back to
    // the only envelope entry while the session tenant awaits its own data.
    await waitFor(() => {
      expect(result.current.effectiveRestaurantId).toBe("rest-session")
    })
    expect(result.current.activeRestaurantSlug).toBe("alive")
  })

  it("blocks a restaurant-bound session from switching to another tenant (M5)", async () => {
    seedEnvelope([
      makeRestaurant("rest-own", "own", "Own"),
      makeRestaurant("rest-other", "other", "Other"),
    ])
    localStorage.setItem("burger_page_active_rest_v2", "rest-own")
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "restaurant", restaurantId: "rest-own", authenticatedAt: new Date().toISOString() })
    )
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>
        <TenantProvider>{children}</TenantProvider>
      </AuthProvider>
    )
    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.activeRestaurant.id).toBe("rest-own")
    })

    act(() => {
      result.current.switchRestaurant("rest-other")
    })
    expect(result.current.activeRestaurant.id).toBe("rest-own")

    act(() => {
      result.current.switchRestaurant("own")
    })
    expect(result.current.activeRestaurant.id).toBe("rest-own")
  })

  it("creates a fresh record for a stub/unknown active id instead of mutating restaurants[0] (M10)", async () => {
    seedEnvelope([
      makeRestaurant("rest-alive", "alive", "Alive"),
      makeRestaurant("rest-gone", "gone", "Gone"),
    ])
    localStorage.setItem("burger_page_active_rest_v2", "rest-gone")
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([
      { id: "rest-alive", slug: "alive", name: "Alive" },
    ] as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )
    const { result } = renderHook(() => useTenant(), { wrapper })

    // Backend refresh removes rest-gone while the active id stays stale.
    await waitFor(() => {
      expect(result.current.restaurants.some((r) => r.id === "rest-gone")).toBe(false)
    })

    act(() => {
      result.current.updateActiveRestaurantRecord((current) => ({
        ...current,
        config: { ...current.config, tagline: "REWROTE" },
      }))
    })

    // restaurants[0] (rest-alive) must NEVER absorb the write.
    const alive = result.current.restaurants.find((r) => r.id === "rest-alive")
    expect(alive?.config.tagline).not.toBe("REWROTE")
    // A brand-new record with the target id is created instead.
    const recreated = result.current.restaurants.find((r) => r.id === "rest-gone")
    expect(recreated).toBeDefined()
    expect(recreated?.config.tagline).toBe("REWROTE")
  })

  it("matches mutations by id only, never redirecting by slug (M10)", async () => {
    seedEnvelope([
      makeRestaurant("rest-a", "duplicated-slug", "A"),
      makeRestaurant("rest-b", "duplicated-slug", "B"),
    ])
    localStorage.setItem("burger_page_active_rest_v2", "rest-b")
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )
    const { result } = renderHook(() => useTenant(), { wrapper })

    act(() => {
      result.current.updateActiveRestaurantRecord((current) => ({
        ...current,
        config: { ...current.config, name: "B Renamed" },
      }))
    })

    const a = result.current.restaurants.find((r) => r.id === "rest-a")
    const b = result.current.restaurants.find((r) => r.id === "rest-b")
    expect(a?.config.name).toBe("A")
    expect(b?.config.name).toBe("B Renamed")
  })
})
