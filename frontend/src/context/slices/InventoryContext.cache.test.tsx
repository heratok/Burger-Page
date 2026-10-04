import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { keys } from "@/core/query/keys"
import { STORAGE_KEYS, TenantRepository } from "@/core/storage/TenantRepository"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { PendingOrdersQueue } from "@/core/storage/pendingOrdersQueue"
import type { InventoryItem, Supplier } from "@/types/restaurant"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { TenantProvider, useTenant } from "./TenantContext"
import { InventoryProvider, useInventory } from "./InventoryContext"
import { apiClient } from "@/core/api/apiClient"

const TENANT = "rest-burger-craft"
const item = (id: string, currentStock: number, extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id,
  name: `Item ${id}`,
  category: "ingredients",
  currentStock,
  minStockAlert: 2,
  unit: "kg",
  costPerUnit: 10,
  ...extra,
})
const supplier = (id: string): Supplier => ({ id, name: `Sup ${id}`, category: "x", contactName: "c", phone: "1" })

function setup(client: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <TenantProvider>
        <InventoryProvider>{children}</InventoryProvider>
      </TenantProvider>
    </QueryClientProvider>
  )
  return { client, ...renderHook(() => ({ inv: useInventory(), tenant: useTenant() }), { wrapper }) }
}

describe("InventoryContext reads and writes the query cache", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
  })

  it("useInventory and its totals derive from the inventory and suppliers query data", () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const { client, result } = setup()

    act(() => {
      client.setQueryData(keys.inventory(TENANT, "guest"), [item("a", 1), item("b", 5)])
      client.setQueryData(keys.suppliers(TENANT, "guest"), [supplier("s1")])
    })

    expect(result.current.inv.inventory.map((i) => i.id)).toEqual(["a", "b"])
    expect(result.current.inv.suppliers.map((s) => s.id)).toEqual(["s1"])
    expect(result.current.inv.lowStockCount).toBe(1)
    expect(result.current.inv.totalInventoryValue).toBe(60)
  })

  it("an optimistic write cancels in-flight reads and lands in the cache, not in the tenant record", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([item("a", 1)] as any)
    vi.spyOn(apiClient, "fetchSuppliers").mockResolvedValue([] as any)
    vi.spyOn(apiClient, "updateInventoryStock").mockImplementation(() => new Promise(() => {}))
    const { client, result } = setup()
    await waitFor(() => expect(result.current.inv.inventory).toHaveLength(1))
    const record = result.current.tenant.activeRestaurant
    const cancelSpy = vi.spyOn(client, "cancelQueries")

    act(() => result.current.inv.adjustStock("a", 3))

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: keys.inventory(TENANT, "guest") })
    expect(client.getQueryData<InventoryItem[]>(keys.inventory(TENANT, "guest"))?.[0].currentStock).toBe(4)
    expect(result.current.tenant.activeRestaurant).toBe(record)
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.ENVELOPE)!).restaurants[0]
    expect(persisted.inventory ?? []).toEqual([])
  })

  it("a rejected supplier edit restores the cached list", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([] as any)
    vi.spyOn(apiClient, "fetchSuppliers").mockResolvedValue([supplier("s1")] as any)
    vi.spyOn(apiClient, "updateSupplier").mockRejectedValue(new Error("boom"))
    const { client, result } = setup()
    await waitFor(() => expect(result.current.inv.suppliers).toHaveLength(1))

    act(() => result.current.inv.updateSupplier("s1", { name: "Nuevo" }))
    expect(result.current.inv.suppliers[0].name).toBe("Nuevo")

    await waitFor(() => expect(result.current.inv.suppliers[0].name).toBe("Sup s1"))
    expect(client.getQueryData<Supplier[]>(keys.suppliers(TENANT, "guest"))?.[0].name).toBe("Sup s1")
  })

  it("loadEnvelope drops inventory and suppliers persisted by the previous version", () => {
    const adapter = new InMemoryStorageAdapter()
    adapter.setItem(
      STORAGE_KEYS.ENVELOPE,
      JSON.stringify({
        version: 2,
        restaurants: [
          { id: "r1", slug: "r1", isActive: true, createdAt: "", config: {}, categories: ["A"], products: [], additions: [], inventory: [item("a", 1)], suppliers: [supplier("s1")] },
        ],
      })
    )
    const [record] = new TenantRepository(adapter, new PendingOrdersQueue(adapter)).loadEnvelope().restaurants
    expect(record.inventory).toBeUndefined()
    expect(record.suppliers).toBeUndefined()
  })
})
