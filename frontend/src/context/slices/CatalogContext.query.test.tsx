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
import { CatalogProvider, useCatalog } from "./CatalogContext"
import { apiClient } from "@/core/api/apiClient"

const serverProduct = {
  id: "srv-1",
  name: "Burger",
  price: 10,
  category: "Clásicas",
  src: "",
  description: "",
  inStock: true,
} as any

const serverAddition = { id: "add-1", name: "Bacon", price: 2, available: true } as any

function setup(client = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    </QueryClientProvider>
  )
  return { client, wrapper }
}

/** A promise settled by hand, so in-flight states stay observable. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("CatalogContext server state (TanStack Query)", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.mocked(toast.error).mockClear()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchProducts").mockImplementation(async () => [{ ...serverProduct }])
    vi.spyOn(apiClient, "fetchAdditions").mockImplementation(async () => [{ ...serverAddition }])
  })

  it("hydrates products and additions and exposes loading until settled", async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useCatalog(), { wrapper })

    expect(result.current.isLoadingCatalog).toBe(true)
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["srv-1"]))
    await waitFor(() => expect(result.current.additions.map((a) => a.id)).toEqual(["add-1"]))
    await waitFor(() => expect(result.current.isLoadingCatalog).toBe(false))
    expect(apiClient.fetchProducts).toHaveBeenCalledTimes(1)
    expect(apiClient.fetchAdditions).toHaveBeenCalledTimes(1)
  })

  it("reuses cached data on remount within the same client instead of refetching", async () => {
    const { wrapper } = setup()
    const first = renderHook(() => useCatalog(), { wrapper })
    await waitFor(() => expect(first.result.current.products).toHaveLength(1))
    await waitFor(() => expect(first.result.current.additions).toHaveLength(1))
    first.unmount()

    const second = renderHook(() => useCatalog(), { wrapper })
    await waitFor(() => expect(second.result.current.products).toHaveLength(1))
    expect(apiClient.fetchProducts).toHaveBeenCalledTimes(1)
    expect(apiClient.fetchAdditions).toHaveBeenCalledTimes(1)
  })

  it("keys the cache per tenant", async () => {
    const { client, wrapper } = setup()
    const { result } = renderHook(() => ({ catalog: useCatalog(), tenant: useTenant() }), { wrapper })
    await waitFor(() => expect(result.current.catalog.products).toHaveLength(1))
    for (const resource of ["products", "additions"]) {
      const keys = client.getQueryCache().findAll({ queryKey: [resource] }).map((q) => q.queryKey)
      expect(keys).toHaveLength(1)
      expect(keys[0]).toContain(result.current.tenant.activeRestaurant.id)
    }
  })

  it("still loads the public menu when there is no token (storefront)", async () => {
    vi.mocked(apiClient.hasToken).mockReturnValue(false)
    const { wrapper } = setup()
    const { result } = renderHook(() => useCatalog(), { wrapper })

    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["srv-1"]))
    await waitFor(() => expect(result.current.additions.map((a) => a.id)).toEqual(["add-1"]))
    expect(apiClient.fetchProducts).toHaveBeenCalledWith({
      restaurantId: "rest-burger-craft",
      slug: "burger-craft",
    })
    expect(apiClient.fetchAdditions).toHaveBeenCalledWith({
      restaurantId: "rest-burger-craft",
      slug: "burger-craft",
    })
    expect(result.current.isLoadingCatalog).toBe(false)
  })

  it("keeps the persisted menu when the public fetch fails", async () => {
    vi.mocked(apiClient.hasToken).mockReturnValue(false)
    vi.mocked(apiClient.fetchProducts).mockRejectedValue(new Error("offline"))
    vi.mocked(apiClient.fetchAdditions).mockRejectedValue(new Error("offline"))
    const { wrapper } = setup()
    const { result } = renderHook(() => useCatalog(), { wrapper })
    await waitFor(() => expect(result.current.isLoadingCatalog).toBe(false))
    expect(result.current.products).toEqual([])
  })

  it("refetches authoritative server state after a write settles", async () => {
    vi.spyOn(apiClient, "updateProduct").mockResolvedValue({} as any)
    const { wrapper } = setup()
    const { result } = renderHook(() => useCatalog(), { wrapper })
    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(apiClient.fetchProducts).toHaveBeenCalledTimes(1)

    vi.mocked(apiClient.fetchProducts).mockImplementation(async () => [
      { ...serverProduct, name: "Burger XL" },
    ])
    act(() => result.current.updateProduct("srv-1", { name: "Burger XL" }))
    await waitFor(() => expect(apiClient.fetchProducts).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.products[0].name).toBe("Burger XL"))
  })

  it("revalidates every catalog resource once the last in-flight write settles", async () => {
    const productWrite = deferred<any>()
    const additionWrite = deferred<any>()
    vi.spyOn(apiClient, "updateProduct").mockReturnValue(productWrite.promise)
    vi.spyOn(apiClient, "updateAddition").mockReturnValue(additionWrite.promise)
    const { wrapper } = setup()
    const { result } = renderHook(() => useCatalog(), { wrapper })
    await waitFor(() => expect(result.current.additions).toHaveLength(1))

    act(() => {
      result.current.updateProduct("srv-1", { name: "Burger XL" })
      result.current.updateAddition("add-1", { name: "Bacon XL" })
    })
    await act(async () => productWrite.resolve({}))
    await act(() => new Promise((r) => setTimeout(r, 20)))
    // The addition write is still in flight: nothing is revalidated yet.
    expect(apiClient.fetchProducts).toHaveBeenCalledTimes(1)
    expect(apiClient.fetchAdditions).toHaveBeenCalledTimes(1)

    await act(async () => additionWrite.resolve({}))
    await waitFor(() => expect(apiClient.fetchProducts).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(apiClient.fetchAdditions).toHaveBeenCalledTimes(2))
  })

  it("keeps the loading flag off during the background refetch after a write", async () => {
    vi.spyOn(apiClient, "updateProduct").mockResolvedValue({} as any)
    const { wrapper } = setup()
    const loadingStates: boolean[] = []
    const { result } = renderHook(
      () => {
        const catalog = useCatalog()
        loadingStates.push(catalog.isLoadingCatalog)
        return catalog
      },
      { wrapper }
    )
    await waitFor(() => expect(result.current.isLoadingCatalog).toBe(false))
    await waitFor(() => expect(result.current.additions).toHaveLength(1))
    loadingStates.length = 0

    // Hold the background refetch open so an in-flight render is observable.
    const refetch = deferred<any[]>()
    vi.mocked(apiClient.fetchProducts).mockImplementation(() => refetch.promise)
    act(() => result.current.updateProduct("srv-1", { name: "Burger XL" }))
    await waitFor(() => expect(apiClient.fetchProducts).toHaveBeenCalledTimes(2))
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(result.current.isLoadingCatalog).toBe(false)

    await act(async () => refetch.resolve([{ ...serverProduct, name: "Burger XL" }]))
    await waitFor(() => expect(result.current.products[0].name).toBe("Burger XL"))
    expect(loadingStates).not.toContain(true)
  })

  it("rolls back a failed write immediately while the browser reports offline", async () => {
    vi.spyOn(apiClient, "updateProduct").mockRejectedValue(new Error("network down"))
    const { wrapper } = setup(createQueryClient())
    const { result } = renderHook(() => useCatalog(), { wrapper })
    await waitFor(() => expect(result.current.products).toHaveLength(1))

    onlineManager.setOnline(false)
    try {
      act(() => result.current.toggleProductStock("srv-1"))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(result.current.products[0].inStock).toBe(true)
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it("does not let an in-flight refetch wipe an optimistic edit made meanwhile", async () => {
    const write = deferred<any>()
    vi.spyOn(apiClient, "updateProduct").mockReturnValue(write.promise)
    const { client, wrapper } = setup()
    const { result } = renderHook(() => useCatalog(), { wrapper })
    await waitFor(() => expect(result.current.products).toHaveLength(1))
    await waitFor(() => expect(result.current.additions).toHaveLength(1))

    // A refetch starts (e.g. an invalidation) and is held open...
    const refetch = deferred<any[]>()
    vi.mocked(apiClient.fetchProducts).mockImplementation(() => refetch.promise)
    act(() => void client.invalidateQueries({ queryKey: ["products"] }))
    await waitFor(() => expect(apiClient.fetchProducts).toHaveBeenCalledTimes(2))

    // ...then the user edits while it is in flight.
    act(() => result.current.updateProduct("srv-1", { name: "Edited" }))
    expect(result.current.products[0].name).toBe("Edited")

    // The refetch answers with data that predates the edit.
    await act(async () => refetch.resolve([{ ...serverProduct, name: "Stale" }]))
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(result.current.products[0].name).toBe("Edited")

    // Once the write settles the server state is authoritative again.
    vi.mocked(apiClient.fetchProducts).mockImplementation(async () => [
      { ...serverProduct, name: "Edited" },
    ])
    await act(async () => write.resolve({}))
    await waitFor(() => expect(apiClient.fetchProducts).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(result.current.products[0].name).toBe("Edited"))
  })
})
