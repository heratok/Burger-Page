import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { GlobalAnalytics } from "./GlobalAnalytics"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"

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
})
