import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { renderHook, act, waitFor } from "@testing-library/react"
import React from "react"
import { TenantProvider, useTenant } from "./TenantContext"
import { AuthProvider } from "./AuthContext"
import { toast } from "sonner"
import { apiClient } from "@/core/api/apiClient"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

describe("TenantContext - Backend Multi-Tenant Integration", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it("does not request the private restaurants list when there is no auth token (guest)", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const listSpy = vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([] as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })
    await act(async () => {
      await result.current.refreshRestaurants()
    })
    await new Promise((r) => setTimeout(r, 50))

    expect(listSpy).not.toHaveBeenCalled()
    expect(result.current.isSyncing).toBe(false)
  })

  it("requests the restaurants list when a token is present", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    const listSpy = vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([] as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalled()
    })
  })

  it("survives a 401 from the list endpoint without touching the session token", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    const setTokenSpy = vi.spyOn(apiClient, "setToken")
    const err: any = new Error("API Error: 401 Unauthorized")
    err.status = 401
    const listSpy = vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(err)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })
    await waitFor(() => expect(listSpy).toHaveBeenCalled())
    await waitFor(() => expect(result.current.isSyncing).toBe(false))

    expect(setTokenSpy).not.toHaveBeenCalled()
    expect(listSpy).toHaveBeenCalledTimes(1)
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
      categories: [],
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

  it("creates a restaurant with zero categories and sends no fabricated default to the API", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
    const createSpy = vi.spyOn(apiClient, "createRestaurant").mockImplementation(
      async (payload: any) =>
        ({
          id: "rest-zero-cats",
          slug: payload.slug,
          name: payload.name,
          categories: payload.categories,
        }) as any
    )

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    act(() => {
      result.current.createRestaurant({
        name: "Zero Cats",
        slug: "zero-cats",
        tagline: "Sin categorías",
        whatsappNumber: "573001234567",
      })
    })

    const created = result.current.restaurants.find((r) => r.slug === "zero-cats")
    expect(created?.categories).toEqual([])
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ categories: [] }))
  })

  it("hydrates a backend restaurant with no categories as an empty list (no fabricated default)", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([
      { id: "rest-empty", slug: "empty-cats", name: "Empty Cats", categories: [] },
    ] as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants.some((r) => r.slug === "empty-cats")).toBe(true)
    })

    const hydrated = result.current.restaurants.find((r) => r.slug === "empty-cats")
    expect(hydrated?.categories).toEqual([])
  })

  it("lets a backend empty category list overwrite stale local categories (regression)", async () => {
    // Stale local storage still holds a category the owner already deleted.
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({
        version: 2,
        restaurants: [
          {
            id: "rest-empty",
            slug: "empty-cats",
            isActive: true,
            config: { name: "Empty Cats", tagline: "Sin categorías" },
            categories: ["Vieja"],
            products: [],
          },
        ],
      })
    )

    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([
      { id: "rest-empty", slug: "empty-cats", name: "Empty Cats", categories: [] },
    ] as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      const r = result.current.restaurants.find((x) => x.slug === "empty-cats")
      // Backend [] is authoritative: the stale "Vieja" must not come back.
      expect(r?.categories).toEqual([])
    })
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
    categories: [],
    products: [],
    additions: [],
    orders: [],
    customers: [],
  })

  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
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
    // No fallback to another tenant record: until the session tenant loads,
    // the active record is the neutral placeholder, never the persisted one.
    expect(result.current.activeRestaurantSlug).toBe("default")
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

  describe("restaurant session requesting its own tenant before the list loads", () => {
    const own = { id: "rest-own", slug: "own", name: "Own", isActive: true, categories: [] }
    const other = { id: "rest-other", slug: "other", name: "Other", isActive: true, categories: [] }

    const mountOwn = () => {
      localStorage.setItem("burger_page_active_rest_v2", "rest-default")
      sessionStorage.setItem(
        "burger_page_session_v2",
        JSON.stringify({ role: "restaurant", restaurantId: "rest-own", authenticatedAt: new Date().toISOString() })
      )
      vi.spyOn(apiClient, "listRestaurants").mockReturnValue(new Promise(() => {}) as any)
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>
          <TenantProvider>{children}</TenantProvider>
        </AuthProvider>
      )
      return renderHook(() => useTenant(), { wrapper })
    }

    it("does not warn and activates the own tenant fetched on demand (id)", async () => {
      const warn = vi.spyOn(toast, "warning").mockImplementation((() => "") as any)
      const fetchSpy = vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue(own as any)
      const { result } = mountOwn()

      act(() => {
        result.current.switchRestaurant("rest-own")
      })

      await waitFor(() => {
        expect(result.current.activeRestaurant.id).toBe("rest-own")
      })
      expect(fetchSpy).toHaveBeenCalledWith("rest-own")
      expect(warn).not.toHaveBeenCalled()
    })

    it("does not warn when the own tenant is requested by slug and resolves to itself", async () => {
      const warn = vi.spyOn(toast, "warning").mockImplementation((() => "") as any)
      vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue(own as any)
      const { result } = mountOwn()

      act(() => {
        result.current.switchRestaurant("own")
      })

      await waitFor(() => {
        expect(result.current.activeRestaurant.id).toBe("rest-own")
      })
      expect(warn).not.toHaveBeenCalled()
    })

    it("still warns and never switches when the slug resolves to a different tenant", async () => {
      const warn = vi.spyOn(toast, "warning").mockImplementation((() => "") as any)
      vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue(other as any)
      const { result } = mountOwn()

      act(() => {
        result.current.switchRestaurant("other")
      })

      await waitFor(() => expect(warn).toHaveBeenCalledTimes(1))
      expect(result.current.activeRestaurant.id).not.toBe("rest-other")
      expect(result.current.effectiveRestaurantId).toBe("rest-own")
    })

    it("loadRestaurant of the own slug does not warn", async () => {
      const warn = vi.spyOn(toast, "warning").mockImplementation((() => "") as any)
      vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue(own as any)
      const { result } = mountOwn()

      let outcome = ""
      await act(async () => {
        outcome = await result.current.loadRestaurant("own")
      })

      expect(outcome).toBe("ok")
      expect(warn).not.toHaveBeenCalled()
    })
  })

  it("creates a fresh record for a stub/unknown active id instead of mutating restaurants[0] (M10)", async () => {
    seedEnvelope([
      makeRestaurant("rest-alive", "alive", "Alive"),
      makeRestaurant("rest-gone", "gone", "Gone"),
    ])
    localStorage.setItem("burger_page_active_rest_v2", "rest-gone")
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
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

describe("TenantContext.loadRestaurant - never shows another tenant", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TenantProvider>{children}</TenantProvider>
  )

  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))
  })

  it("fetches once, adds the record and activates it without a second fetch", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue({
      id: "rest-new",
      slug: "new-place",
      isActive: true,
      config: { ...DEFAULT_STORE_CONFIG, name: "New Place" },
    } as any)

    const { result } = renderHook(() => useTenant(), { wrapper })
    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.loadRestaurant("new-place")
    })

    expect(outcome).toBe("ok")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.current.activeRestaurant.id).toBe("rest-new")
    expect(result.current.activeRestaurant.config.name).toBe("New Place")
  })

  it("maps the schedule, timezone and ordersPaused of the public payload into the config", async () => {
    const schedule = [{ dayOfWeek: 2, open: "10:00", close: "22:00" }]
    vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue({
      id: "rest-sched",
      slug: "sched-place",
      isActive: true,
      schedule,
      timezone: "America/Mexico_City",
      ordersPaused: true,
      config: { name: "Sched", openingHours: "10:00 - 22:00" },
    } as any)

    const { result } = renderHook(() => useTenant(), { wrapper })
    await act(async () => {
      await result.current.loadRestaurant("sched-place")
    })

    const config = result.current.activeRestaurant.config
    expect(config.schedule).toEqual(schedule)
    expect(config.timezone).toBe("America/Mexico_City")
    expect(config.ordersPaused).toBe(true)
    expect("openingHours" in config).toBe(false)
  })

  it("returns not-found on 404 and leaves the active tenant untouched", async () => {
    vi.spyOn(apiClient, "fetchRestaurant").mockRejectedValue(
      Object.assign(new Error("API Error: 404 Not Found"), { status: 404 })
    )
    const { result } = renderHook(() => useTenant(), { wrapper })
    const before = result.current.activeRestaurant.id

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.loadRestaurant("ghost")
    })

    expect(outcome).toBe("not-found")
    expect(result.current.activeRestaurant.id).toBe(before)
    expect(result.current.restaurants.some((r) => r.slug === "ghost")).toBe(false)
  })

  it("returns error on network/5xx failure and does not activate another tenant", async () => {
    vi.spyOn(apiClient, "fetchRestaurant").mockRejectedValue(new Error("Failed to fetch"))
    const { result } = renderHook(() => useTenant(), { wrapper })
    const before = result.current.activeRestaurant.id

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.loadRestaurant("flaky")
    })

    expect(outcome).toBe("error")
    expect(result.current.activeRestaurant.id).toBe(before)
  })

  it("activates an already-known slug without any fetch", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchRestaurant")
    const mk = (id: string, slug: string): any => ({
      id, slug, isActive: true, createdAt: "2026-01-01T00:00:00.000Z",
      config: { ...DEFAULT_STORE_CONFIG, name: id }, categories: [], products: [],
      additions: [], orders: [], customers: [], inventory: [], suppliers: [],
    })
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({ version: 2, restaurants: [mk("rest-a", "a-slug"), mk("rest-b", "b-slug")] })
    )
    const { result } = renderHook(() => useTenant(), { wrapper })
    const known = result.current.restaurants[1]

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.loadRestaurant(known.slug)
    })

    expect(outcome).toBe("ok")
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.activeRestaurant.id).toBe(known.id)
  })

  describe("refreshStoreStatus", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    it("updates only schedule, timezone and pause of the active restaurant", async () => {
      vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
      const fetchSpy = vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue({
        id: "rest-burger-craft",
        slug: "burger-craft",
        name: "Changed name must be ignored",
        config: { primaryColor: "#000000" },
        schedule: [{ dayOfWeek: 1, open: "10:00", close: "12:00" }],
        timezone: "America/Mexico_City",
        ordersPaused: true,
        products: [{ id: "x" }],
      } as any)

      const { result } = renderHook(() => useTenant(), { wrapper })
      const before = result.current.activeRestaurant
      await act(async () => {
        await result.current.refreshStoreStatus()
      })

      expect(fetchSpy).toHaveBeenCalledWith("burger-craft")
      const after = result.current.activeRestaurant
      expect(after.config.ordersPaused).toBe(true)
      expect(after.config.timezone).toBe("America/Mexico_City")
      expect(after.config.schedule).toEqual([{ dayOfWeek: 1, open: "10:00", close: "12:00" }])
      expect(after.config.name).toBe(before.config.name)
      expect(after.config.primaryColor).toBe(before.config.primaryColor)
      expect(after.products).toBe(before.products)
    })

    it("keeps the same state reference when nothing changed", async () => {
      vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
      vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue({
        id: "rest-burger-craft",
        slug: "burger-craft",
        schedule: DEFAULT_STORE_CONFIG.schedule,
        timezone: DEFAULT_STORE_CONFIG.timezone,
        ordersPaused: false,
      } as any)

      const { result } = renderHook(() => useTenant(), { wrapper })
      const before = result.current.activeRestaurant
      await act(async () => {
        await result.current.refreshStoreStatus()
      })
      expect(result.current.activeRestaurant).toBe(before)
    })

    it("is silent and keeps the last known data when the refresh fails", async () => {
      vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
      vi.spyOn(apiClient, "fetchRestaurant").mockRejectedValue(new Error("network"))

      const { result } = renderHook(() => useTenant(), { wrapper })
      const before = result.current.activeRestaurant
      await act(async () => {
        await expect(result.current.refreshStoreStatus()).resolves.toBeUndefined()
      })
      expect(result.current.activeRestaurant).toBe(before)
    })

    it("ignores a response that belongs to another restaurant", async () => {
      vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
      vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue({
        id: "rest-other",
        slug: "other",
        ordersPaused: true,
      } as any)

      const { result } = renderHook(() => useTenant(), { wrapper })
      const before = result.current.activeRestaurant
      await act(async () => {
        await result.current.refreshStoreStatus()
      })
      expect(result.current.activeRestaurant).toBe(before)
    })
  })
})

