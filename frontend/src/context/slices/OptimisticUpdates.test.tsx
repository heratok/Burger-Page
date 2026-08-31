import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { TenantProvider, useTenant } from "./TenantContext"
import { apiClient } from "@/core/api/apiClient"

describe("TenantContext Optimistic Updates & Rollback", () => {
  const mockInitialRestaurants = [
    {
      id: "rest-1",
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

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("performs instantaneous optimistic deletion of restaurant in memory", async () => {
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
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockInitialRestaurants as any)
    vi.spyOn(apiClient, "deleteRestaurant").mockRejectedValue(new Error("Server Failure"))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    await waitFor(() => {
      expect(result.current.restaurants.length).toBe(2)
    })

    const targetId = "rest-1"

    await act(async () => {
      await result.current.deleteRestaurant(targetId)
    })

    // Rollback restored the restaurant isActive status
    expect(result.current.restaurants.find((r) => r.id === targetId)?.isActive).toBe(true)
  })

  it("optimistically toggles active status instantly without reload", async () => {
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue(mockInitialRestaurants as any)

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
