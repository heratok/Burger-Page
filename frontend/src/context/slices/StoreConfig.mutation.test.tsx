import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { createTestQueryClient } from "@/test/testQueryClient"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import { keys } from "@/core/query/keys"
import { TENANT_WRITES_KEY } from "@/core/query/options"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { toast } from "sonner"
import { TenantProvider, useTenant } from "./TenantContext"
import { AuthProvider } from "./AuthContext"
import { CatalogProvider, useCatalog } from "./CatalogContext"
import { apiClient } from "@/core/api/apiClient"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const record = {
  id: "rest-a",
  slug: "a",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  config: { ...DEFAULT_STORE_CONFIG, name: "A", primaryColor: "#111111" },
  categories: [],
}

function setup(client: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <TenantProvider>
          <CatalogProvider>{children}</CatalogProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
  return { client, ...renderHook(() => ({ catalog: useCatalog(), tenant: useTenant() }), { wrapper }) }
}

describe("store config writes are tracked tenant mutations", () => {
  let serverColor: string

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    localStorage.setItem("burger_page_platform_v2", JSON.stringify({ version: 2, restaurants: [record] }))
    localStorage.setItem("burger_page_active_rest_v2", "rest-a")
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "super", authenticatedAt: new Date().toISOString() })
    )
    serverColor = "#111111"
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue([])
    vi.spyOn(apiClient, "fetchAdditions").mockResolvedValue([])
    vi.spyOn(apiClient, "listRestaurants").mockImplementation(async () => [
      { id: "rest-a", slug: "a", name: "A", isActive: true, config: { primaryColor: serverColor } },
    ] as any)
  })

  it("a directory refresh that lands during a pending config write neither reverts it nor is lost", async () => {
    const write = deferred<any>()
    vi.spyOn(apiClient, "updateRestaurant").mockReturnValue(write.promise)
    const { client, result } = setup()
    await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.tenant.isSyncing).toBe(false))

    act(() => result.current.catalog.updateStoreConfig({ primaryColor: "#222222" }))
    expect(result.current.catalog.storeConfig.primaryColor).toBe("#222222")
    expect(client.isMutating({ mutationKey: TENANT_WRITES_KEY })).toBe(1)

    await act(async () => {
      await result.current.tenant.refreshRestaurants()
    })
    // The stale directory (old color) must not wipe the optimistic config.
    expect(result.current.catalog.storeConfig.primaryColor).toBe("#222222")

    // Once the write settles the directory is pulled again.
    serverColor = "#222222"
    await act(async () => write.resolve({}))
    await waitFor(() => expect(apiClient.listRestaurants).toHaveBeenCalledTimes(3))
    expect(result.current.catalog.storeConfig.primaryColor).toBe("#222222")
    expect(toast.success).toHaveBeenCalledWith("Diseño y configuración actualizados")
  })

  it("a rejected config write restores the previous config with the error toast", async () => {
    vi.spyOn(apiClient, "updateRestaurant").mockRejectedValue(new Error("boom"))
    const { result } = setup()
    await waitFor(() => expect(result.current.tenant.isSyncing).toBe(false))

    act(() => result.current.catalog.updateStoreConfig({ primaryColor: "#333333" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al guardar la configuración en el servidor"))
    expect(result.current.catalog.storeConfig.primaryColor).toBe("#111111")
  })

  it("a settled config write marks the cached restaurant lookups stale", async () => {
    vi.spyOn(apiClient, "updateRestaurant").mockResolvedValue({} as any)
    const { client, result } = setup()
    await waitFor(() => expect(result.current.tenant.isSyncing).toBe(false))
    client.setQueryData(keys.restaurant("super", "a"), { id: "rest-a", slug: "a" })

    await act(async () => {
      result.current.catalog.resetStoreConfig()
    })

    await waitFor(() =>
      expect(client.getQueryCache().find({ queryKey: keys.restaurant("super", "a") })?.state.isInvalidated).toBe(true)
    )
  })
})
