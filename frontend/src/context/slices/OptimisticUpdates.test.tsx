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
})


