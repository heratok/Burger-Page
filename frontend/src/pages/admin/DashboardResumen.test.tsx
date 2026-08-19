import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type {
  Modifier,
  Order,
  Product,
  RestaurantConfig,
} from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"
import DashboardResumen from "./DashboardResumen"

const NOW = new Date("2026-08-16T12:00:00")

function makeOrder(
  partial: Partial<Order> & Pick<Order, "id" | "createdAt">
): Order {
  return {
    items: [],
    customer: { nombre: "Ana", telefono: "3001234567", direccion: "Calle 1", barrio: "Centro" },
    metodo: "Efectivo",
    total: 0,
    status: "new",
    ...partial,
  }
}

function createRepo(orders: Order[]): RestaurantRepository {
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

function selectRange(name: string) {
  fireEvent.click(screen.getByRole("button", { name }))
}

/** Scopes a query to the KPI card whose description is `label` (avoids dup text across cards). */
function kpiCard(label: string) {
  const card = screen.getByText(label).closest('[data-slot="card"]')
  if (!card) throw new Error(`No card found for label ${label}`)
  return within(card as HTMLElement)
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe("DashboardResumen (DR-2 range selector filters KPI)", () => {
  it("filters revenue by the selected range", () => {
    // Today (Aug 16): 30000 confirmed; Aug 14 (day -2): 20000 confirmed.
    const repo = createRepo([
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-14T09:00:00", status: "confirmed", total: 20000 }),
    ])
    render(<DashboardResumen repo={repo} now={NOW} />)

    // Default 7d includes both.
    expect(kpiCard("Ingresos").getByText("$50.000")).toBeTruthy()

    // Today shows only today's revenue.
    selectRange("Hoy")
    expect(kpiCard("Ingresos").getByText("$30.000")).toBeTruthy()
    expect(screen.queryByText("$50.000")).toBeNull()
  })

  it("persists the selected range across mounts (DR-2 SHOULD persist)", () => {
    const repo = createRepo([
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-14T09:00:00", status: "confirmed", total: 20000 }),
    ])
    const { unmount } = render(<DashboardResumen repo={repo} now={NOW} />)
    selectRange("Todo")
    unmount()

    render(<DashboardResumen repo={repo} now={NOW} />)
    // "Todo" range → both orders in scope → $50.000 and the "Todo" button active.
    expect(kpiCard("Ingresos").getByText("$50.000")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Todo" }).getAttribute("aria-pressed")).toBe("true")
  })
})

describe("DashboardResumen empty states (DR-2 Today, DR-3 fresh tenant)", () => {
  it("renders a teaching empty state (not a broken chart) when today has no orders", () => {
    const repo = createRepo([
      makeOrder({ id: 1, createdAt: "2026-08-14T09:00:00", status: "confirmed", total: 20000 }),
    ])
    render(<DashboardResumen repo={repo} now={NOW} />)

    selectRange("Hoy")
    // Teaching guidance text, no crash.
    expect(screen.getByText(/no hay pedidos/i)).toBeTruthy()
    expect(screen.getByText(/se reflejará/i)).toBeTruthy()
  })

  it("shows zero-labeled KPIs plus a teaching empty state for a fresh tenant (no orders at all)", () => {
    const repo = createRepo([])
    render(<DashboardResumen repo={repo} now={NOW} />)

    expect(screen.getByText("Ingresos")).toBeTruthy()
    expect(kpiCard("Ingresos").getByText("$0")).toBeTruthy()
    expect(screen.getByText(/no hay pedidos/i)).toBeTruthy()
  })
})

describe("DashboardResumen status breakdown (AC-3, DR-3)", () => {
  it("shows cancelled as a visible category in the status breakdown", () => {
    const repo = createRepo([
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-16T10:00:00", status: "cancelled", total: 50000 }),
    ])
    render(<DashboardResumen repo={repo} now={NOW} />)

    // Revenue excludes cancelled (AC-1).
    expect(kpiCard("Ingresos").getByText("$30.000")).toBeTruthy()
    // Cancelled visible as a category (AC-3).
    const cancelledRow = screen.getByText("Cancelados").closest("li")
    expect(cancelledRow).toBeTruthy()
    expect(within(cancelledRow as HTMLElement).getByText("1")).toBeTruthy()
    expect(screen.getByText("Confirmados")).toBeTruthy()
  })

  it("shows average ticket and unique customers computed from non-cancelled orders (AC-1)", () => {
    const repo = createRepo([
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000, customer: { nombre: "A", telefono: "3001111111", direccion: "x", barrio: "y" } }),
      makeOrder({ id: 2, createdAt: "2026-08-16T10:00:00", status: "delivered", total: 10000, customer: { nombre: "B", telefono: "3002222222", direccion: "x", barrio: "y" } }),
      makeOrder({ id: 3, createdAt: "2026-08-16T11:00:00", status: "cancelled", total: 99999, customer: { nombre: "C", telefono: "3003333333", direccion: "x", barrio: "y" } }),
    ])
    render(<DashboardResumen repo={repo} now={NOW} />)

    // average ticket = (30000+10000)/2 = 20000; unique customers = 2.
    expect(screen.getByText("Ticket promedio")).toBeTruthy()
    expect(kpiCard("Ticket promedio").getByText("$20.000")).toBeTruthy()
    expect(screen.getByText("Clientes únicos")).toBeTruthy()
    expect(kpiCard("Clientes únicos").getByText("2")).toBeTruthy()
  })
})
