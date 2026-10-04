import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { EditRestaurantModal } from "../EditRestaurantModal"
import { UsersDirectory } from "../UsersDirectory"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"
import type { RestaurantRecord } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

const restaurant: RestaurantRecord = {
  id: "rest-1",
  slug: "rest-one",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  config: { ...DEFAULT_STORE_CONFIG, name: "Rest One" },
  categories: [],
  products: [],
  additions: [],
  orders: [],
  customers: [],
}

const admin = { id: "usr-a", username: "rest_admin", role: "restaurant_admin", restaurantId: "rest-1", isActive: true }

const Modal = ({ isOpen }: { isOpen: boolean }) => (
  <EditRestaurantModal isOpen={isOpen} onClose={vi.fn()} restaurant={restaurant} />
)

describe("EditRestaurantModal administrators (users query)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("does not read the administrators while the modal is closed", () => {
    const listSpy = vi.spyOn(apiClient, "listUsers").mockResolvedValue([admin] as any)
    render(
      <RestaurantProvider>
        <Modal isOpen={false} />
      </RestaurantProvider>
    )
    expect(listSpy).not.toHaveBeenCalled()
  })

  it("reuses the cached administrators when the modal is reopened", async () => {
    const listSpy = vi.spyOn(apiClient, "listUsers").mockResolvedValue([admin] as any)
    const { rerender } = render(
      <RestaurantProvider>
        <Modal isOpen={true} />
      </RestaurantProvider>
    )
    expect(await screen.findByText("rest_admin")).toBeDefined()

    rerender(
      <RestaurantProvider>
        <Modal isOpen={false} />
      </RestaurantProvider>
    )
    rerender(
      <RestaurantProvider>
        <Modal isOpen={true} />
      </RestaurantProvider>
    )
    expect(screen.getByText("rest_admin")).toBeDefined()
    expect(listSpy).toHaveBeenCalledTimes(1)
    expect(listSpy).toHaveBeenCalledWith("rest-1")
  })

  it("an administrator write also refreshes the global users directory", async () => {
    const listSpy = vi.spyOn(apiClient, "listUsers").mockImplementation(async () => [admin] as any)
    vi.spyOn(apiClient, "setUserActive").mockResolvedValue({ ...admin, isActive: false } as any)

    render(
      <RestaurantProvider>
        <UsersDirectory />
        <Modal isOpen={true} />
      </RestaurantProvider>
    )
    await waitFor(() => expect(screen.getAllByText("rest_admin").length).toBe(2))
    expect(listSpy).toHaveBeenCalledTimes(2) // global list + per-restaurant list

    fireEvent.click(screen.getByRole("button", { name: /Desactivar usuario rest_admin/i }))

    // Both lists are revalidated by the single invalidation.
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(4))
  })

  it("shows the error toast and the empty state when the administrators cannot be read", async () => {
    const toastError = vi.spyOn(toast, "error")
    vi.spyOn(apiClient, "listUsers").mockRejectedValue(new Error("boom"))

    render(
      <RestaurantProvider>
        <Modal isOpen={true} />
      </RestaurantProvider>
    )

    expect(await screen.findByText(/No hay administradores registrados/i)).toBeDefined()
    expect(toastError).toHaveBeenCalledTimes(1)
  })
})
