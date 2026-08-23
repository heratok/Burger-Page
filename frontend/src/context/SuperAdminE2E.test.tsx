import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import React from "react"
import { RestaurantProvider, useRestaurant } from "./RestaurantContext"

describe("Super Admin - Creación y Aislamiento de Nuevos Restaurantes E2E", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RestaurantProvider>{children}</RestaurantProvider>
  )

  it("permite al Super Admin crear un nuevo restaurante, personalizarlo, agregar platos y mantenerlo 100% aislado", () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })

    // 1. Verificar estado inicial (3 restaurantes semilla)
    expect(result.current.restaurants).toHaveLength(3)

    // 2. Autenticar como Super Admin
    act(() => {
      const auth = result.current.login("admin")
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
    expect(result.current.restaurants).toHaveLength(4)
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
        isPopular: true,
      })
    })

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Acevichado Roll (10 Bocados)")

    // 6. Simular un pedido en Sushi Express
    act(() => {
      result.current.addOrder({
        customer: {
          nombre: "Andrea Restrepo",
          telefono: "3151234567",
          direccion: "Carrera 7 # 120-10",
          barrio: "Usaquén",
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
        deliveryFee: 4500,
        finalTotal: 64300,
        metodo: "Transferencia",
        status: "pending",
      })
    })

    expect(result.current.orders).toHaveLength(1)
    expect(result.current.customers).toHaveLength(1)
    expect(result.current.customers[0].nombre).toBe("Andrea Restrepo")

    // 7. Cambiar al restaurante original "Burger Craft" y verificar aislamiento total
    act(() => {
      result.current.switchRestaurant("burger-craft")
    })

    expect(result.current.activeRestaurant.slug).toBe("burger-craft")
    expect(result.current.storeConfig.name).toBe("Burger Craft")
    expect(result.current.storeConfig.primaryColor).toBe("#FF7A21") // Naranja intacto
    expect(result.current.products.some((p) => p.name.includes("Acevichado"))).toBe(false)
    expect(result.current.customers.some((c) => c.nombre === "Andrea Restrepo")).toBe(false)

    // 8. Verificar que las métricas globales del Super Admin suman todos los locales
    expect(result.current.globalStats.totalRestaurants).toBe(4)
    expect(result.current.globalStats.totalOrders).toBe(
      5 + 1 + 1 + 1 // 5 (Burger Craft) + 1 (Pizzería) + 1 (Tacos) + 1 (Sushi Express)
    )
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

    expect(result.current.restaurants).toHaveLength(4)

    // Pausar el restaurante
    act(() => {
      result.current.updateRestaurant(tempRest.id, { isActive: false })
    })

    const found = result.current.restaurants.find((r) => r.id === tempRest.id)
    expect(found?.isActive).toBe(false)
    expect(result.current.globalStats.activeRestaurants).toBe(3)

    // Eliminar el restaurante
    act(() => {
      result.current.deleteRestaurant(tempRest.id)
    })

    expect(result.current.restaurants).toHaveLength(3)
    expect(result.current.restaurants.some((r) => r.id === tempRest.id)).toBe(false)
  })
})
