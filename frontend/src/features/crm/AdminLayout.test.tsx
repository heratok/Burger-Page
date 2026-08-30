import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import React from "react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import { AdminLayout } from "./AdminLayout"
import * as routerModule from "@/core/router/useAppRouter"

describe("AdminLayout - Super Admin Navigation & Quick Actions (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders Global SaaS directory and quick create action buttons when Super Admin is in global mode", async () => {
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

    // Verify SaaS Global branding & navigation item
    expect(screen.getAllByText(/Directorio Global SaaS/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Super Admin/i).length).toBeGreaterThan(0)

    // Verify Quick Creation Action Buttons in sidebar
    expect(screen.getByRole("button", { name: /\+ Nuevo Restaurante/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /\+ Nuevo Usuario/i })).toBeDefined()

    // Impersonation return button should NOT be visible when already in SaaS directory
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

  it("opens CreateRestaurantModal when clicking the quick create restaurant button", async () => {
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
          <div>Directorio</div>
        </AdminLayout>
      )
    }

    render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    const createRestBtn = screen.getByRole("button", { name: /\+ Nuevo Restaurante/i })
    fireEvent.click(createRestBtn)

    // Verify modal is open
    expect(screen.getByText(/Dar de Alta Nuevo Restaurante/i)).toBeDefined()
  })

  it("opens CreateUserModal when clicking the quick create user button", async () => {
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
          <div>Directorio</div>
        </AdminLayout>
      )
    }

    render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    const createUserBtn = screen.getByRole("button", { name: /\+ Nuevo Usuario/i })
    fireEvent.click(createUserBtn)

    // Verify modal is open (checking the modal title heading)
    expect(screen.getByRole("heading", { name: "Crear Usuario" })).toBeDefined()
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
    expect(screen.queryByText(/Directorio Global SaaS/i)).toBeNull()
    expect(screen.queryByText(/Volver al Panel Super Admin/i)).toBeNull()
    expect(screen.queryByRole("button", { name: /\+ Nuevo Restaurante/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /\+ Nuevo Usuario/i })).toBeNull()
  })
})
