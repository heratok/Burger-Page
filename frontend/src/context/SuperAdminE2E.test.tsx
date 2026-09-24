import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act, render, screen, cleanup, fireEvent } from "@testing-library/react"
import React from "react"
import { RestaurantProvider, useRestaurant } from "./RestaurantContext"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"
import { MainRouter } from "@/App"
import * as routerModule from "@/core/router/useAppRouter"
import type { AdminTab } from "@/types/restaurant"

const createTestRepo = () => {
  const adapter = new InMemoryStorageAdapter()
  adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  return new TenantRepository(adapter)
}

// Hermetic test environment: refresh-on-session-change must never hit a
// real local backend during tests (TDD isolation).
const hermeticApi = async () => {
  const { apiClient } = await import("@/core/api/apiClient")
  vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))
  vi.spyOn(apiClient, "login").mockResolvedValue({
    success: true,
    token: "server-token",
    user: { id: "u1", username: "root", role: "super_admin" },
  } as any)
}

describe("Super Admin - Creación y Aislamiento de Nuevos Restaurantes E2E", () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    await hermeticApi()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RestaurantProvider repository={createTestRepo()}>{children}</RestaurantProvider>
  )

  it("permite al Super Admin crear un nuevo restaurante, personalizarlo, agregar platos y mantenerlo 100% aislado", async () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    // 1. Verificar estado inicial (4 restaurantes de fixture)
    expect(result.current.restaurants).toHaveLength(4)

        // 2. Autenticar como Super Admin (backend)
    await act(async () => {
          const auth = await result.current.login("root", "admin")
          expect(auth.success).toBe(true)
          expect(auth.role).toBe("super")
        })
    // 3. Crear un nuevo restaurante "Sushi Express"
    let createdRest: any
    act(() => {
      createdRest = result.current.createRestaurant({
        name: "Sushi Express Bogotá",
        slug: "sushi-express",
        tagline: "Rolls artesanales y cocina japonesa",
        whatsappNumber: "573119998877",
        adminPassword: "sushi",
        primaryColor: "#8B5CF6", // Púrpura
        templateType: "blank",
      })
    })

    // 4. Verificar que se agregó a la lista global y quedó seleccionado
    expect(createdRest).toBeDefined()
    expect(createdRest.slug).toBe("sushi-express")
    expect(result.current.restaurants).toHaveLength(5)
    expect(result.current.restaurants.some((r) => r.slug === "sushi-express")).toBe(true)
    expect(result.current.activeRestaurant.slug).toBe("sushi-express")
    expect(result.current.storeConfig.name).toBe("Sushi Express Bogotá")
    expect(result.current.storeConfig.primaryColor).toBe("#8B5CF6")
    expect(result.current.products).toHaveLength(0)

    // 5. Agregar un plato exclusivo para Sushi Express
    act(() => {
      result.current.addProduct({
        name: "Acevichado Roll (10 Bocados)",
        price: 29900,
        category: "Rolls Especiales",
        src: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
        description: "Langostino crocante, aguacate, atún fresco y salsa acevichada nikkei.",
        inStock: true,
      })
    })

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Acevichado Roll (10 Bocados)")

    // 6. Registrar una orden en Sushi Express
    act(() => {
      result.current.addOrder({
        customer: {
          nombre: "Andrea Restrepo",
          telefono: "3201112233",
          direccion: "Calle 127 # 7-15",
          barrio: "Santa Ana",
        },
        items: [
          {
            name: "Acevichado Roll (10 Bocados)",
            price: 29900,
            cantidad: 2,
            total: 59800,
          },
        ],
        total: 59800,
        deliveryFee: 5000,
        finalTotal: 64800,
        metodo: "Transferencia",
        status: "pending",
      })
    })

    expect(result.current.orders).toHaveLength(1)
    expect(result.current.customers).toHaveLength(1)

    // 7. Cambiar de restaurante a Burger Craft y verificar que los datos están 100% aislados
    act(() => {
      result.current.switchRestaurant("burger-craft")
    })

    expect(result.current.activeRestaurant.slug).toBe("burger-craft")
    expect(result.current.storeConfig.name).toBe("Burger Craft")
    expect(result.current.products.some((p) => p.name.includes("Acevichado"))).toBe(false)
    expect(result.current.customers.some((c) => c.nombre === "Andrea Restrepo")).toBe(false)

    // 8. Verificar que las métricas globales del Super Admin suman todos los locales
    expect(result.current.globalStats.totalRestaurants).toBe(5)
    expect(result.current.globalStats.totalOrders).toBe(3)
  })

  it("permite al Super Admin pausar/activar y eliminar restaurantes de la red", () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    // Crear un restaurante temporal
    let tempRest: any
    act(() => {
      tempRest = result.current.createRestaurant({
        name: "Café París",
        slug: "cafe-paris",
        tagline: "Café de especialidad y croissants",
        whatsappNumber: "573100001122",
        templateType: "blank",
      })
    })

    expect(result.current.restaurants).toHaveLength(5)

    // Pausar el restaurante
    act(() => {
      result.current.updateRestaurant(tempRest.id, { isActive: false })
    })

    const found = result.current.restaurants.find((r) => r.id === tempRest.id)
    expect(found?.isActive).toBe(false)
    expect(result.current.globalStats.activeRestaurants).toBe(4)

    // Eliminar el restaurante (Soft Delete - permanece en directorio pero inactivo)
    act(() => {
      result.current.deleteRestaurant(tempRest.id)
    })

    expect(result.current.restaurants).toHaveLength(5)
    expect(result.current.restaurants.find((r) => r.id === tempRest.id)?.isActive).toBe(false)
  })
})

