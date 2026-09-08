import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { TenantProvider, useTenant } from "./TenantContext"
import { apiClient } from "@/core/api/apiClient"

const mockInitialRestaurants = [
  {
    id: "rest-burger-craft",
    slug: "burger-craft",
    name: "Burger Craft",
    tagline: "Artesanal",
    isActive: true,
    config: { name: "Burger Craft", tagline: "Artesanal" },
  },
  {
    id: "rest-2",
    slug: "pizza-hub",
    name: "Pizza Hub",
    tagline: "Italiana",
    isActive: false,
    config: { name: "Pizza Hub", tagline: "Italiana" },
  },
]

describe("TenantContext Optimistic Updates & Rollback", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("performs instantaneous optimistic deletion of restaurant in memory", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockInitialRestaurants as any)
    const deleteApiSpy = vi.spyOn(apiClient, "deleteRestaurant").mockResolvedValue({ message: "Deleted" })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants.length).toBeGreaterThan(0)
    })

    const targetId = result.current.restaurants[0].id

    await act(async () => {
      await result.current.deleteRestaurant(targetId)
    })

    // Instant in-memory soft delete (isActive becomes false)
    expect(result.current.restaurants.find((r) => r.id === targetId)?.isActive).toBe(false)
    expect(deleteApiSpy).toHaveBeenCalledWith(targetId)
  })

  it("rolls back state if backend deletion fails", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockInitialRestaurants as any)
    vi.spyOn(apiClient, "deleteRestaurant").mockRejectedValue(new Error("Server Failure"))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants.length).toBe(2)
    })

    const targetId = "rest-burger-craft"

    await act(async () => {
      await result.current.deleteRestaurant(targetId)
    })

    // Rollback restored the restaurant isActive status
    expect(result.current.restaurants.find((r) => r.id === targetId)?.isActive).toBe(true)
  })

  it("does NOT rollback state when backend returns 404 on deleteRestaurant", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockInitialRestaurants as any)
    const notFoundError: any = new Error("API Error: 404 Not Found")
    notFoundError.status = 404
    vi.spyOn(apiClient, "deleteRestaurant").mockRejectedValue(notFoundError)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants.length).toBe(2)
    })

    const targetId = "rest-burger-craft"

    await act(async () => {
      await result.current.deleteRestaurant(targetId)
    })

    // Should NOT rollback: isActive remains false because resource was already absent on server
    expect(result.current.restaurants.find((r) => r.id === targetId)?.isActive).toBe(false)
  })

  it("optimistically toggles active status instantly without reload", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockInitialRestaurants as any)
    vi.spyOn(apiClient, "updateRestaurant").mockResolvedValue({} as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants.length).toBeGreaterThan(0)
    })

    const target = result.current.restaurants[0]
    const originalStatus = target.isActive

    await act(async () => {
      await result.current.updateRestaurant(target.id, { isActive: !originalStatus })
    })

    const updated = result.current.restaurants.find((r) => r.id === target.id)
    expect(updated?.isActive).toBe(!originalStatus)
  })
})

