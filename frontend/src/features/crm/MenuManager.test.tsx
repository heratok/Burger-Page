import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, act } from "@testing-library/react"
import type { QueryClient } from "@tanstack/react-query"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { createTestQueryClient } from "@/test/testQueryClient"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { MenuManager } from "./MenuManager"
import { apiClient } from "@/core/api/apiClient"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const SERVER_PRODUCT = {
  id: "srv-prod-1",
  name: "Burger Doble Queso",
  price: 25000,
  category: "Clásicas",
  src: "",
  description: "Doble carne",
  inStock: true,
}

const SERVER_ADDITION = { id: "srv-add-1", name: "Extra Queso", price: 3000, available: true }

/** A promise settled by hand, so in-flight states stay observable. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const renderMenu = (client: QueryClient) =>
  render(
    <RestaurantProvider queryClient={client}>
      <MenuManager />
    </RestaurantProvider>
  )

describe("MenuManager catalogue loading", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue([SERVER_PRODUCT] as any)
    vi.spyOn(apiClient, "fetchAdditions").mockResolvedValue([SERVER_ADDITION] as any)
  })

  afterEach(() => {
    cleanup()
  })

  it("shows the menu skeleton, never zero counts, while the tenant is still resolving", async () => {
    // No persisted tenant: the only read in flight is the tenant resolution.
    const directory = deferred<any[]>()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockImplementation(() => directory.promise)
    const client = createTestQueryClient()

    renderMenu(client)

    // The catalogue is unknown during the whole tenant-resolution window.
    expect(await screen.findByTestId("menu-grid-skeleton")).toBeDefined()
    expect(screen.queryByText("Platos & Productos (0)")).toBeNull()
    expect(screen.queryByText("Adicionales & Extras (0)")).toBeNull()
    expect(screen.queryByText("Todos (0)")).toBeNull()

    // The directory settles without any tenant: the catalogue is empty, not pending.
    await act(async () => {
      directory.resolve([])
    })
    await waitFor(() => expect(screen.queryByTestId("menu-grid-skeleton")).toBeNull())
    expect(screen.getByText("Platos & Productos (0)")).toBeDefined()
  })

  it("counts the loaded catalogue and never re-triggers the loading UI on a background refetch", async () => {
    seedBlankActiveTenant()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([
      { id: "rest-burger-craft", slug: "burger-craft", name: "Burger Craft", isActive: true },
    ] as any)
    const client = createTestQueryClient()

    renderMenu(client)

    expect(await screen.findByText("Burger Doble Queso")).toBeDefined()
    await waitFor(() => expect(screen.getByText("Platos & Productos (1)")).toBeDefined())
    expect(screen.queryByTestId("menu-grid-skeleton")).toBeNull()

    // A refetch in flight while data is already on screen keeps the menu usable.
    const refetch = deferred<any[]>()
    vi.mocked(apiClient.fetchProducts).mockImplementation(() => refetch.promise)
    await act(async () => {
      void client.invalidateQueries()
    })

    expect(screen.queryByTestId("menu-grid-skeleton")).toBeNull()
    expect(screen.getByText("Platos & Productos (1)")).toBeDefined()

    await act(async () => {
      refetch.resolve([SERVER_PRODUCT] as any)
    })
    expect(screen.getByText("Burger Doble Queso")).toBeDefined()
    expect(screen.queryByTestId("menu-grid-skeleton")).toBeNull()
  })

  it("keeps a genuinely empty catalogue distinct from the loading state", async () => {
    seedBlankActiveTenant()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([
      { id: "rest-burger-craft", slug: "burger-craft", name: "Burger Craft", isActive: true },
    ] as any)
    vi.mocked(apiClient.fetchProducts).mockResolvedValue([])
    vi.mocked(apiClient.fetchAdditions).mockResolvedValue([])
    const client = createTestQueryClient()

    renderMenu(client)

    await waitFor(() => expect(screen.getByText("Platos & Productos (0)")).toBeDefined())
    expect(screen.queryByTestId("menu-grid-skeleton")).toBeNull()
  })
})
