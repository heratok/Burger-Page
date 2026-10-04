import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { createTestQueryClient } from "@/test/testQueryClient"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import { keys } from "@/core/query/keys"
import type { RestaurantRecord } from "@/types/restaurant"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { TenantProvider, useTenant } from "./TenantContext"
import { AuthProvider } from "./AuthContext"
import { apiClient } from "@/core/api/apiClient"

const record = (id: string, slug: string, name = id): RestaurantRecord => ({
  id,
  slug,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  config: { ...DEFAULT_STORE_CONFIG, name },
  categories: [],
})

function setup(client: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <TenantProvider>{children}</TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
  return { client, ...renderHook(() => useTenant(), { wrapper }) }
}

describe("TenantContext reads restaurants from the query cache", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  describe("as a super admin", () => {
    beforeEach(() => {
      sessionStorage.setItem(
        "burger_page_session_v2",
        JSON.stringify({ role: "super", authenticatedAt: new Date().toISOString() })
      )
      vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    })

    it("the directory comes from the keys.restaurants query", async () => {
      vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([
        { id: "rest-a", slug: "a", name: "Alpha", isActive: true },
        { id: "rest-b", slug: "b", name: "Beta", isActive: false },
      ] as any)
      const { client, result } = setup()

      await waitFor(() => expect(result.current.restaurants.map((r) => r.id)).toEqual(["rest-a", "rest-b"]))
      expect(result.current.restaurants[0].config.name).toBe("Alpha")
      expect(client.getQueryData<RestaurantRecord[]>(keys.restaurants("super"))?.map((r) => r.id)).toEqual([
        "rest-a",
        "rest-b",
      ])
    })

    it("each directory read seeds the per-restaurant entries the active restaurant is read from", async () => {
      vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([
        { id: "rest-a", slug: "a", name: "Alpha", isActive: true, config: { primaryColor: "#123456" } },
      ] as any)
      const { client, result } = setup()
      await waitFor(() => expect(result.current.restaurants).toHaveLength(1))

      expect(client.getQueryData<RestaurantRecord>(keys.restaurant("super", "rest-a"))?.config.name).toBe("Alpha")
      act(() => result.current.switchRestaurant("rest-a"))
      expect(result.current.activeRestaurant.config.primaryColor).toBe("#123456")

      // The active restaurant (and its store config) follows its keys.restaurant entry.
      act(() => {
        client.setQueryData<RestaurantRecord>(keys.restaurant("super", "rest-a"), (r) => ({
          ...r!,
          config: { ...r!.config, primaryColor: "#abcdef" },
        }))
      })
      expect(result.current.activeRestaurant.config.primaryColor).toBe("#abcdef")
    })

    it("an optimistic restaurant edit lands in the cache and rolls back there on failure", async () => {
      vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([{ id: "rest-a", slug: "a", name: "Alpha", isActive: true }] as any)
      vi.spyOn(apiClient, "updateRestaurant").mockRejectedValue(new Error("boom"))
      const { client, result } = setup()
      await waitFor(() => expect(result.current.restaurants).toHaveLength(1))

      let update!: Promise<void>
      act(() => {
        update = result.current.updateRestaurant("rest-a", { isActive: false })
      })
      expect(client.getQueryData<RestaurantRecord[]>(keys.restaurants("super"))?.[0].isActive).toBe(false)
      expect(client.getQueryData<RestaurantRecord>(keys.restaurant("super", "rest-a"))?.isActive).toBe(false)

      await act(async () => {
        await update
      })
      expect(client.getQueryData<RestaurantRecord[]>(keys.restaurants("super"))?.[0].isActive).toBe(true)
      expect(result.current.restaurants[0].isActive).toBe(true)
    })
  })

  describe("as a storefront visitor", () => {
    beforeEach(() => {
      vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    })

    it("a resolved storefront becomes a known, active restaurant read from keys.restaurant", async () => {
      vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue({ id: "rest-x", slug: "x", name: "Xavi", isActive: true } as any)
      const { client, result } = setup()

      let outcome!: string
      await act(async () => {
        outcome = await result.current.loadRestaurant("x")
      })

      expect(outcome).toBe("ok")
      expect(result.current.activeRestaurant.config.name).toBe("Xavi")
      expect(result.current.restaurants.map((r) => r.slug)).toEqual(["x"])
      expect(client.getQueryData<RestaurantRecord>(keys.restaurant("guest", "rest-x"))?.slug).toBe("x")
      expect(localStorage.getItem("burger_page_platform_v2")).toBeNull()
    })

    it("the active restaurant outlives the default garbage-collection time", async () => {
      vi.useFakeTimers()
      try {
        // Restored (or seeded) entries have no observer and no query options.
        const { client, result } = setup()
        act(() => {
          client.setQueryData(keys.restaurant("guest", "rest-x"), record("rest-x", "x", "Xavi"))
          result.current.switchRestaurant("rest-x")
        })
        expect(result.current.activeRestaurant.id).toBe("rest-x")
        await act(async () => {
          await vi.advanceTimersByTimeAsync(60 * 60_000)
        })
        expect(result.current.activeRestaurant.id).toBe("rest-x")
        expect(result.current.restaurants.map((r) => r.id)).toEqual(["rest-x"])
      } finally {
        vi.useRealTimers()
      }
    })

    it("a known restaurant is switched to without another request", async () => {
      const lookup = vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue(record("rest-x", "x") as any)
      const { client, result } = setup()
      act(() => {
        client.setQueryData(keys.restaurant("guest", "rest-x"), record("rest-x", "x", "Known"))
      })

      await act(async () => {
        await result.current.loadRestaurant("x")
      })

      expect(lookup).not.toHaveBeenCalled()
      expect(result.current.activeRestaurant.config.name).toBe("Known")
    })
  })
})
