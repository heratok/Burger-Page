import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import React from "react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import { SupportModeBanner } from "./SupportModeBanner"
import * as routerModule from "@/core/router/useAppRouter"

import { seedBlankActiveTenant } from "@/test/fixtures"

describe("SupportModeBanner (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders banner with restaurant name and 'Volver al panel' when super admin enters a restaurant admin", () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", { name: "Burger Craft" })
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "super", username: "superadmin", authenticatedAt: new Date().toISOString() })
    )

    const TestComponent = () => {
      const { setAdminTab, switchRestaurant } = useRestaurant()
      React.useEffect(() => {
        switchRestaurant("rest-burger-craft")
        setAdminTab("dashboard")
      }, [setAdminTab, switchRestaurant])

      return <SupportModeBanner />
    }

    render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Modo soporte: estás viendo «Burger Craft»/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Volver al panel/i })).toBeDefined()
  })

  it("does not show banner for restaurant admin in their own restaurant", () => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({
        role: "restaurant",
        username: "admin_craft",
        restaurantId: "burger-craft",
        authenticatedAt: new Date().toISOString(),
      })
    )

    const TestComponent = () => {
      const { setAdminTab, switchRestaurant } = useRestaurant()
      React.useEffect(() => {
        switchRestaurant("burger-craft")
        setAdminTab("dashboard")
      }, [setAdminTab, switchRestaurant])

      return <SupportModeBanner />
    }

    const { container } = render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    expect(screen.queryByText(/Modo soporte:/i)).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it("does not show banner for super admin on super admin screens (restaurants, users, metrics, audit)", () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", { name: "Burger Craft" })
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "super", username: "superadmin", authenticatedAt: new Date().toISOString() })
    )

    const TestComponent = ({ tab }: { tab: "restaurants" | "users" | "metrics" | "audit" }) => {
      const { setAdminTab, switchRestaurant } = useRestaurant()
      React.useEffect(() => {
        switchRestaurant("rest-burger-craft")
        setAdminTab(tab)
      }, [setAdminTab, switchRestaurant, tab])

      return <SupportModeBanner />
    }

    const { rerender } = render(
      <RestaurantProvider>
        <TestComponent tab="restaurants" />
      </RestaurantProvider>
    )
    expect(screen.queryByText(/Modo soporte:/i)).toBeNull()

    rerender(
      <RestaurantProvider>
        <TestComponent tab="users" />
      </RestaurantProvider>
    )
    expect(screen.queryByText(/Modo soporte:/i)).toBeNull()

    rerender(
      <RestaurantProvider>
        <TestComponent tab="metrics" />
      </RestaurantProvider>
    )
    expect(screen.queryByText(/Modo soporte:/i)).toBeNull()

    rerender(
      <RestaurantProvider>
        <TestComponent tab="audit" />
      </RestaurantProvider>
    )
    expect(screen.queryByText(/Modo soporte:/i)).toBeNull()
  })

  it("clicking 'Volver al panel' leaves tenant context and navigates to /admin/restaurants", () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", { name: "Burger Craft" })
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "super", username: "superadmin", authenticatedAt: new Date().toISOString() })
    )

    const navigateToMock = vi.fn()
    vi.spyOn(routerModule, "useAppRouter").mockReturnValue({
      activeView: "admin",
      adminTab: "dashboard",
      isNotFound: false,
      isResolving: false,
      attemptedSlug: null,
      loadError: false,
      retry: vi.fn(),
      navigateTo: navigateToMock,
    })

    const TestComponent = () => {
      const { setAdminTab, switchRestaurant } = useRestaurant()
      const initialized = React.useRef(false)
      React.useEffect(() => {
        if (!initialized.current) {
          initialized.current = true
          switchRestaurant("rest-burger-craft")
          setAdminTab("dashboard")
        }
      }, [setAdminTab, switchRestaurant])

      return <SupportModeBanner />
    }

    render(
      <RestaurantProvider>
        <TestComponent />
      </RestaurantProvider>
    )

    const returnBtn = screen.getByRole("button", { name: /Volver al panel/i })
    fireEvent.click(returnBtn)

    expect(navigateToMock).toHaveBeenCalledWith("/admin/restaurants")
    expect(screen.queryByText(/Modo soporte:/i)).toBeNull()
  })
})
