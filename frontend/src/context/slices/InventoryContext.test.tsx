import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { toast } from "sonner"
import { TenantProvider } from "./TenantContext"
import { InventoryProvider, useInventory } from "./InventoryContext"
import { apiClient } from "@/core/api/apiClient"

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TenantProvider>
    <InventoryProvider>{children}</InventoryProvider>
  </TenantProvider>
)

const newItem = (name: string, stock: number) => ({
  name,
  category: "ingredients" as const,
  currentStock: stock,
  minStockAlert: 1,
  unit: "kg" as const,
  costPerUnit: 1,
})

async function setupWithItems() {
  vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
  vi.spyOn(apiClient, "createInventoryItem").mockImplementation(async (data: any) => ({
    id: `srv-${data.name}`,
    name: data.name,
    category: data.category,
    currentStock: data.quantity,
    minStockAlert: data.minStockAlert,
    unit: data.unit,
    costPerUnit: data.costPerUnit,
  }) as any)
  const hook = renderHook(() => useInventory(), { wrapper })
  act(() => {
    hook.result.current.addInventoryItem(newItem("Pan", 10))
    hook.result.current.addInventoryItem(newItem("Queso", 5))
  })
  await waitFor(() => {
    const ids = hook.result.current.inventory.map((i) => i.id)
    expect(ids).toContain("srv-Pan")
    expect(ids).toContain("srv-Queso")
  })
  return hook
}

const stock = (hook: { result: { current: { inventory: any[] } } }, id: string) =>
  hook.result.current.inventory.find((i) => i.id === id)?.currentStock

describe("InventoryContext (5.2 UI / 5.4)", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.info).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it("rolls back only the failed adjust by its delta when a second adjust already applied (5.4)", async () => {
    const hook = await setupWithItems()
    let rejectSecond!: (e: Error) => void
    vi.spyOn(apiClient, "updateInventoryStock")
      .mockResolvedValueOnce({} as any)
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectSecond = rej }))

    act(() => {
      hook.result.current.adjustStock("srv-Pan", 3)
      hook.result.current.adjustStock("srv-Pan", 2)
    })
    expect(stock(hook, "srv-Pan")).toBe(15)

    await act(async () => {
      rejectSecond(new Error("nope"))
    })
    // First click was accepted: only the rejected +2 is undone.
    await waitFor(() => expect(stock(hook, "srv-Pan")).toBe(13))
    expect(stock(hook, "srv-Queso")).toBe(5)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("does not wipe unrelated concurrent edits when an adjust fails (5.4)", async () => {
    const hook = await setupWithItems()
    let rejectAdjust!: (e: Error) => void
    vi.spyOn(apiClient, "updateInventoryStock").mockImplementation(() => new Promise((_, rej) => { rejectAdjust = rej }))
    vi.spyOn(apiClient, "updateInventoryItem").mockResolvedValue({} as any)

    act(() => {
      hook.result.current.adjustStock("srv-Pan", 1)
      hook.result.current.updateInventoryItem("srv-Queso", { costPerUnit: 99 })
    })
    await act(async () => {
      rejectAdjust(new Error("nope"))
    })
    await waitFor(() => expect(stock(hook, "srv-Pan")).toBe(10))
    expect(hook.result.current.inventory.find((i) => i.id === "srv-Queso")?.costPerUnit).toBe(99)
  })

  it("emits exactly one toast per adjust, outside the state updater (5.4)", async () => {
    const hook = await setupWithItems()
    vi.spyOn(apiClient, "updateInventoryStock").mockResolvedValue({} as any)
    vi.mocked(toast.success).mockClear()

    act(() => {
      hook.result.current.adjustStock("srv-Pan", 4)
    })
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('+4 añadido a "Pan" (Total: 14)')
  })

  it("shows the server message when a create is rejected with 409 and removes only the temp item (5.2)", async () => {
    const hook = await setupWithItems()
    const conflict: any = new Error("An inventory item named 'Pan' already exists.")
    conflict.status = 409
    vi.spyOn(apiClient, "createInventoryItem").mockRejectedValue(conflict)

    act(() => {
      hook.result.current.addInventoryItem(newItem("Pan", 1))
    })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("An inventory item named 'Pan' already exists."))
    const names = hook.result.current.inventory.map((i) => i.name)
    expect(names.filter((n) => n === "Pan")).toHaveLength(1)
    expect(names).toContain("Queso")
  })

  it("shows the server message and reverts only that item when an update is rejected with 409 (5.2)", async () => {
    const hook = await setupWithItems()
    const conflict: any = new Error("An inventory item named 'Queso' already exists.")
    conflict.status = 409
    vi.spyOn(apiClient, "updateInventoryItem").mockRejectedValue(conflict)

    act(() => {
      hook.result.current.updateInventoryItem("srv-Pan", { name: "Queso" })
    })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("An inventory item named 'Queso' already exists."))
    expect(hook.result.current.inventory.find((i) => i.id === "srv-Pan")?.name).toBe("Pan")
  })
})