describe("SUS-04 - Route-level gating of global SaaS modules in MainRouter", () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    await hermeticApi()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const AdminTabBootstrap = ({ tab }: { tab: AdminTab }) => {
    const { setAdminTab } = useRestaurant()
    React.useEffect(() => {
      setAdminTab(tab)
    }, [tab, setAdminTab])
    return null
  }

  const renderAdminRoute = (
    adminTab: AdminTab,
    session: { role: "super" | "restaurant"; restaurantId?: string },
    navigateToMock = vi.fn()
  ) => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ ...session, authenticatedAt: new Date().toISOString() })
    )
    vi.spyOn(routerModule, "useAppRouter").mockReturnValue({
      activeView: "admin",
      adminTab,
      isNotFound: false,
      attemptedSlug: null,
      navigateTo: navigateToMock,
    })
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <AdminTabBootstrap tab={adminTab} />
        <MainRouter />
      </RestaurantProvider>
    )
    return navigateToMock
  }

  it("bloquea a un admin de restaurante que entra directo a /admin/metrics: nunca renderiza GlobalAnalytics", async () => {
    renderAdminRoute("metrics", { role: "restaurant", restaurantId: "rest-burger-craft" })

    await screen.findByText(/No tienes permisos para acceder a este módulo global/i)

    // Contenido exclusivo de GlobalAnalytics: jamás debe estar presente
    expect(screen.queryByText(/Métricas & Rendimiento Global SaaS/i)).toBeNull()
    expect(screen.queryByText(/Facturación Consolidada/i)).toBeNull()
    expect(screen.queryByText(/Ranking de Restaurantes por Facturación/i)).toBeNull()
  })

  it("bloquea a un admin de restaurante que entra directo a /admin/restaurants", async () => {
    renderAdminRoute("restaurants", { role: "restaurant", restaurantId: "rest-burger-craft" })

    await screen.findByText(/No tienes permisos para acceder a este módulo global/i)

    // Contenido exclusivo de RestaurantsDirectory: jamás debe estar presente
    expect(screen.queryByPlaceholderText(/Buscar por nombre, slug o tipo/)).toBeNull()
  })

  it("bloquea a un admin de restaurante que entra directo a /admin/users", async () => {
    renderAdminRoute("users", { role: "restaurant", restaurantId: "rest-burger-craft" })

    await screen.findByText(/No tienes permisos para acceder a este módulo global/i)

    // Contenido exclusivo de UsersDirectory: jamás debe estar presente
    expect(screen.queryByText(/Directorio Global de Usuarios/i)).toBeNull()
  })

  it("el Super Admin sigue viendo GlobalAnalytics en /admin/metrics", async () => {
    renderAdminRoute("metrics", { role: "super" })

    // GlobalAnalytics is React.lazy inside Suspense: the chunk resolves under
    // jsdom load, so the default findBy* 1s timeout flakes on full-suite runs.
    // Wait generously for the lazy mount (and its content) to appear.
    await screen.findByText(/Métricas & Rendimiento Global SaaS/i, undefined, { timeout: 8000 })
    expect(screen.getByText(/Facturación Consolidada/i)).toBeDefined()
    expect(screen.queryByText(/No tienes permisos para acceder a este módulo global/i)).toBeNull()
  })

  it("el botón 'Volver al Dashboard' navega a /admin/dashboard", async () => {
    const navigateToMock = renderAdminRoute("metrics", {
      role: "restaurant",
      restaurantId: "rest-burger-craft",
    })

    const backButton = await screen.findByRole("button", { name: /Volver al Dashboard/i })
    fireEvent.click(backButton)
    expect(navigateToMock).toHaveBeenCalledWith("/admin/dashboard")
  })
})
