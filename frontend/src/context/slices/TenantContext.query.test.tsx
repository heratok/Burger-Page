import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { TenantProvider, useTenant } from "./TenantContext"
import { AuthProvider } from "./AuthContext"
import { RestaurantProvider } from "../RestaurantContext"
import { apiClient } from "@/core/api/apiClient"

/** A promise settled by hand, so in-flight states stay observable. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const makeRecord = (id: string, slug: string, name = id): any => ({
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
  inventory: [],
  suppliers: [],
})

const seedEnvelope = (restaurants: any[], active = "") => {
  localStorage.setItem("burger_page_platform_v2", JSON.stringify({ version: 2, restaurants }))
  if (active) localStorage.setItem("burger_page_active_rest_v2", active)
}

const seedSession = (session: Record<string, unknown>) =>
  sessionStorage.setItem(
    "burger_page_session_v2",
    JSON.stringify({ ...session, authenticatedAt: new Date().toISOString() })
  )

function setup(client: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <TenantProvider>{children}</TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
  return { client, wrapper }
}

describe("TenantContext server calls (TanStack Query)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.mocked(toast.warning).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    vi.spyOn(apiClient, "listRestaurants").mockImplementation(async () => [])
  })

  describe("restaurants directory (refreshRestaurants)", () => {
    beforeEach(() => {
      seedSession({ role: "super" })
      vi.mocked(apiClient.hasToken).mockReturnValue(true)
    })

    it("shares one request between concurrent refreshes", async () => {
      const held = deferred<any[]>()
      vi.mocked(apiClient.listRestaurants).mockImplementation(() => held.promise)
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalledTimes(1))

      let first!: Promise<void>
      let second!: Promise<void>
      act(() => {
        first = result.current.refreshRestaurants()
        second = result.current.refreshRestaurants()
      })
      expect(apiClient.listRestaurants).toHaveBeenCalledTimes(1)
      await act(async () => {
        held.resolve([{ id: "rest-a", slug: "a", name: "A", isActive: true }])
        await Promise.all([first, second])
      })
      await waitFor(() => expect(result.current.restaurants.map((r) => r.id)).toEqual(["rest-a"]))
      expect(apiClient.listRestaurants).toHaveBeenCalledTimes(1)
    })

    it("keys the cached directory by role so it never crosses sessions", async () => {
      const { client, wrapper } = setup()
      renderHook(() => useTenant(), { wrapper })
      await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalled())
      await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ["restaurants"] })).toHaveLength(1))
      const [key] = client.getQueryCache().findAll({ queryKey: ["restaurants"] }).map((q) => q.queryKey)
      expect(key).toContain("super")
    })

    it("always re-requests on an explicit refresh (no stale cache reuse)", async () => {
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalledTimes(1))
      await act(async () => {
        await result.current.refreshRestaurants()
      })
      expect(apiClient.listRestaurants).toHaveBeenCalledTimes(2)
    })

    it("never re-merges adminPassword from the backend or legacy local records (SUS-20)", async () => {
      seedEnvelope([{ ...makeRecord("rest-a", "a"), adminPassword: "legacy-secret" }], "rest-a")
      vi.mocked(apiClient.listRestaurants).mockImplementation(async () => [
        { id: "rest-a", slug: "a", name: "A", isActive: true, adminPassword: "backend-secret" },
      ] as any)
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await waitFor(() => expect(result.current.restaurants[0]?.config.name).toBe("A"))
      expect(JSON.stringify(result.current.restaurants)).not.toContain("secret")
      expect(localStorage.getItem("burger_page_platform_v2")).not.toContain("secret")
    })

    it("defers merging a stale directory response while a write is pending, then refetches", async () => {
      seedEnvelope([makeRecord("rest-a", "a", "Original")], "rest-a")
      let serverName = "Original"
      vi.mocked(apiClient.listRestaurants).mockImplementation(async () => [
        { id: "rest-a", slug: "a", name: serverName, isActive: true },
      ] as any)
      const write = deferred<any>()
      vi.spyOn(apiClient, "updateRestaurant").mockReturnValue(write.promise)
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(result.current.isSyncing).toBe(false))

      // An optimistic edit is in flight; a directory read that predates it lands.
      let update!: Promise<void>
      act(() => {
        update = result.current.updateRestaurant("rest-a", {
          config: { ...result.current.restaurants[0].config, name: "Edited" },
        })
      })
      expect(result.current.restaurants[0].config.name).toBe("Edited")
      await act(async () => {
        await result.current.refreshRestaurants()
      })
      // The stale response must not wipe the optimistic edit.
      expect(result.current.restaurants[0].config.name).toBe("Edited")

      // Once the write settles the authoritative state is pulled again.
      serverName = "Edited"
      await act(async () => {
        write.resolve({})
        await update
      })
      await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalledTimes(3))
      await waitFor(() => expect(result.current.restaurants[0].config.name).toBe("Edited"))
    })
  })

  describe("anonymous visitors", () => {
    it("never request the restaurants directory", async () => {
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(async () => {
        await result.current.refreshRestaurants()
      })
      await act(() => new Promise((r) => setTimeout(r, 20)))
      expect(apiClient.listRestaurants).not.toHaveBeenCalled()
    })
  })

  describe("storefront status (refreshStoreStatus)", () => {
    it("shares one request between concurrent polls", async () => {
      const held = deferred<any>()
      vi.spyOn(apiClient, "fetchRestaurant").mockImplementation(() => held.promise)
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })

      let first!: Promise<void>
      let second!: Promise<void>
      act(() => {
        first = result.current.refreshStoreStatus()
        second = result.current.refreshStoreStatus()
      })
      expect(apiClient.fetchRestaurant).toHaveBeenCalledTimes(1)
      await act(async () => {
        held.resolve({ id: "rest-burger-craft", slug: "burger-craft", ordersPaused: true })
        await Promise.all([first, second])
      })
      expect(result.current.activeRestaurant.config.ordersPaused).toBe(true)
    })

    it("always asks the server again on every poll (never serves a cached status)", async () => {
      const fetchSpy = vi.spyOn(apiClient, "fetchRestaurant").mockImplementation(async () => ({
        id: "rest-burger-craft",
        slug: "burger-craft",
        ordersPaused: false,
      }) as any)
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(async () => {
        await result.current.refreshStoreStatus()
      })
      await act(async () => {
        await result.current.refreshStoreStatus()
      })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it("keys the cached status by role and slug", async () => {
      vi.spyOn(apiClient, "fetchRestaurant").mockImplementation(async () => ({
        id: "rest-burger-craft",
        slug: "burger-craft",
      }) as any)
      const { client, wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(async () => {
        await result.current.refreshStoreStatus()
      })
      const keys = client.getQueryCache().findAll({ queryKey: ["restaurant-status"] }).map((q) => q.queryKey)
      expect(keys).toHaveLength(1)
      expect(keys[0]).toEqual(expect.arrayContaining(["guest", "burger-craft"]))
    })

    it("stays silent when the poll fails", async () => {
      vi.spyOn(apiClient, "fetchRestaurant").mockRejectedValue(new Error("offline"))
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      const before = result.current.activeRestaurant
      await act(async () => {
        await expect(result.current.refreshStoreStatus()).resolves.toBeUndefined()
      })
      expect(result.current.activeRestaurant).toBe(before)
      expect(toast.error).not.toHaveBeenCalled()
    })
  })

  describe("loadRestaurant", () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it("shares one request between concurrent resolutions of the same slug", async () => {
      const held = deferred<any>()
      vi.spyOn(apiClient, "fetchRestaurant").mockImplementation(() => held.promise)
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })

      let first!: Promise<string>
      let second!: Promise<string>
      act(() => {
        first = result.current.loadRestaurant("new-place")
        second = result.current.loadRestaurant("new-place")
      })
      expect(apiClient.fetchRestaurant).toHaveBeenCalledTimes(1)
      let outcomes: string[] = []
      await act(async () => {
        held.resolve({ id: "rest-new", slug: "new-place", isActive: true, name: "New Place" })
        outcomes = await Promise.all([first, second])
      })
      expect(outcomes).toEqual(["ok", "ok"])
      expect(result.current.activeRestaurant.id).toBe("rest-new")
      expect(result.current.restaurants.filter((r) => r.id === "rest-new")).toHaveLength(1)
    })

    it("keys the resolution cache by role", async () => {
      vi.spyOn(apiClient, "fetchRestaurant").mockImplementation(async () => ({
        id: "rest-new",
        slug: "new-place",
      }) as any)
      const { client, wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(async () => {
        await result.current.loadRestaurant("new-place")
      })
      const keys = client.getQueryCache().findAll({ queryKey: ["restaurant"] }).map((q) => q.queryKey)
      expect(keys).toHaveLength(1)
      expect(keys[0]).toEqual(expect.arrayContaining(["guest", "new-place"]))
    })

    it("does not cache a failed lookup: not-found then found on retry", async () => {
      const spy = vi
        .spyOn(apiClient, "fetchRestaurant")
        .mockRejectedValueOnce(Object.assign(new Error("API Error: 404"), { status: 404 }))
        .mockResolvedValueOnce({ id: "rest-late", slug: "late", isActive: true } as any)
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      let outcome = ""
      await act(async () => {
        outcome = await result.current.loadRestaurant("late")
      })
      expect(outcome).toBe("not-found")
      await act(async () => {
        outcome = await result.current.loadRestaurant("late")
      })
      expect(outcome).toBe("ok")
      expect(spy).toHaveBeenCalledTimes(2)
    })

    it("a restaurant admin cannot live-switch to another tenant (warns, no activation)", async () => {
      seedSession({ role: "restaurant", restaurantId: "rest-own" })
      vi.spyOn(apiClient, "fetchRestaurant").mockImplementation(async () => ({
        id: "rest-other",
        slug: "other",
        isActive: true,
      }) as any)
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(async () => {
        await result.current.loadRestaurant("other")
      })
      expect(toast.warning).toHaveBeenCalled()
      expect(result.current.restaurants.some((r) => r.id === "rest-other")).toBe(false)
      expect(result.current.effectiveRestaurantId).toBe("rest-own")
    })
  })

  describe("writes", () => {
    it("tracks updateRestaurant as a mutation while the request is in flight", async () => {
      seedEnvelope([makeRecord("rest-a", "a", "Original")], "rest-a")
      const write = deferred<any>()
      vi.spyOn(apiClient, "updateRestaurant").mockReturnValue(write.promise)
      const { client, wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })

      let update!: Promise<void>
      act(() => {
        update = result.current.updateRestaurant("rest-a", {
          config: { ...result.current.restaurants[0].config, name: "Edited" },
        })
      })
      expect(apiClient.updateRestaurant).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(client.isMutating({ mutationKey: ["tenant-writes"] })).toBe(1))
      await act(async () => {
        write.resolve({})
        await update
      })
      await waitFor(() => expect(client.isMutating({ mutationKey: ["tenant-writes"] })).toBe(0))
      expect(result.current.restaurants[0].config.name).toBe("Edited")
    })

    it("rolls back and toasts when the update fails", async () => {
      seedEnvelope([makeRecord("rest-a", "a", "Original")], "rest-a")
      vi.spyOn(apiClient, "updateRestaurant").mockRejectedValue(new Error("network down"))
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(async () => {
        await result.current.updateRestaurant("rest-a", {
          config: { ...result.current.restaurants[0].config, name: "Edited" },
        })
      })
      expect(result.current.restaurants[0].config.name).toBe("Original")
      expect(toast.error).toHaveBeenCalledWith(
        "No se pudo actualizar el restaurante en el servidor. Cambios revertidos."
      )
    })

    it("rolls back a failed delete but keeps the soft delete on 404", async () => {
      seedEnvelope([makeRecord("rest-a", "a"), makeRecord("rest-b", "b")], "rest-a")
      const del = vi.spyOn(apiClient, "deleteRestaurant")
      del.mockRejectedValueOnce(new Error("boom"))
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(async () => {
        await result.current.deleteRestaurant("rest-a")
      })
      expect(result.current.restaurants.find((r) => r.id === "rest-a")?.isActive).toBe(true)

      del.mockRejectedValueOnce(Object.assign(new Error("API Error: 404"), { status: 404 }))
      await act(async () => {
        await result.current.deleteRestaurant("rest-b")
      })
      expect(result.current.restaurants.find((r) => r.id === "rest-b")?.isActive).toBe(false)
    })

    it("marks cached restaurant lookups stale once a write settles", async () => {
      vi.spyOn(apiClient, "fetchRestaurant").mockImplementation(async () => ({
        id: "rest-new",
        slug: "new-place",
        isActive: true,
      }) as any)
      vi.spyOn(apiClient, "updateRestaurant").mockResolvedValue({} as any)
      const { client, wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(async () => {
        await result.current.loadRestaurant("new-place")
      })
      const lookup = () => client.getQueryCache().findAll({ queryKey: ["restaurant"] })[0]
      expect(lookup().state.isInvalidated).toBe(false)
      await act(async () => {
        await result.current.updateRestaurant("rest-new", { isActive: false })
      })
      await waitFor(() => expect(lookup().state.isInvalidated).toBe(true))
    })
  })

  describe("effective tenant and persistence root", () => {
    it("a restaurant session always uses its own tenant, whatever is persisted (A1/A2)", async () => {
      seedEnvelope([makeRecord("rest-a", "a")], "rest-a")
      seedSession({ role: "restaurant", restaurantId: "rest-session" })
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      expect(result.current.effectiveRestaurantId).toBe("rest-session")
    })

    it("does not fabricate a default tenant fetch for an empty envelope", async () => {
      localStorage.clear()
      const spy = vi.spyOn(apiClient, "fetchRestaurant")
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      await act(() => new Promise((r) => setTimeout(r, 20)))
      expect(spy).not.toHaveBeenCalled()
      expect(result.current.effectiveRestaurantId).toBe("")
    })

    it("keeps cross-tab storage sync", async () => {
      const { wrapper } = setup()
      const { result } = renderHook(() => useTenant(), { wrapper })
      const next = { version: 2, restaurants: [makeRecord("rest-x", "x", "From other tab")] }
      localStorage.setItem("burger_page_platform_v2", JSON.stringify(next))
      act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key: "burger_page_platform_v2" }))
      })
      await waitFor(() => expect(result.current.restaurants.map((r) => r.id)).toEqual(["rest-x"]))
    })
  })

  describe("provider order", () => {
    it("uses the injected client when mounted inside RestaurantProvider", async () => {
      seedSession({ role: "super" })
      vi.mocked(apiClient.hasToken).mockReturnValue(true)
      const client = createTestQueryClient()
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RestaurantProvider queryClient={client}>{children}</RestaurantProvider>
      )
      const { useRestaurant } = await import("../RestaurantContext")
      renderHook(() => useRestaurant(), { wrapper })
      await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalled())
      await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ["restaurants"] })).toHaveLength(1))
    })

    it("still works when mounted without any QueryClientProvider", async () => {
      vi.mocked(apiClient.hasToken).mockReturnValue(true)
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TenantProvider>{children}</TenantProvider>
      )
      const { result } = renderHook(() => useTenant(), { wrapper })
      await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalled())
      expect(result.current.effectiveRestaurantId).toBe("rest-burger-craft")
    })
  })
})
