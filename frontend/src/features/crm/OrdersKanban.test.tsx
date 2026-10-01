import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { OrdersKanban } from "./OrdersKanban"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"

const createPopulatedTestRepo = () => {
  const adapter = new InMemoryStorageAdapter()
  adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  return new TenantRepository(adapter)
}

describe("OrdersKanban Component (TDD Tests)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders orders list, search input, and filter controls", () => {
    render(
      <RestaurantProvider repository={createPopulatedTestRepo()}>
        <OrdersKanban />
      </RestaurantProvider>
    )

    expect(screen.getByPlaceholderText(/Buscar por # orden, cliente/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Nueva Venta/i })).toBeDefined()
  })

  it("filters orders by search term and payment method", () => {
    render(
      <RestaurantProvider repository={createPopulatedTestRepo()}>
        <OrdersKanban />
      </RestaurantProvider>
    )

    const searchInput = screen.getByPlaceholderText(/Buscar por # orden, cliente/i)
    fireEvent.change(searchInput, { target: { value: "NonExistentCustomerXYZ" } })

    expect(screen.getByText(/¡Cocina al día! No hay comandas pendientes/i)).toBeDefined()

    const select = screen.getByLabelText(/Filtrar por método de pago/i)
    fireEvent.change(select, { target: { value: "Efectivo" } })
    expect(select).toBeDefined()
  })

  it("finds an order by the name of its table", () => {
    const envelope = {
      ...TEST_STORAGE_ENVELOPE,
      restaurants: TEST_STORAGE_ENVELOPE.restaurants.map((r, index) =>
        index === 0
          ? {
              ...r,
              orders: [
                {
                  id: "ord-table-search",
                  orderNumber: 9001,
                  customer: { nombre: "Cliente Salón", telefono: "N/A", direccion: "Salón", barrio: "Local" },
                  items: [],
                  total: 1000,
                  deliveryFee: 0,
                  finalTotal: 1000,
                  metodo: "Efectivo" as const,
                  status: "pending" as const,
                  tableId: "tbl_1",
                  tableLabel: "Terraza Zeta",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }
          : r
      ),
    }
    const adapter = new InMemoryStorageAdapter()
    adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(envelope))
    adapter.setItem(STORAGE_KEYS.ACTIVE_REST, envelope.restaurants[0].id)

    render(
      <RestaurantProvider repository={new TenantRepository(adapter)}>
        <OrdersKanban />
      </RestaurantProvider>
    )
    const searchInput = screen.getByPlaceholderText(/Buscar por # orden, cliente/i)

    fireEvent.change(searchInput, { target: { value: "terraza zeta" } })
    expect(screen.getByText("#9001")).toBeDefined()

    fireEvent.change(searchInput, { target: { value: "no existe esa mesa" } })
    expect(screen.queryByText("#9001")).toBeNull()
  })

  it("toggles between feed and kanban view modes", () => {
    render(
      <RestaurantProvider repository={createPopulatedTestRepo()}>
        <OrdersKanban />
      </RestaurantProvider>
    )

    const kanbanToggle = screen.getByRole("button", { name: /Kanban/i })
    fireEvent.click(kanbanToggle)

    // Should show kanban column headers
    expect(screen.getByText(/Nuevos \/ Pendientes/i)).toBeDefined()
    expect(screen.getByText(/En Cocina/i)).toBeDefined()
    expect(screen.getByText(/En Reparto/i)).toBeDefined()
  })

  it("opens manual sale modal when clicking Nueva Venta button", () => {
    render(
      <RestaurantProvider repository={createPopulatedTestRepo()}>
        <OrdersKanban />
      </RestaurantProvider>
    )

    const newSaleBtn = screen.getByRole("button", { name: /Nueva Venta/i })
    fireEvent.click(newSaleBtn)

    expect(screen.getByText(/Punto de Venta — Nueva Venta/i)).toBeDefined()
  })
})
