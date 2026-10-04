import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { RestaurantsDirectory } from "../RestaurantsDirectory"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient, type DeletedRestaurantRecord } from "@/core/api/apiClient"
import { appQueryClient } from "@/core/query/queryClient"
import { keys } from "@/core/query/keys"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

const deleted: DeletedRestaurantRecord = {
  id: "rest-old",
  name: "Old Pizza",
  slug: "old-pizza",
  deletedAt: "2026-02-15T12:00:00.000Z",
}

const renderDirectory = () =>
  render(
    <RestaurantProvider>
      <RestaurantsDirectory />
    </RestaurantProvider>
  )

describe("RestaurantsDirectory deleted restaurants (query)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({
        version: 2,
        restaurants: [
          {
            id: "rest-live",
            slug: "live",
            isActive: true,
            createdAt: "2026-01-01T00:00:00Z",
            config: { ...DEFAULT_STORE_CONFIG, name: "Live" },
            categories: [],
            products: [],
            additions: [],
            orders: [],
            customers: [],
          },
        ],
      })
    )
    vi.spyOn(apiClient, "listUsers").mockResolvedValue([])
  })

  it("reuses the cached deleted list on remount instead of fetching again", async () => {
    const listSpy = vi.spyOn(apiClient, "listDeletedRestaurants").mockResolvedValue([deleted])

    const first = renderDirectory()
    await waitFor(() => expect(screen.getByRole("button", { name: /Eliminados \(1\)/ })).toBeDefined())
    first.unmount()

    renderDirectory()
    expect(screen.getByRole("button", { name: /Eliminados \(1\)/ })).toBeDefined()
    expect(listSpy).toHaveBeenCalledTimes(1)
  })

  it("revalidates the deleted list and the directory after a restore", async () => {
    let serverDeleted = [deleted]
    const listSpy = vi.spyOn(apiClient, "listDeletedRestaurants").mockImplementation(async () => serverDeleted)
    vi.spyOn(apiClient, "restoreRestaurant").mockImplementation(async () => {
      serverDeleted = []
      return { restaurant: {} as any, renamedUsers: [] }
    })
    const invalidateSpy = vi.spyOn(appQueryClient, "invalidateQueries")

    renderDirectory()
    fireEvent.click(screen.getByRole("button", { name: /Eliminados/i }))
    fireEvent.click(await screen.findByRole("button", { name: /Restaurar restaurante Old Pizza/i }))
    const callsBeforeRestore = listSpy.mock.calls.length
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Restauración/i }))

    await waitFor(() => expect(screen.queryByText("Old Pizza")).toBeNull())
    expect(listSpy.mock.calls.length).toBeGreaterThan(callsBeforeRestore)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.restaurants("guest") })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.deletedRestaurants("guest") })
  })

  it("shows the error toast and the empty deleted tab when the list cannot be read", async () => {
    const toastError = vi.spyOn(toast, "error")
    vi.spyOn(apiClient, "listDeletedRestaurants").mockRejectedValue(new Error("boom"))

    renderDirectory()

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("No se pudieron cargar los restaurantes eliminados")
    )
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: /^Eliminados\s*$/ })).toBeDefined()
  })
})
