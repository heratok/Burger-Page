import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import React from "react"
import { GlobalAnalytics } from "./GlobalAnalytics"
import { RestaurantProvider } from "@/context/RestaurantContext"

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
      <RestaurantProvider>
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
