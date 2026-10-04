import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { GlobalPlatformSummary } from "./GlobalPlatformSummary"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"
import { appQueryClient } from "@/core/query/queryClient"

const STATS = { totalRevenue: 1234567, totalOrders: 321, totalCustomers: 123, totalRestaurants: 17, activeRestaurants: 12 }

const renderSummary = () =>
  render(
    <RestaurantProvider>
      <GlobalPlatformSummary onOpenCreateModal={() => {}} />
    </RestaurantProvider>
  )

describe("GlobalPlatformSummary (server platform totals)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    appQueryClient.clear()
    sessionStorage.setItem("burger_page_session_v2", JSON.stringify({ role: "super", authenticatedAt: new Date().toISOString() }))
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("shows the totals the server reports", async () => {
    vi.spyOn(apiClient, "fetchPlatformStats").mockResolvedValue(STATS)
    renderSummary()

    expect(await screen.findByText("$1.234.567")).toBeDefined()
    expect(screen.getByText("321")).toBeDefined()
    expect(screen.getByText("12 / 17")).toBeDefined()
    expect(screen.getByText("123")).toBeDefined()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("shows a placeholder, not zeros, while the totals are loading", async () => {
    vi.spyOn(apiClient, "fetchPlatformStats").mockReturnValue(new Promise(() => {}))
    renderSummary()

    await waitFor(() => expect(screen.getAllByText("—")).toHaveLength(4))
    expect(screen.queryByText("$0")).toBeNull()
    expect(screen.queryByText("0 / 0")).toBeNull()
  })

  it("tells the super admin the totals could not be loaded instead of showing zeros", async () => {
    vi.spyOn(apiClient, "fetchPlatformStats").mockRejectedValue(new Error("boom"))
    renderSummary()

    expect(await screen.findByRole("alert")).toBeDefined()
    expect(screen.getByRole("alert").textContent).toMatch(/No se pudieron cargar las métricas/i)
    expect(screen.getAllByText("—")).toHaveLength(4)
    expect(screen.queryByText("$0")).toBeNull()
  })
})
