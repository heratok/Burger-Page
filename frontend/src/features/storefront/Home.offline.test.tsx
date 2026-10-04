import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, act, renderHook } from "@testing-library/react"
import React from "react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
import { apiClient } from "@/core/api/apiClient"
import { createQueryClient } from "@/core/query/queryClient"
import { PERSISTED_QUERIES_KEY } from "@/core/query/persistence"
import { seedBlankActiveTenant, TEST_PRODUCTS } from "@/test/fixtures"

const persisted = () => localStorage.getItem(PERSISTED_QUERIES_KEY) ?? ""

/** Visits a storefront online once, so its menu is persisted. */
async function visitOnline() {
  vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(TEST_PRODUCTS.map((p) => ({ ...p })))
  vi.spyOn(apiClient, "fetchAdditions").mockResolvedValue([])
  const visit = render(
    <RestaurantProvider queryClient={createQueryClient()}>
      <Home />
    </RestaurantProvider>
  )
  expect((await screen.findAllByText("Burger Doble Queso")).length).toBeGreaterThan(0)
  await waitFor(() => expect(persisted()).toContain("Burger Doble Queso"), { timeout: 3000 })
  visit.unmount()
}

function goOffline() {
  vi.mocked(apiClient.fetchProducts).mockRejectedValue(new TypeError("Failed to fetch"))
  vi.mocked(apiClient.fetchAdditions).mockRejectedValue(new TypeError("Failed to fetch"))
}

describe("storefront menu persisted for offline reloads", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("a storefront reloaded offline renders the last persisted menu", async () => {
    seedBlankActiveTenant()
    await visitOnline()
    goOffline()

    // Reload: a brand new QueryClient, every request failing.
    render(
      <RestaurantProvider queryClient={createQueryClient()}>
        <Home />
      </RestaurantProvider>
    )

    expect((await screen.findAllByText("Burger Doble Queso")).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Papas Rústicas").length).toBeGreaterThan(0)
  })

  it("another tenant's storefront never reads the persisted menu", async () => {
    seedBlankActiveTenant()
    await visitOnline()
    goOffline()
    // Same device, another restaurant's storefront.
    seedBlankActiveTenant("rest-tacos", "tacos")

    render(
      <RestaurantProvider queryClient={createQueryClient()}>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(screen.queryByText("Burger Doble Queso")).toBeNull()
  })

  it("logout purges the persisted cache", async () => {
    seedBlankActiveTenant()
    await visitOnline()
    expect(persisted()).not.toBe("")

    const { result } = renderHook(() => useRestaurant(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestaurantProvider queryClient={createQueryClient()}>{children}</RestaurantProvider>
      ),
    })
    act(() => result.current.logout())

    await waitFor(() => expect(localStorage.getItem(PERSISTED_QUERIES_KEY)).toBeNull())
  })
})
