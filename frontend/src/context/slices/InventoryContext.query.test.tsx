import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, onlineManager } from "@tanstack/react-query"
import { toast } from "sonner"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { createQueryClient } from "@/core/query/queryClient"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { TenantProvider, useTenant } from "./TenantContext"
import { InventoryProvider, useInventory } from "./InventoryContext"
import { apiClient } from "@/core/api/apiClient"

const serverItem = {
  id: "srv-1",
  name: "Pan",
  category: "ingredients",
  currentStock: 4,
  minStockAlert: 1,
  unit: "kg",
  costPerUnit: 2,
} as any

function setup(client = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <TenantProvider>
        <InventoryProvider>{children}</InventoryProvider>
      </TenantProvider>
    </QueryClientProvider>
  )
  return { client, wrapper }
}

describe("InventoryContext server state (TanStack Query)", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchSuppliers").mockResolvedValue([] as any)
  })

  it("hydrates inventory from the backend and exposes loading until settled", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([serverItem])
    const { wrapper } = setup()
    const { result } = renderHook(() => useInventory(), { wrapper })

    expect(result.current.isLoadingInventory).toBe(true)
    await waitFor(() => expect(result.current.inventory.map((i) => i.id)).toEqual(["srv-1"]))
    await waitFor(() => expect(result.current.isLoadingInventory).toBe(false))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("reuses cached data on remount within the same client instead of refetching", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([serverItem])
    const { wrapper } = setup()
    const first = renderHook(() => useInventory(), { wrapper })
    await waitFor(() => expect(first.result.current.inventory).toHaveLength(1))
    first.unmount()

    const second = renderHook(() => useInventory(), { wrapper })
    await waitFor(() => expect(second.result.current.inventory).toHaveLength(1))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("keys the cache per tenant", async () => {
    vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([serverItem])
    const { client, wrapper } = setup()
    const { result } = renderHook(() => ({ inv: useInventory(), tenant: useTenant() }), { wrapper })
    await waitFor(() => expect(result.current.inv.inventory).toHaveLength(1))
    const keys = client.getQueryCache().findAll({ queryKey: ["inventory"] }).map((q) => q.queryKey)
    expect(keys).toHaveLength(1)
    expect(keys[0]).toContain(result.current.tenant.activeRestaurant.id)
  })

  it("does not fetch when there is no token", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const fetchSpy = vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([serverItem])
    const { wrapper } = setup()
    const { result } = renderHook(() => useInventory(), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.isLoadingInventory).toBe(false)
  })

  it("refetches authoritative server state after a mutation settles", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([serverItem])
    vi.spyOn(apiClient, "updateInventoryStock").mockResolvedValue({} as any)
    const { wrapper } = setup()
    const { result } = renderHook(() => useInventory(), { wrapper })
    await waitFor(() => expect(result.current.inventory).toHaveLength(1))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fetchSpy.mockResolvedValue([{ ...serverItem, currentStock: 9 }])
    act(() => result.current.adjustStock("srv-1", 5))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.inventory[0].currentStock).toBe(9))
  })

  it("keeps the loading flag off during the background refetch after a write", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([serverItem])
    vi.spyOn(apiClient, "updateInventoryStock").mockResolvedValue({} as any)
    const { wrapper } = setup()
    const loadingStates: boolean[] = []
    const { result } = renderHook(
      () => {
        const inv = useInventory()
        loadingStates.push(inv.isLoadingInventory)
        return inv
      },
      { wrapper }
    )
    await waitFor(() => expect(result.current.isLoadingInventory).toBe(false))
    loadingStates.length = 0

    // Hold the background refetch open so an in-flight render is observable.
    let releaseRefetch: (items: any[]) => void = () => {}
    fetchSpy.mockImplementation(() => new Promise((resolve) => (releaseRefetch = resolve)))
    act(() => result.current.adjustStock("srv-1", 5))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(result.current.isLoadingInventory).toBe(false)

    await act(async () => releaseRefetch([{ ...serverItem, currentStock: 9 }]))
    await waitFor(() => expect(result.current.inventory[0].currentStock).toBe(9))
    expect(loadingStates).not.toContain(true)
  })

  it("rolls back a failed write immediately while the browser reports offline", async () => {
    vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([serverItem])
    vi.spyOn(apiClient, "updateInventoryStock").mockRejectedValue(new Error("network down"))
    const { wrapper } = setup(createQueryClient())
    const { result } = renderHook(() => useInventory(), { wrapper })
    await waitFor(() => expect(result.current.inventory).toHaveLength(1))

    onlineManager.setOnline(false)
    try {
      act(() => result.current.adjustStock("srv-1", 5))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(result.current.inventory[0].currentStock).toBe(4)
    } finally {
      onlineManager.setOnline(true)
    }
  })
})
