import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import type {
  Modifier,
  Order,
  Product,
  Restaurant,
  RestaurantConfig,
} from "@/lib/domain"
import type { DirectoryRepository, RestaurantRepository } from "@/lib/repository"
import GlobalSummary from "./GlobalSummary"

const NOW = new Date("2026-08-16T12:00:00")

function makeOrder(
  partial: Partial<Order> & Pick<Order, "id" | "createdAt" | "total">
): Order {
  return {
    items: [],
    customer: { nombre: "Ana", telefono: "3001234567", direccion: "Calle 1", barrio: "Centro" },
    metodo: "Efectivo",
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

function makeRestaurant(id: string, name: string, orders: Order[]): Restaurant {
  return {
    id,
    slug: id.replace("rest-", ""),
    config: { name, whatsapp: "573001234567", logo: "/logo.png", accent: "#E63946", adminPassword: "x" },
    palette: { accent: "#E63946", primary: "#E63946", background: "#0F1112", surface: "#181A1B" },
    products: [],
    modifiers: [],
    orders,
  }
}

/** Fake directory over fixed restaurants; getRepositoryFor scopes by id (design D2 seam). */
function createDirectory(restaurants: Restaurant[]): DirectoryRepository {
  const repos = new Map(restaurants.map((r) => [r.id, createRepo(r.orders)]))
  return {
    listRestaurants: () => restaurants,
    getBySlug: () => undefined,
    createRestaurant: vi.fn(),
    deleteRestaurant: vi.fn(),
    updateRestaurant: vi.fn(),
    getSuperAdminPassword: () => "superadmin",
    setSuperAdminPassword: vi.fn(),
    getRepositoryFor: (id: string) => repos.get(id) as RestaurantRepository,
  }
}

/** Scopes a query to the KPI card whose description is `label` (avoids dup text across cards). */
function kpiCard(label: string) {
  const card = screen.getByText(label).closest('[data-slot="card"]')
  if (!card) throw new Error(`No card found for label ${label}`)
  return within(card as HTMLElement)
}

/** Scopes a query to the per-restaurant comparison row of `name`. */
function restaurantRow(name: string) {
  const row = screen.getByText(name).closest("li")
  if (!row) throw new Error(`No comparison row found for ${name}`)
  return within(row as HTMLElement)
}

afterEach(() => {
  cleanup()
})

describe("GlobalSummary aggregation (SG-2)", () => {
  it("sums global revenue across restaurants with cancelled excluded per restaurant (A 10 orders + B 5 orders)", () => {
    // Restaurant A: 9 confirmed x $10.000 + 1 cancelled x $50.000 (10 orders).
    const romaOrders: Order[] = Array.from({ length: 9 }, (_, i) =>
      makeOrder({ id: i + 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 10000 })
    )
    romaOrders.push(
      makeOrder({ id: 10, createdAt: "2026-08-16T09:30:00", status: "cancelled", total: 50000 })
    )
    // Restaurant B: 4 confirmed x $20.000 + 1 cancelled x $10.000 (5 orders).
    const tokioOrders: Order[] = Array.from({ length: 4 }, (_, i) =>
      makeOrder({ id: i + 1, createdAt: "2026-08-15T09:00:00", status: "confirmed", total: 20000 })
    )
    tokioOrders.push(
      makeOrder({ id: 5, createdAt: "2026-08-15T09:30:00", status: "cancelled", total: 10000 })
    )

    const directory = createDirectory([
      makeRestaurant("rest-pizza-roma", "PIZZA ROMA", romaOrders),
      makeRestaurant("rest-sushi-tokio", "SUSHI TOKIO", tokioOrders),
    ])
    render(<GlobalSummary directory={directory} now={NOW} />)

    // Global revenue = 9*10000 + 4*20000 = 170.000; the cancelled orders
    // contribute nothing from either restaurant (AC-1).
    expect(kpiCard("Ingresos").getByText("$170.000")).toBeTruthy()
  })

  it("counts only confirmed/delivered orders in the global Pedidos KPI (AC-1)", () => {
    const romaOrders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 10000 }),
      makeOrder({ id: 2, createdAt: "2026-08-16T09:30:00", status: "cancelled", total: 50000 }),
    ]
    const tokioOrders = [
      makeOrder({ id: 1, createdAt: "2026-08-15T09:00:00", status: "delivered", total: 20000 }),
      makeOrder({ id: 2, createdAt: "2026-08-15T09:30:00", status: "cancelled", total: 30000 }),
    ]
    const directory = createDirectory([
      makeRestaurant("rest-pizza-roma", "PIZZA ROMA", romaOrders),
      makeRestaurant("rest-sushi-tokio", "SUSHI TOKIO", tokioOrders),
    ])
    render(<GlobalSummary directory={directory} now={NOW} />)

    // 1 confirmed + 1 delivered = 2 countable orders; 2 cancelled excluded.
    expect(kpiCard("Pedidos").getByText("2")).toBeTruthy()
  })

  it("shows the per-restaurant comparison with each restaurant's own revenue (SG-2 breakdown)", () => {
    const romaOrders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 90000 }),
      makeOrder({ id: 2, createdAt: "2026-08-16T09:30:00", status: "cancelled", total: 50000 }),
    ]
    const tokioOrders = [
      makeOrder({ id: 1, createdAt: "2026-08-15T09:00:00", status: "confirmed", total: 80000 }),
    ]
    const directory = createDirectory([
      makeRestaurant("rest-pizza-roma", "PIZZA ROMA", romaOrders),
      makeRestaurant("rest-sushi-tokio", "SUSHI TOKIO", tokioOrders),
    ])
    render(<GlobalSummary directory={directory} now={NOW} />)

    // Each row carries that restaurant's revenue with its own cancelled excluded,
    // while the global Ingresos KPI still shows the aggregate ($90.000 + $80.000).
    expect(restaurantRow("PIZZA ROMA").getByText("$90.000")).toBeTruthy()
    expect(restaurantRow("SUSHI TOKIO").getByText("$80.000")).toBeTruthy()
    expect(kpiCard("Ingresos").getByText("$170.000")).toBeTruthy()
  })

  it("computes average ticket and unique customers over the global countable orders (AC-1)", () => {
    const romaOrders = [
      makeOrder({
        id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000,
        customer: { nombre: "A", telefono: "3001111111", direccion: "x", barrio: "y" },
      }),
      makeOrder({
        id: 2, createdAt: "2026-08-16T09:30:00", status: "confirmed", total: 10000,
        customer: { nombre: "B", telefono: "3002222222", direccion: "x", barrio: "y" },
      }),
      makeOrder({
        id: 3, createdAt: "2026-08-16T10:00:00", status: "cancelled", total: 99999,
        customer: { nombre: "C", telefono: "3003333333", direccion: "x", barrio: "y" },
      }),
    ]
    const tokioOrders = [
      makeOrder({
        id: 1, createdAt: "2026-08-15T09:00:00", status: "delivered", total: 20000,
        customer: { nombre: "A", telefono: "3001111111", direccion: "x", barrio: "y" },
      }),
    ]
    const directory = createDirectory([
      makeRestaurant("rest-pizza-roma", "PIZZA ROMA", romaOrders),
      makeRestaurant("rest-sushi-tokio", "SUSHI TOKIO", tokioOrders),
    ])
    render(<GlobalSummary directory={directory} now={NOW} />)

    // revenue = 30000+10000+20000 = 60000 over 3 countable orders → ticket $20.000;
    // distinct customer phones among countable = 2 (A counted once across both restaurants).
    expect(kpiCard("Ticket promedio").getByText("$20.000")).toBeTruthy()
    expect(kpiCard("Clientes únicos").getByText("2")).toBeTruthy()
  })

  it("keeps cancelled orders visible in the global status breakdown (AC-1)", () => {
    const romaOrders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-16T09:30:00", status: "cancelled", total: 50000 }),
    ]
    const tokioOrders = [
      makeOrder({ id: 1, createdAt: "2026-08-15T09:00:00", status: "cancelled", total: 10000 }),
    ]
    const directory = createDirectory([
      makeRestaurant("rest-pizza-roma", "PIZZA ROMA", romaOrders),
      makeRestaurant("rest-sushi-tokio", "SUSHI TOKIO", tokioOrders),
    ])
    render(<GlobalSummary directory={directory} now={NOW} />)

    const cancelledRow = screen.getByText("Cancelados").closest("li")
    expect(cancelledRow).toBeTruthy()
    expect(within(cancelledRow as HTMLElement).getByText("2")).toBeTruthy()
  })
})

describe("GlobalSummary empty state (SG-2 Global empty)", () => {
  it("renders a teaching empty state when no restaurant has orders", () => {
    const directory = createDirectory([
      makeRestaurant("rest-burger-page", "BURGER PAGE", []),
      makeRestaurant("rest-pizza-roma", "PIZZA ROMA", []),
      makeRestaurant("rest-sushi-tokio", "SUSHI TOKIO", []),
    ])
    render(<GlobalSummary directory={directory} now={NOW} />)

    // Zero-labeled KPIs still render (DR-3 fresh-tenant pattern).
    expect(kpiCard("Ingresos").getByText("$0")).toBeTruthy()
    // Teaching empty state replaces the charts, no broken graph.
    expect(screen.getByText(/no hay pedidos/i)).toBeTruthy()
    expect(screen.getByText(/se reflejará/i)).toBeTruthy()
    expect(screen.queryByText("Ingresos por día")).toBeNull()
  })
})
