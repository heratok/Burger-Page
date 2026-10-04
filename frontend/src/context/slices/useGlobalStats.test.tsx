import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { RestaurantProvider, useGlobalStats, useRestaurant } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"
import { appQueryClient } from "@/core/query/queryClient"
import { keys } from "@/core/query/keys"
import { TEST_ORDERS, TEST_CUSTOMERS } from "@/test/fixtures"

const SERVER_STATS = { totalRevenue: 987654.5, totalOrders: 321, totalCustomers: 123, totalRestaurants: 17, activeRestaurants: 12 }

const SESSION_KEY = "burger_page_session_v2"

const seedSession = (role: "super" | "restaurant" | "guest") => {
  if (role === "guest") return
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ role, restaurantId: role === "restaurant" ? "rest-1" : undefined, authenticatedAt: new Date().toISOString() })
  )
}

const renderStats = () =>
  renderHook(() => useGlobalStats(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <RestaurantProvider>{children}</RestaurantProvider>,
  })

describe("useGlobalStats (server-side platform totals)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    appQueryClient.clear()
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reads the totals from the platform stats endpoint for a super admin session", async () => {
    seedSession("super")
    const fetchSpy = vi.spyOn(apiClient, "fetchPlatformStats").mockResolvedValue(SERVER_STATS)
    const { result } = renderStats()

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current).toMatchObject(SERVER_STATS)
    expect(result.current.isError).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(appQueryClient.getQueryData(keys.platformStats("super", {}))).toEqual(SERVER_STATS)
  })

  it("reports loading with zeroed numbers until the endpoint answers", async () => {
    seedSession("super")
    let resolve!: (v: typeof SERVER_STATS) => void
    vi.spyOn(apiClient, "fetchPlatformStats").mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderStats()

    await waitFor(() => expect(result.current.isLoading).toBe(true))
    expect(result.current).toMatchObject({ totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalRestaurants: 0, activeRestaurants: 0 })

    resolve(SERVER_STATS)
    await waitFor(() => expect(result.current.totalOrders).toBe(321))
    expect(result.current.isLoading).toBe(false)
  })

  it("reports an error (not fake zeros as if they were real) when the endpoint fails", async () => {
    seedSession("super")
    vi.spyOn(apiClient, "fetchPlatformStats").mockRejectedValue(new Error("boom"))
    const { result } = renderStats()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.isLoading).toBe(false)
  })

  it.each(["restaurant", "guest"] as const)("never calls the endpoint for a %s session", async (role) => {
    seedSession(role)
    const fetchSpy = vi.spyOn(apiClient, "fetchPlatformStats").mockResolvedValue(SERVER_STATS)
    const { result } = renderStats()

    await new Promise((r) => setTimeout(r, 50))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.totalOrders).toBe(0)
  })

  it("ignores whatever order boards this browser happens to have loaded", async () => {
    seedSession("super")
    vi.spyOn(apiClient, "fetchPlatformStats").mockResolvedValue(SERVER_STATS)
    appQueryClient.setQueryData(keys.orders("rest-burger-craft", "super"), { orders: TEST_ORDERS, customers: TEST_CUSTOMERS })
    const { result } = renderStats()

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.totalOrders).toBe(SERVER_STATS.totalOrders)
    expect(result.current.totalCustomers).toBe(SERVER_STATS.totalCustomers)
  })

  it("reads the totals again after the restaurant directory is refreshed (e.g. a restaurant was created)", async () => {
    seedSession("super")
    apiClient.setToken("test-token")
    let server = SERVER_STATS
    const fetchSpy = vi.spyOn(apiClient, "fetchPlatformStats").mockImplementation(async () => server)
    const { result } = renderHook(
      () => ({ stats: useGlobalStats(), restaurant: useRestaurant() }),
      { wrapper: ({ children }: { children: React.ReactNode }) => <RestaurantProvider>{children}</RestaurantProvider> }
    )
    await waitFor(() => expect(result.current.stats.totalRestaurants).toBe(17))

    server = { ...SERVER_STATS, totalRestaurants: 18 }
    await act(async () => {
      await result.current.restaurant.refreshRestaurants()
    })

    await waitFor(() => expect(result.current.stats.totalRestaurants).toBe(18))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    apiClient.setToken(null)
  })
})
