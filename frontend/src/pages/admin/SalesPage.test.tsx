import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type {
  Modifier,
  Order,
  OrderStatus,
  Product,
  RestaurantConfig,
} from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"
import SalesPage from "./SalesPage"

afterEach(() => {
  cleanup()
})

function makeOrder(id: number, status: OrderStatus, total: number, createdAt: string): Order {
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
    createdAt,
  }
}

function createSalesRepo(orders: Order[]): RestaurantRepository {
  return {
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
    listOrders: () => orders,
    saveOrder: vi.fn(),
    updateOrderStatus: vi.fn(),
  }
}

describe("SalesPage", () => {
  it("shows zero counts and revenue when there are no orders", () => {
    const repo = createSalesRepo([])
    render(<SalesPage repo={repo} />)

    expect(screen.getAllByText("0")).toHaveLength(2)
    expect(screen.getAllByText("$0")).toHaveLength(2)
  })

  it("computes today and all-time metrics, excluding cancelled orders", () => {
    const now = new Date()
    const today = now.toISOString()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const repo = createSalesRepo([
      makeOrder(1, "confirmed", 27000, today),
      makeOrder(2, "delivered", 22900, today),
      makeOrder(3, "cancelled", 99999, today), // excluded
      makeOrder(4, "confirmed", 5000, yesterday), // all-time only
    ])
    render(<SalesPage repo={repo} />)

    // Today: 2 orders, $49.900
    expect(screen.getByText("2")).toBeTruthy()
    expect(screen.getByText("$49.900")).toBeTruthy()
    // All-time: 3 orders, $54.900
    expect(screen.getByText("3")).toBeTruthy()
    expect(screen.getByText("$54.900")).toBeTruthy()
  })
})