describe("CatalogContext Additions Optimistic Updates & Rollback", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockInitialRestaurants as any)
  })

  it("rolls back local state when apiClient.createAddition fails", async () => {
    const { CatalogProvider, useCatalog } = await import("./CatalogContext")
    vi.spyOn(apiClient, "createAddition").mockRejectedValue(new Error("API Error 500"))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useCatalog(), { wrapper })
    const initialAdditionsCount = result.current.additions.length

    await act(async () => {
      result.current.addAddition({
        name: "Queso Costeño",
        price: 3000,
        available: true,
      })
    })

    // Rollback restored the original additions list
    expect(result.current.additions.length).toBe(initialAdditionsCount)
    expect(result.current.additions.some((a) => a.name === "Queso Costeño")).toBe(false)
  })

  it("rolls back local state when apiClient.updateAddition fails", async () => {
    const { CatalogProvider, useCatalog } = await import("./CatalogContext")
    vi.spyOn(apiClient, "createAddition").mockResolvedValue({
      id: "add-opt-1",
      name: "Tocineta Original",
      price: 2500,
      available: true,
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useCatalog(), { wrapper })

    await waitFor(() => {
      expect(result.current.additions).toBeDefined()
    })

    // First add an item successfully
    await act(async () => {
      result.current.addAddition({
        name: "Tocineta Original",
        price: 2500,
        available: true,
      })
    })

    await waitFor(() => {
      expect(result.current.additions.some((a) => a.name === "Tocineta Original")).toBe(true)
    })

    const targetItem = result.current.additions.find((a) => a.name === "Tocineta Original")
    expect(targetItem).toBeDefined()
    const additionId = targetItem!.id

    // Now fail updateAddition
    vi.spyOn(apiClient, "updateAddition").mockRejectedValue(new Error("API Error 500"))

    await act(async () => {
      result.current.updateAddition(additionId, {
        name: "Tocineta Super Crocante",
        price: 5000,
      })
    })

    await waitFor(() => {
      const item = result.current.additions.find((a) => a.id === additionId)
      expect(item?.name).toBe("Tocineta Original")
      expect(item?.price).toBe(2500)
    })
  })

  it("rolls back local state when apiClient.deleteAddition fails", async () => {
    const { CatalogProvider, useCatalog } = await import("./CatalogContext")
    vi.spyOn(apiClient, "createAddition").mockResolvedValue({
      id: "add-opt-2",
      name: "Salsa BBQ",
      price: 1500,
      available: true,
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useCatalog(), { wrapper })

    await waitFor(() => {
      expect(result.current.additions).toBeDefined()
    })

    // First add an item successfully
    await act(async () => {
      result.current.addAddition({
        name: "Salsa BBQ",
        price: 1500,
        available: true,
      })
    })

    await waitFor(() => {
      expect(result.current.additions.some((a) => a.name === "Salsa BBQ")).toBe(true)
    })

    const targetItem = result.current.additions.find((a) => a.name === "Salsa BBQ")
    expect(targetItem).toBeDefined()
    const additionId = targetItem!.id

    // Now fail deleteAddition
    vi.spyOn(apiClient, "deleteAddition").mockRejectedValue(new Error("API Error 500"))

    await act(async () => {
      result.current.deleteAddition(additionId)
    })

    await waitFor(() => {
      expect(result.current.additions.some((a) => a.id === additionId)).toBe(true)
    })
  })

  it("does NOT rollback state when backend returns 404 on deleteAddition", async () => {
    const { CatalogProvider, useCatalog } = await import("./CatalogContext")
    vi.spyOn(apiClient, "createAddition").mockResolvedValue({
      id: "add-opt-404",
      name: "Salsa Picante",
      price: 1800,
      available: true,
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useCatalog(), { wrapper })

    await waitFor(() => {
      expect(result.current.additions).toBeDefined()
    })

    await act(async () => {
      result.current.addAddition({
        name: "Salsa Picante",
        price: 1800,
        available: true,
      })
    })

    await waitFor(() => {
      expect(result.current.additions.some((a) => a.name === "Salsa Picante")).toBe(true)
    })

    const targetItem = result.current.additions.find((a) => a.name === "Salsa Picante")
    const additionId = targetItem!.id

    const notFoundError: any = new Error("API Error: 404 Not Found")
    notFoundError.status = 404
    vi.spyOn(apiClient, "deleteAddition").mockRejectedValue(notFoundError)

    await act(async () => {
      result.current.deleteAddition(additionId)
    })

    // Should NOT rollback: addition must remain deleted
    expect(result.current.additions.some((a) => a.id === additionId)).toBe(false)
  })

  it("does NOT rollback state when backend returns 404 on deleteProduct", async () => {
    const { CatalogProvider, useCatalog } = await import("./CatalogContext")
    vi.spyOn(apiClient, "createProduct").mockResolvedValue({
      id: "prod-opt-404",
      name: "Hamburguesa Ghost",
      description: "Deliciosa",
      price: 15000,
      category: "Burgers",
      inStock: true,
    } as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useCatalog(), { wrapper })

    await waitFor(() => {
      expect(result.current.products).toBeDefined()
    })

    await act(async () => {
      result.current.addProduct({
        name: "Hamburguesa Ghost",
        description: "Deliciosa",
        price: 15000,
        category: "Burgers",
        inStock: true,
      } as any)
    })

    await waitFor(() => {
      expect(result.current.products.some((p) => p.name === "Hamburguesa Ghost")).toBe(true)
    })

    const targetItem = result.current.products.find((p) => p.name === "Hamburguesa Ghost")
    const prodId = targetItem!.id

    const notFoundError: any = new Error("API Error: 404 Not Found")
    notFoundError.status = 404
    vi.spyOn(apiClient, "deleteProduct").mockRejectedValue(notFoundError)

    await act(async () => {
      result.current.deleteProduct(prodId)
    })

    // Should NOT rollback: product must remain deleted
    expect(result.current.products.some((p) => p.id === prodId)).toBe(false)
  })
})

describe("InventoryContext Optimistic Updates & Rollback", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockInitialRestaurants as any)
  })

  it("does NOT rollback state when backend returns 404 on deleteInventoryItem", async () => {
    const { InventoryProvider, useInventory } = await import("./InventoryContext")
    vi.spyOn(apiClient, "createInventoryItem").mockResolvedValue({
      id: "inv-opt-404",
      name: "Carne Premium",
      category: "ingredients",
      quantity: 50,
      unit: "unidades",
      minStockAlert: 10,
      alertThreshold: 10,
      costPerUnit: 5000,
      currentStock: 50,
      minStock: 10,
    } as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <InventoryProvider>{children}</InventoryProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useInventory(), { wrapper })

    await waitFor(() => {
      expect(result.current.inventory).toBeDefined()
    })

    await act(async () => {
      result.current.addInventoryItem({
        name: "Carne Premium",
        category: "ingredients",
        currentStock: 50,
        unit: "unidades",
        minStockAlert: 10,
        costPerUnit: 5000,
      } as any)
    })

    await waitFor(() => {
      expect(result.current.inventory.some((i) => i.name === "Carne Premium")).toBe(true)
    })

    const targetItem = result.current.inventory.find((i) => i.name === "Carne Premium")
    const invId = targetItem!.id

    const notFoundError: any = new Error("API Error: 404 Not Found")
    notFoundError.status = 404
    vi.spyOn(apiClient, "deleteInventoryItem").mockRejectedValue(notFoundError)

    await act(async () => {
      result.current.deleteInventoryItem(invId)
    })

    // Should NOT rollback: inventory item must remain deleted
    expect(result.current.inventory.some((i) => i.id === invId)).toBe(false)
  })
})



