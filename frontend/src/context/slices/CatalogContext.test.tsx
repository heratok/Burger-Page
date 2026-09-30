import React from "react"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { toast } from "sonner"
import { TenantProvider } from "./TenantContext"
import { CatalogProvider, useCatalog } from "./CatalogContext"
import { apiClient } from "@/core/api/apiClient"

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TenantProvider>
    <CatalogProvider>{children}</CatalogProvider>
  </TenantProvider>
)

async function setupWithProduct() {
  vi.spyOn(apiClient, "createProduct").mockImplementation(async (data: any) => ({
    id: "prod-1",
    name: data.name,
    price: data.price,
    category: data.category,
    src: "",
    description: "",
    inStock: data.isAvailable ?? true,
  }))
  const hook = renderHook(() => useCatalog(), { wrapper })
  act(() => {
    hook.result.current.addProduct({
      name: "Burger",
      price: 10,
      category: "Clásicas",
      src: "",
      description: "",
      inStock: true,
    })
  })
  await waitFor(() => expect(hook.result.current.products.some((p) => p.id === "prod-1")).toBe(true))
  return hook
}

describe("CatalogContext.toggleProductStock (5.5)", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.mocked(toast.info).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it("sends the active restaurantId and the computed availability", async () => {
    const updateSpy = vi.spyOn(apiClient, "updateProduct").mockResolvedValue({} as any)
    const { result } = await setupWithProduct()

    act(() => {
      result.current.toggleProductStock("prod-1")
    })

    expect(updateSpy).toHaveBeenCalledTimes(1)
    const [id, payload, restaurantId] = updateSpy.mock.calls[0]
    expect(id).toBe("prod-1")
    expect(payload).toEqual({ isAvailable: false })
    expect(typeof restaurantId).toBe("string")
    expect(restaurantId).toBeTruthy()
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith("Producto marcado como Agotado")
  })

  it("rolls back only the toggled product when the server rejects", async () => {
    vi.spyOn(apiClient, "updateProduct").mockRejectedValue(new Error("boom"))
    const { result } = await setupWithProduct()

    await act(async () => {
      result.current.toggleProductStock("prod-1")
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(result.current.products.find((p) => p.id === "prod-1")?.inStock).toBe(true)
  })
})
