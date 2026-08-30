import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import React from "react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import { AdminLayout } from "./AdminLayout"
import * as routerModule from "@/core/router/useAppRouter"

describe("AdminLayout - Super Admin Navigation & Global Modules (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders Global SaaS navigation modules (Restaurantes, Usuarios & Accesos, Métricas Globales) when Super Admin is in global mode", async () => {
    // Setup Super Admin session in global mode (/admin/restaurants)
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "super", authenticatedAt: new Date().toISOString() })
    )

    const TestComponent = () => {
      const { setAdminTab } = useRestaurant()
      React.useEffect(() => {
        setAdminTab("restaurants")
      }, [setAdminTab])

      return (
        <AdminLayout>
          <div>Contenido Directorio Global</div>
        </AdminLayout>
      )
    }

    render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    // Verify SaaS Global branding & dedicated navigation modules
    expect(screen.getAllByText(/Restaurantes/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Usuarios & Accesos/i)).toBeDefined()
    expect(screen.getByText(/Métricas Globales/i)).toBeDefined()

    // Impersonation return button should NOT be visible when in global SaaS mode
    expect(screen.queryByText(/Volver al Panel Super Admin/i)).toBeNull()
  })

  it("renders all restaurant modules, impersonation banner, and return button when Super Admin manages a restaurant", async () => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "super", authenticatedAt: new Date().toISOString() })
    )

    const navigateToMock = vi.fn()
    vi.spyOn(routerModule, "useAppRouter").mockReturnValue({
      activeView: "admin",
      adminTab: "dashboard",
      isNotFound: false,
      attemptedSlug: null,
      navigateTo: navigateToMock,
    })

    const TestComponent = () => {
      const { setAdminTab } = useRestaurant()
      React.useEffect(() => {
        setAdminTab("dashboard")
      }, [setAdminTab])

      return (
        <AdminLayout>
          <div>Dashboard de Restaurante</div>
        </AdminLayout>
      )
    }

    render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    // In tenant administration mode, Super Admin should see all restaurant operational modules
    expect(screen.getByText(/Pedidos en Vivo/i)).toBeDefined()
    expect(screen.getByText(/Menú & Carta/i)).toBeDefined()
    expect(screen.getByText(/Stock & Insumos/i)).toBeDefined()
    expect(screen.getByText(/Clientes CRM/i)).toBeDefined()
    expect(screen.getByText(/Reportes & Cierre/i)).toBeDefined()
    expect(screen.getByText(/Personalizador UI\/UX/i)).toBeDefined()

    // Contextual Impersonation Banner & Return Button MUST be visible
    const returnButtons = screen.getAllByRole("button", { name: /Volver al Panel Super Admin|Volver a SaaS/i })
    expect(returnButtons.length).toBeGreaterThan(0)

    // Clicking the return button must navigate back to /admin/restaurants
    fireEvent.click(returnButtons[0])
    expect(navigateToMock).toHaveBeenCalledWith("/admin/restaurants")
  })

  it("isolates regular restaurant admin: never shows Super Admin controls or return banners", async () => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({
        role: "restaurant",
        restaurantId: "burger-craft",
        authenticatedAt: new Date().toISOString(),
      })
    )

    const TestComponent = () => {
      const { setAdminTab } = useRestaurant()
      React.useEffect(() => {
        setAdminTab("dashboard")
      }, [setAdminTab])

      return (
        <AdminLayout>
          <div>Panel Local</div>
        </AdminLayout>
      )
    }

    render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    // Restaurant admin sees local operational modules
    expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Pedidos en Vivo/i)).toBeDefined()

    // Must NOT see Super Admin controls
    expect(screen.queryByText(/Métricas Globales/i)).toBeNull()
    expect(screen.queryByText(/Volver al Panel Super Admin/i)).toBeNull()
  })

  it("allows collapsing and expanding the sidebar on desktop", () => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({
        role: "restaurant",
        restaurantId: "burger-craft",
        authenticatedAt: new Date().toISOString(),
      })
    )

    const TestComponent = () => {
      const { setAdminTab } = useRestaurant()
      React.useEffect(() => {
        setAdminTab("dashboard")
      }, [setAdminTab])

      return (
        <AdminLayout>
          <div>Dashboard</div>
        </AdminLayout>
      )
    }

    render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    const collapseButtons = screen.getAllByRole("button", { name: /Contraer menú|Expandir menú/i })
    expect(collapseButtons.length).toBeGreaterThan(0)

    const aside = screen.getByRole("complementary")
    expect(aside.className).toContain("lg:w-64")

    // Click collapse
    fireEvent.click(collapseButtons[0])
    expect(aside.className).toContain("lg:w-16")

    // Click expand
    const expandButtons = screen.getAllByRole("button", { name: /Contraer menú|Expandir menú/i })
    fireEvent.click(expandButtons[0])
    expect(aside.className).toContain("lg:w-64")
  })
})
