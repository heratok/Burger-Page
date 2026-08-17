import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type {
  Modifier,
  Order,
  OrderStatus,
  Product,
  RestaurantConfig,
} from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"
import OrdersPage from "./OrdersPage"

afterEach(() => {
  cleanup()
})

function makeOrder(id: number, status: OrderStatus, total = 27000): Order {
  return {
    id,
    items: [],
    customer: {
      nombre: "Cliente",
      telefono: "3001234567",
      direccion: "Calle 1 #2-3",
      barrio: "Centro",
    },
    metodo: "Efectivo",
    total,
    status,
    createdAt: new Date().toISOString(),
  }
}

function createOrdersRepo(orders: Order[], updateResult: boolean | "default" = "default") {
  const state = { orders: [...orders] }
  const repo: RestaurantRepository = {
    getConfig: () => ({}) as RestaurantConfig,
    saveConfig: vi.fn(),
    listProducts: () => [] as Product[],
    saveProduct: vi.fn(),
    deleteProduct: vi.fn(),
    listModifiers: () => [] as Modifier[],
    saveModifier: vi.fn(),
    deleteModifier: vi.fn(),
    listOrders: () => state.orders,
    saveOrder: vi.fn(),
    updateOrderStatus: vi.fn((id: number, next: OrderStatus) => {
      if (updateResult !== "default") return updateResult
      const order = state.orders.find((o) => o.id === id)
      if (!order) return false
      order.status = next
      return true
    }),
  }
  return { repo, state }
}

function renderPage(repo: RestaurantRepository) {
  render(<OrdersPage repo={repo} />)
}

describe("OrdersPage", () => {
  it("renders an empty inbox with a helpful message when there are no orders", () => {
    const { repo } = createOrdersRepo([])
    renderPage(repo)
    expect(screen.getByText(/no hay pedidos/i)).toBeTruthy()
  })

  it("lists each order with id, customer, total and status label", () => {
    const { repo } = createOrdersRepo([
      makeOrder(100001, "new", 27000),
      makeOrder(100002, "confirmed", 22900),
    ])
    renderPage(repo)

    expect(screen.getByText("#100001")).toBeTruthy()
    expect(screen.getByText("#100002")).toBeTruthy()
    expect(screen.getByText("$27.000")).toBeTruthy()
    expect(screen.getByText("$22.900")).toBeTruthy()
    expect(screen.getByText("Nuevo")).toBeTruthy()
    expect(screen.getByText("Confirmado")).toBeTruthy()
  })

  it("shows transition buttons only for allowed statuses (per canTransition)", () => {
    const { repo } = createOrdersRepo([
      makeOrder(100001, "new"),
      makeOrder(100002, "confirmed"),
      makeOrder(100003, "delivered"),
      makeOrder(100004, "cancelled"),
    ])
    renderPage(repo)

    const rows = screen.getAllByRole("listitem")
    const rowFor = (id: number) => within(rows[id - 100001])

    // new → Confirmar + Cancelar
    expect(rowFor(100001).getByRole("button", { name: "Confirmar" })).toBeTruthy()
    expect(rowFor(100001).getByRole("button", { name: "Cancelar" })).toBeTruthy()
    // confirmed → Entregar + Cancelar
    expect(rowFor(100002).getByRole("button", { name: "Entregar" })).toBeTruthy()
    expect(rowFor(100002).getByRole("button", { name: "Cancelar" })).toBeTruthy()
    // terminal statuses → no transition buttons
    expect(rowFor(100003).queryByRole("button", { name: /confirmar|entregar|cancelar/i })).toBeNull()
    expect(rowFor(100004).queryByRole("button", { name: /confirmar|entregar|cancelar/i })).toBeNull()
  })

  it("persists an allowed transition and updates the status shown", () => {
    const { repo, state } = createOrdersRepo([makeOrder(100001, "new")])
    renderPage(repo)

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))

    expect(repo.updateOrderStatus).toHaveBeenCalledWith(100001, "confirmed")
    expect(state.orders[0].status).toBe("confirmed")
    expect(screen.getByText("Confirmado")).toBeTruthy()
    expect(screen.queryByText("Nuevo")).toBeNull()
  })

  it("leaves the status unchanged when the repository rejects a transition", () => {
    const { repo, state } = createOrdersRepo([makeOrder(100001, "new")], false)
    renderPage(repo)

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))

    expect(repo.updateOrderStatus).toHaveBeenCalledWith(100001, "confirmed")
    expect(state.orders[0].status).toBe("new")
    expect(screen.getByText("Nuevo")).toBeTruthy()
    expect(screen.queryByText("Confirmado")).toBeNull()
  })
})