import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type {
  CartItem,
  Modifier,
  Order,
  OrderStatus,
  Product,
  RestaurantConfig,
} from "@/shared/domain/domain"
import type { RestaurantRepository } from "@/shared/storage/repository"
import OrdersPage from "./OrdersPage"

afterEach(() => {
  cleanup()
})

function makeItem(
  id: string,
  name: string,
  cantidad = 1,
  total = 27000,
  observacion = ""
): CartItem {
  return {
    id,
    productId: id,
    name,
    src: "https://example.com/img.jpg",
    unitPrice: total / cantidad,
    cantidad,
    modifiers: [],
    observacion,
    total,
  }
}

function makeOrder(
  id: number,
  status: OrderStatus,
  {
    nombre = "Cliente",
    items = [makeItem("it1", "Misisipi")],
    metodo = "Efectivo",
    pagoCon,
    comentario,
  }: {
    nombre?: string
    items?: CartItem[]
    metodo?: Order["metodo"]
    pagoCon?: string
    comentario?: string
  } = {}
): Order {
  return {
    id,
    items,
    customer: {
      nombre,
      telefono: "3001234567",
      direccion: "Calle 1 #2-3",
      barrio: "Centro",
    },
    metodo,
    pagoCon,
    comentario,
    total: items.reduce((sum, it) => sum + it.total, 0),
    status,
    createdAt: new Date().toISOString(),
  }
}

