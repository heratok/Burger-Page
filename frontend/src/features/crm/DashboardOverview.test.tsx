import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { DashboardOverview } from "./DashboardOverview"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"
import type { StorageEnvelopeV2 } from "@/types/restaurant"

const createEmptyTestRepo = () => {
  const adapter = new InMemoryStorageAdapter()
  const emptyEnvelope: StorageEnvelopeV2 = {
    ...TEST_STORAGE_ENVELOPE,
    restaurants: TEST_STORAGE_ENVELOPE.restaurants.map((r) => ({
      ...r,
      orders: [],
      customers: [],
    })),
  }
  adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(emptyEnvelope))
  return new TenantRepository(adapter)
}

const createPopulatedTestRepo = () => {
  const adapter = new InMemoryStorageAdapter()
  adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  return new TenantRepository(adapter)
}

describe("DashboardOverview - Real Data & Empty State", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    vi.setSystemTime(new Date("2026-08-29T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it("renders clean empty state when there are no orders or sales in the database", () => {
    render(
      <RestaurantProvider repository={createEmptyTestRepo()}>
        <DashboardOverview />
      </RestaurantProvider>
    )

    expect(screen.getByText("Rendimiento de Ventas Semanal")).toBeDefined()
    expect(
      screen.getByText("No hay ventas registradas en los últimos 7 días.")
    ).toBeDefined()
    expect(screen.getByText("Sin órdenes completadas aún")).toBeDefined()
    expect(screen.getByText("0 pedidos")).toBeDefined()
    expect(
      screen.getByText("No hay pedidos registrados en el sistema.")
    ).toBeDefined()
    expect(screen.getByText("No hay ventas registradas aún.")).toBeDefined()
  })

  it("renders dynamic bars and metrics when valid orders exist in the envelope", () => {
    render(
      <RestaurantProvider repository={createPopulatedTestRepo()}>
        <DashboardOverview />
      </RestaurantProvider>
    )

    expect(screen.getByText("Santiago Restrepo")).toBeDefined()
    expect(screen.getByText("Burger Doble Queso")).toBeDefined()
    expect(
      screen.queryByText("No hay ventas registradas en los últimos 7 días.")
    ).toBeNull()
  })
})
