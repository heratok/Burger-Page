import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { GlobalAnalytics } from "./GlobalAnalytics"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { apiClient } from "@/core/api/apiClient"
import { formatCurrency } from "@/lib/utils"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"

const SESSION_KEY = "burger_page_session_v2"

const seedSuperSession = () => {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ role: "super", userId: "usr-super", username: "super_admin" })
  )
}

const createTestRepo = () => {
  const adapter = new InMemoryStorageAdapter()
  adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  return new TenantRepository(adapter)
}

describe("GlobalAnalytics - Super Admin SaaS Performance Metrics (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders global platform KPIs, revenue summary, and restaurant breakdown ranking", () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <GlobalAnalytics />
      </RestaurantProvider>
    )

    // Header & Description
    expect(screen.getByText(/Métricas & Rendimiento Global SaaS/i)).toBeDefined()

    // KPI Cards
    expect(screen.getByText(/Facturación Consolidada/i)).toBeDefined()
    expect(screen.getByText(/Órdenes de Plataforma/i)).toBeDefined()
    expect(screen.getByText(/Locales Activos/i)).toBeDefined()
    expect(screen.getByText(/Ticket Promedio Global/i)).toBeDefined()

    // Ranking breakdown table
    expect(screen.getByText(/Ranking de Restaurantes por Facturación/i)).toBeDefined()
    expect(screen.getByText(/Burger Craft/i)).toBeDefined()
  })

  it("renders the metric cards skeleton, not placeholder zeros, while the platform stats load", async () => {
    seedSuperSession()
    vi.spyOn(apiClient, "fetchPlatformStats").mockReturnValue(new Promise(() => {}))

    render(
      <RestaurantProvider repository={createTestRepo()}>
        <GlobalAnalytics />
      </RestaurantProvider>
    )

    expect(await screen.findByTestId("metrics-skeleton")).toBeDefined()
    // The placeholder zeros must never be painted as if they were data.
    expect(screen.queryByText("Facturación Consolidada")).toBeNull()
    expect(screen.queryByText("$0")).toBeNull()
    expect(screen.queryByText(/0% de locales en línea/)).toBeNull()
  })

  it("renders an inline error with a working retry and no fabricated zeros when the platform stats fail", async () => {
    seedSuperSession()
    const fetchSpy = vi
      .spyOn(apiClient, "fetchPlatformStats")
      .mockRejectedValue(new Error("platform-stats-500"))

    render(
      <RestaurantProvider repository={createTestRepo()}>
        <GlobalAnalytics />
      </RestaurantProvider>
    )

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toMatch(/No se pudieron cargar las métricas/i)
    // A raw server string is not an operator-facing message.
    expect(alert.textContent).not.toContain("platform-stats-500")
    // No data-looking zeroes, no cards: the failure is the state.
    expect(screen.queryByText("Facturación Consolidada")).toBeNull()
    expect(screen.queryByText("$0")).toBeNull()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    fireEvent.click(within(alert).getByRole("button", { name: /Reintentar/i }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
  })

  // S9 residual — the skeleton and the error state belong to the period that
  // actually reads the platform totals (ALL). The other periods compute their
  // numbers locally from the tenants in this browser, so the fix must not follow
  // them: no skeleton, no platform error, no platform totals.
  const periodSelect = () => document.querySelector<HTMLSelectElement>('select[aria-label="Período"]')!
  /**
   * No session token in these tests, so the tenant directory stays empty: the
   * local aggregate of a non-ALL period is 0 / 0, which must never be replaced by
   * the platform's own totals.
   */
  const LOCAL_RESTAURANTS = 0

  it("keeps computing a non-ALL period locally instead of reusing the platform totals", async () => {
    seedSuperSession()
    const PLATFORM = {
      totalRevenue: 5_000_000,
      totalOrders: 999,
      cancelledOrders: 0,
      totalCustomers: 12,
      totalRestaurants: 7,
      activeRestaurants: 3,
    }
    // The two sources must differ, or the assertions below would not discriminate.
    expect(PLATFORM.totalRestaurants).not.toBe(LOCAL_RESTAURANTS)
    vi.spyOn(apiClient, "fetchPlatformStats").mockResolvedValue(PLATFORM)

    render(
      <RestaurantProvider repository={createTestRepo()}>
        <GlobalAnalytics />
      </RestaurantProvider>
    )

    // The ALL period does read the server totals.
    expect(await screen.findByText(formatCurrency(PLATFORM.totalRevenue))).toBeDefined()
    expect(screen.getByText(`/ ${PLATFORM.totalRestaurants}`)).toBeDefined()

    fireEvent.change(periodSelect(), { target: { value: "THIS_MONTH" } })

    // The cards stay, but from the tenants this browser knows, not the server totals.
    expect(screen.getByText("Facturación Consolidada")).toBeDefined()
    expect(screen.queryByText(formatCurrency(PLATFORM.totalRevenue))).toBeNull()
    expect(screen.queryByText(`/ ${PLATFORM.totalRestaurants}`)).toBeNull()
    expect(screen.getByText(`/ ${LOCAL_RESTAURANTS}`)).toBeDefined()
    expect(screen.getAllByText(formatCurrency(0)).length).toBeGreaterThan(0)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByTestId("metrics-skeleton")).toBeNull()
  })

  it("does not inherit the platform-stats failure in a period that computes locally", async () => {
    seedSuperSession()
    const fetchSpy = vi
      .spyOn(apiClient, "fetchPlatformStats")
      .mockRejectedValue(new Error("platform-stats-500"))

    render(
      <RestaurantProvider repository={createTestRepo()}>
        <GlobalAnalytics />
      </RestaurantProvider>
    )

    // ALL is the state the failure belongs to.
    expect(await screen.findByRole("alert")).toBeDefined()

    fireEvent.change(periodSelect(), { target: { value: "THIS_WEEK" } })

    // A locally computed period never shows the platform-stats error or skeleton.
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByTestId("metrics-skeleton")).toBeNull()
    expect(screen.getByText("Facturación Consolidada")).toBeDefined()
    expect(screen.getByText(`/ ${LOCAL_RESTAURANTS}`)).toBeDefined()

    // And switching period does not fire another platform read.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