function createOrdersRepo(orders: Order[], updateResult: boolean | "default" = "default") {
  const state = { orders: [...orders] }
  const repo: RestaurantRepository = {
    getConfig: () => ({}) as RestaurantConfig,
    saveConfig: vi.fn(),
    getPalette: () => ({ accent: "#FF7A21", primary: "#FF7A21", background: "#0F1112", surface: "#181A1B" }),
    savePalette: vi.fn(),
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

/** Asserts the row for an order id is present (or absent) in the table. */
function orderRow(id: number): HTMLElement {
  return screen.getByRole("row", { name: new RegExp(`#${id}`) })
}

describe("OrdersPage", () => {
  it("renders an empty inbox with a helpful message when there are no orders", () => {
    const { repo } = createOrdersRepo([])
    renderPage(repo)
    expect(screen.getByText(/no hay pedidos/i)).toBeTruthy()
  })

  it("lists each order as a table row with id, customer, total and status label", () => {
    const { repo } = createOrdersRepo([
      makeOrder(100001, "new", { nombre: "Ana" }),
      makeOrder(100002, "confirmed", { nombre: "Bruno" }),
    ])
    renderPage(repo)

    expect(orderRow(100001)).toBeTruthy()
    expect(orderRow(100002)).toBeTruthy()
    expect(screen.getByText("Ana")).toBeTruthy()
    expect(screen.getByText("Bruno")).toBeTruthy()
    expect(within(orderRow(100001)).getByText("Nuevo")).toBeTruthy()
    expect(within(orderRow(100002)).getByText("Confirmado")).toBeTruthy()
  })

  describe("status tabs filter", () => {
    it("shows only new orders when the Nuevo tab is selected", () => {
      const { repo } = createOrdersRepo([
        makeOrder(100001, "new", { nombre: "Ana" }),
        makeOrder(100002, "confirmed", { nombre: "Bruno" }),
        makeOrder(100003, "delivered", { nombre: "Carla" }),
      ])
      renderPage(repo)

      fireEvent.click(screen.getByRole("tab", { name: /nuevo/i }))

      expect(orderRow(100001)).toBeTruthy()
      expect(screen.queryByRole("row", { name: /#100002/ })).toBeNull()
      expect(screen.queryByRole("row", { name: /#100003/ })).toBeNull()
    })

    it("shows only confirmed orders when the Confirmado tab is selected", () => {
      const { repo } = createOrdersRepo([
        makeOrder(100001, "new", { nombre: "Ana" }),
        makeOrder(100002, "confirmed", { nombre: "Bruno" }),
        makeOrder(100003, "delivered", { nombre: "Carla" }),
      ])
      renderPage(repo)

      fireEvent.click(screen.getByRole("tab", { name: /confirmado/i }))

      expect(orderRow(100002)).toBeTruthy()
      expect(screen.queryByRole("row", { name: /#100001/ })).toBeNull()
      expect(screen.queryByRole("row", { name: /#100003/ })).toBeNull()
    })

    it("shows every order again when the Todos tab is selected", () => {
      const { repo } = createOrdersRepo([
        makeOrder(100001, "new", { nombre: "Ana" }),
        makeOrder(100002, "confirmed", { nombre: "Bruno" }),
      ])
      renderPage(repo)

      fireEvent.click(screen.getByRole("tab", { name: /nuevo/i }))
      fireEvent.click(screen.getByRole("tab", { name: /todos/i }))

      expect(orderRow(100001)).toBeTruthy()
      expect(orderRow(100002)).toBeTruthy()
    })
  })

  describe("search", () => {
    it("filters orders by customer name", () => {
      const { repo } = createOrdersRepo([
        makeOrder(100001, "new", { nombre: "Ana" }),
        makeOrder(100002, "new", { nombre: "Bruno" }),
      ])
      renderPage(repo)

      fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
        target: { value: "Ana" },
      })

      expect(orderRow(100001)).toBeTruthy()
      expect(screen.queryByRole("row", { name: /#100002/ })).toBeNull()
    })

    it("filters orders by product name in their items", () => {
      const { repo } = createOrdersRepo([
        makeOrder(100001, "new", { items: [makeItem("it1", "Misisipi")] }),
        makeOrder(100002, "new", { items: [makeItem("it2", "La Pollo")] }),
      ])
      renderPage(repo)

      fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
        target: { value: "Misisipi" },
      })

      expect(orderRow(100001)).toBeTruthy()
      expect(screen.queryByRole("row", { name: /#100002/ })).toBeNull()
    })

    it("shows no rows when the search matches nothing", () => {
      const { repo } = createOrdersRepo([makeOrder(100001, "new", { nombre: "Ana" })])
      renderPage(repo)

      fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
        target: { value: "Zzz" },
      })

      expect(screen.queryByRole("row", { name: /#100001/ })).toBeNull()
    })
  })

  describe("order detail dialog", () => {
    it("shows items, customer, payment and notes for a clicked order", () => {
      const { repo } = createOrdersRepo([
        makeOrder(100001, "new", {
          nombre: "Ana",
          items: [makeItem("it1", "Misisipi", 2, 54000, "Sin cebolla")],
          metodo: "Transferencia",
          pagoCon: "3009998888",
          comentario: "Entregar después de las 6pm",
        }),
      ])
      renderPage(repo)

      fireEvent.click(
        within(orderRow(100001)).getByRole("button", { name: /ver detalle/i })
      )

      const dialog = screen.getByRole("dialog")
      // items (line renders as "2 × Misisipi (Sin cebolla)")
      expect(within(dialog).getByText(/2 × Misisipi/)).toBeTruthy()
      // customer (line renders as "3001234567 · Calle 1 #2-3, Centro")
      expect(within(dialog).getByText("Ana")).toBeTruthy()
      expect(within(dialog).getByText(/3001234567/)).toBeTruthy()
      // payment (line renders as "Transferencia · 3009998888")
      expect(within(dialog).getByText(/Transferencia/)).toBeTruthy()
      expect(within(dialog).getByText(/3009998888/)).toBeTruthy()
      // notes: item observacion shows inline AND in the Notes section
      expect(within(dialog).getAllByText(/Sin cebolla/).length).toBeGreaterThan(0)
      expect(within(dialog).getByText(/Entregar después de las 6pm/)).toBeTruthy()
    })
  })

  describe("transitions", () => {
    it("shows transition buttons only for allowed statuses", () => {
      const { repo } = createOrdersRepo([
        makeOrder(100001, "new"),
        makeOrder(100002, "confirmed"),
        makeOrder(100003, "delivered"),
        makeOrder(100004, "cancelled"),
      ])
      renderPage(repo)

      const rowFor = (id: number) => within(orderRow(id))

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
      expect(within(orderRow(100001)).getByText("Confirmado")).toBeTruthy()
      expect(within(orderRow(100001)).queryByText("Nuevo")).toBeNull()
    })

    it("leaves the status unchanged when the repository rejects a transition", () => {
      const { repo, state } = createOrdersRepo([makeOrder(100001, "new")], false)
      renderPage(repo)

      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))

      expect(repo.updateOrderStatus).toHaveBeenCalledWith(100001, "confirmed")
      expect(state.orders[0].status).toBe("new")
      expect(within(orderRow(100001)).getByText("Nuevo")).toBeTruthy()
      expect(within(orderRow(100001)).queryByText("Confirmado")).toBeNull()
    })
  })
})
