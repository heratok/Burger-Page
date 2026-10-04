import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { seedBlankActiveTenant, TEST_PRODUCTS, TEST_ADDITIONS } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { keys } from "@/core/query/keys"
import { STORAGE_KEYS, TenantRepository } from "@/core/storage/TenantRepository"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { PendingOrdersQueue } from "@/core/storage/pendingOrdersQueue"
import type { MenuItem } from "@/types/restaurant"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { toast } from "sonner"
import { TenantProvider, useTenant } from "./TenantContext"
import { CatalogProvider, useCatalog } from "./CatalogContext"
import { apiClient } from "@/core/api/apiClient"

const TENANT = "rest-burger-craft"
const SLUG = "burger-craft"
const PRODUCTS_KEY = keys.products(TENANT, "guest", SLUG)

function setup(client: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    </QueryClientProvider>
  )
  return { client, ...renderHook(() => ({ catalog: useCatalog(), tenant: useTenant() }), { wrapper }) }
}

describe("CatalogContext reads and writes the query cache", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.mocked(toast.error).mockClear()
    vi.spyOn(apiClient, "fetchProducts").mockImplementation(async () => TEST_PRODUCTS.map((p) => ({ ...p })))
    vi.spyOn(apiClient, "fetchAdditions").mockImplementation(async () => TEST_ADDITIONS.map((a) => ({ ...a })))
  })

  it("products, additions and the derived categories come from the query data", async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.catalog.products).toHaveLength(2))
    expect(result.current.catalog.additions.map((a) => a.id)).toEqual(["add-1", "add-2"])
    expect(result.current.catalog.categories).toEqual(["Clásicas", "Acompañamientos"])
  })

  it("a product write cancels in-flight reads and lands in the cache, not in the tenant record", async () => {
    vi.spyOn(apiClient, "updateProduct").mockImplementation(() => new Promise(() => {}))
    const { client, result } = setup()
    await waitFor(() => expect(result.current.catalog.products).toHaveLength(2))
    const record = result.current.tenant.activeRestaurant
    const cancelSpy = vi.spyOn(client, "cancelQueries")

    act(() => result.current.catalog.toggleProductStock("prod-1"))

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: PRODUCTS_KEY })
    expect(client.getQueryData<MenuItem[]>(PRODUCTS_KEY)?.find((p) => p.id === "prod-1")?.inStock).toBe(false)
    expect(result.current.tenant.activeRestaurant).toBe(record)
    // No tenant envelope is written at all any more.
    expect(localStorage.getItem(STORAGE_KEYS.ENVELOPE)).toBeNull()
  })

  it("a rejected product edit restores the cached snapshot and shows the error toast", async () => {
    vi.spyOn(apiClient, "updateProduct").mockRejectedValue(new Error("boom"))
    const { client, result } = setup()
    await waitFor(() => expect(result.current.catalog.products).toHaveLength(2))

    act(() => result.current.catalog.updateProduct("prod-1", { name: "Nuevo nombre" }))
    expect(result.current.catalog.products.find((p) => p.id === "prod-1")?.name).toBe("Nuevo nombre")

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al actualizar producto en el servidor"))
    expect(client.getQueryData<MenuItem[]>(PRODUCTS_KEY)?.find((p) => p.id === "prod-1")?.name).toBe("Burger Doble Queso")
  })

  it("loadEnvelope derives categories from persisted products, then drops products and additions", () => {
    const adapter = new InMemoryStorageAdapter()
    adapter.setItem(
      STORAGE_KEYS.ENVELOPE,
      JSON.stringify({
        version: 2,
        restaurants: [
          { id: "r1", slug: "r1", isActive: true, createdAt: "", config: {}, categories: [], products: TEST_PRODUCTS, additions: TEST_ADDITIONS },
        ],
      })
    )
    const [record] = new TenantRepository(adapter, new PendingOrdersQueue(adapter)).loadEnvelope().restaurants
    expect(record.categories).toEqual(["Clásicas", "Acompañamientos"])
    expect(record.products).toBeUndefined()
    expect(record.additions).toBeUndefined()
  })
})
