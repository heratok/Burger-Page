import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import React from "react"
import { TenantProvider, useTenant } from "./TenantContext"
import { apiClient } from "@/core/api/apiClient"

describe("TenantContext - Backend Multi-Tenant Integration", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it("syncs restaurants from backend API on mount", async () => {
    const mockBackendRestaurants: any[] = [
      {
        id: "rest-tacos",
        slug: "tacos-el-rey",
        name: "Tacos El Rey",
        tagline: "Sabor mexicano",
        theme: "clean-white",
        isActive: true,
        categories: ["Tacos", "Bebidas"],
      },
    ]

    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockBackendRestaurants as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants.some((r) => r.slug === "tacos-el-rey")).toBe(true)
    })
  })

  it("persists newly created restaurant to backend API", async () => {
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
    const createSpy = vi.spyOn(apiClient, "createRestaurant").mockResolvedValue({
      id: "rest-created-123",
      slug: "burgers-and-co",
      name: "Burgers & Co",
      tagline: "Best burgers in town",
      categories: ["General"],
    } as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    act(() => {
      result.current.createRestaurant({
        name: "Burgers & Co",
        slug: "burgers-and-co",
        tagline: "Best burgers in town",
        whatsappNumber: "573001234567",
      })
    })

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Burgers & Co",
        slug: "burgers-and-co",
      })
    )

    expect(result.current.restaurants.some((r) => r.slug === "burgers-and-co")).toBe(true)
  })

  it("calls backend delete endpoint when deleteRestaurant is called", async () => {
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
    const deleteSpy = vi.spyOn(apiClient, "deleteRestaurant").mockResolvedValue({
      message: "Deleted",
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    // Add two restaurants so we have > 1 to delete
    act(() => {
      result.current.createRestaurant({
        name: "Restaurant 1",
        slug: "rest-1",
        tagline: "Tagline 1",
        whatsappNumber: "111",
      })
      result.current.createRestaurant({
        name: "Restaurant 2",
        slug: "rest-2",
        tagline: "Tagline 2",
        whatsappNumber: "222",
      })
    })

    const restToDelete = result.current.restaurants[0]
    expect(restToDelete).toBeDefined()

    act(() => {
      result.current.deleteRestaurant(restToDelete.id)
    })

    expect(deleteSpy).toHaveBeenCalledWith(restToDelete.id)
  })

  it("updates restaurants to empty array when backend database is empty", async () => {
    // Seed local storage with old stale data
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({
        version: 2,
        superAdminPassword: "admin",
        restaurants: [
          {
            id: "rest-stale",
            slug: "stale-burger",
            adminPassword: "stale",
            isActive: true,
            config: { name: "Stale Burger", tagline: "Old" },
          },
        ],
      })
    )

    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants).toEqual([])
    })
  })
})
