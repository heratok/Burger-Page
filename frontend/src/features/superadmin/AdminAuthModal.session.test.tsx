import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"
import { apiClient } from "@/core/api/apiClient"
import { AdminAuthModal } from "./AdminAuthModal"

const createRepo = () => {
  const adapter = new InMemoryStorageAdapter()
  adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  return new TenantRepository(adapter)
}

describe("AdminAuthModal - a new session never renders the previous session's tab", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    window.history.pushState({}, "", "/")
  })

  it("moves a restaurant admin off a super-only URL before the restaurant refresh settles", async () => {
    window.history.pushState({}, "", "/admin/audit")
    vi.spyOn(apiClient, "login").mockResolvedValue({
      success: true,
      token: "server-token",
      user: { id: "u2", username: "napoli", role: "restaurant_admin", restaurantId: "rest-pizzeria-napoli" },
    } as any)
    // The refresh never settles: whatever is on screen meanwhile is what the user sees.
    vi.spyOn(apiClient, "listRestaurants").mockReturnValue(new Promise(() => {}))
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([])
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])

    const seen: Array<{ role: string; tab: string }> = []
    const Probe = () => {
      const { session, adminTab } = useRestaurant()
      seen.push({ role: session.role, tab: adminTab })
      return null
    }

    render(
      <RestaurantProvider repository={createRepo()}>
        <AdminAuthModal isOpen />
        <Probe />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByPlaceholderText("Tu nombre de usuario"), { target: { value: "napoli" } })
    fireEvent.change(screen.getByPlaceholderText("Ingresá tu clave de administración..."), {
      target: { value: "clave" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Acceder al Panel/i }))

    await waitFor(() => expect(window.location.pathname).toBe("/admin/dashboard"))
    const leaked = seen.filter((s) => s.role === "restaurant" && ["restaurants", "users", "metrics", "audit"].includes(s.tab))
    expect(leaked).toEqual([])
  })
})