describe("TenantContext - initial activeRestaurantId on public storefront routes", () => {
  const record = (id: string, slug: string): any => ({
    id,
    slug,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    config: { ...DEFAULT_STORE_CONFIG, name: id },
    categories: [],
    products: [],
    additions: [],
    orders: [],
    customers: [],
  })

  const mountAt = (pathname: string) => {
    window.history.pushState({}, "", pathname)
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )
    return renderHook(() => useTenant(), { wrapper })
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({ version: 2, restaurants: [record("rest-alive", "alive"), record("rest-other", "other")] })
    )
    localStorage.setItem("burger_page_active_rest_v2", "rest-alive")
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  it.each(["/", "/admin", "/admin/orders", "/login", "/signin", "/auth"])("honors the persisted tenant on the non-storefront route %s", (path) => {
    const { result } = mountAt(path)
    expect(result.current.activeRestaurantId).toBe("rest-alive")
  })

  it.each(["/alive", "/Alive/", "/rest-alive"])("honors the persisted tenant when the storefront URL %s matches its slug or id", (path) => {
    const { result } = mountAt(path)
    expect(result.current.activeRestaurantId).toBe("rest-alive")
  })

  it.each(["/other", "/typo-slug"])("discards the persisted tenant as stale on the storefront URL %s", (path) => {
    const { result } = mountAt(path)
    // Empty selection surfaces as the neutral placeholder tenant.
    expect(result.current.activeRestaurantId).toBe("rest-default")
  })

  it("stays empty when the persisted id matches no known restaurant, whatever the route", () => {
    localStorage.setItem("burger_page_active_rest_v2", "rest-ghost")
    const { result } = mountAt("/")
    // Empty selection surfaces as the neutral placeholder tenant.
    expect(result.current.activeRestaurantId).toBe("rest-default")
  })
})
