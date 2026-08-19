import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import type { MetodoPago, Order, OrderStatus } from "../domain"
import {
  computeResumen,
  KpiCard,
  PaymentSplitCard,
  ResumenEmptyState,
  RevenueByDayCard,
  StatusBreakdownCard,
} from "./index"

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

afterEach(() => {
  cleanup()
})

describe("computeResumen (AC-1: cancelled excluded; day-bucket revenue)", () => {
  it("excludes cancelled from revenue, count, ticket and customers but keeps it in the status breakdown", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({
        id: 2, createdAt: "2026-08-16T10:00:00", status: "delivered", total: 10000,
        customer: { nombre: "B", telefono: "3002222222", direccion: "x", barrio: "y" },
      }),
      makeOrder({
        id: 3, createdAt: "2026-08-16T11:00:00", status: "cancelled", total: 99999,
        customer: { nombre: "C", telefono: "3003333333", direccion: "x", barrio: "y" },
      }),
    ]

    const m = computeResumen(orders, "today", NOW)

    expect(m.revenue).toBe(40000)
    expect(m.orderCount).toBe(2)
    expect(m.ticket).toBe(20000)
    expect(m.customers).toBe(2)
    expect(m.status).toEqual({ new: 0, confirmed: 1, delivered: 1, cancelled: 1 })
    expect(m.hasData).toBe(true)
  })

  it("buckets revenue by calendar day and zeroes days whose only order is cancelled (AC-1 day buckets)", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-14T09:00:00", status: "confirmed", total: 20000 }),
      makeOrder({ id: 3, createdAt: "2026-08-15T09:00:00", status: "cancelled", total: 50000 }),
    ]

    const m = computeResumen(orders, "7d", NOW)

    expect(m.buckets).toHaveLength(7)
    const byDay = new Map(m.buckets.map((b) => [b.day, b.revenue]))
    expect(byDay.get("2026-08-16")).toBe(30000)
    expect(byDay.get("2026-08-14")).toBe(20000)
    expect(byDay.get("2026-08-15")).toBe(0)
  })

  it("reports zero metrics and hasData=false when there are no orders (triangulation: empty path)", () => {
    const m = computeResumen([], "7d", NOW)

    expect(m.hasData).toBe(false)
    expect(m.revenue).toBe(0)
    expect(m.orderCount).toBe(0)
    expect(m.ticket).toBe(0)
    expect(m.customers).toBe(0)
    expect(m.status).toEqual({ new: 0, confirmed: 0, delivered: 0, cancelled: 0 })
    expect(m.buckets).toHaveLength(7)
  })

  it("respects the range window: today ignores older countable orders (triangulation: different range)", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-14T09:00:00", status: "confirmed", total: 20000 }),
    ]

    const m = computeResumen(orders, "today", NOW)

    expect(m.revenue).toBe(30000)
    expect(m.orderCount).toBe(1)
    expect(m.payments).toEqual({ Efectivo: 1, Transferencia: 0 })
  })
})

describe("resumen presenters", () => {
  it("KpiCard renders the label and the value", () => {
    render(<KpiCard label="Ingresos" value="$50.000" />)

    const card = screen.getByText("Ingresos").closest('[data-slot="card"]')
    expect(card).toBeTruthy()
    expect(within(card as HTMLElement).getByText("$50.000")).toBeTruthy()
  })

  it("RevenueByDayCard renders the title, the description and the chart container", () => {
    const buckets = [{ day: "2026-08-16", revenue: 30000 }]
    const { container, rerender } = render(
      <RevenueByDayCard buckets={buckets} description="Pedidos confirmados y entregados en el rango." />
    )

    expect(screen.getByText("Ingresos por día")).toBeTruthy()
    expect(screen.getByText("Pedidos confirmados y entregados en el rango.")).toBeTruthy()
    // Chart root renders (recharts renders no SVG in jsdom — see test/setup.ts).
    expect(container.querySelector('[data-slot="chart"]')).toBeTruthy()

    // Triangulation: description is a prop, not hardcoded.
    rerender(<RevenueByDayCard buckets={buckets} description="Otra descripción" />)
    expect(screen.getByText("Otra descripción")).toBeTruthy()
  })

  it("StatusBreakdownCard lists every status with its plural label and count, cancelled included", () => {
    const status: Record<OrderStatus, number> = { new: 2, confirmed: 1, delivered: 0, cancelled: 1 }
    render(<StatusBreakdownCard status={status} />)

    expect(screen.getByText("Estado de pedidos")).toBeTruthy()
    expect(screen.getByText("Desglose por estado, incluidos los cancelados.")).toBeTruthy()
    const nuevosRow = screen.getByText("Nuevos").closest("li")
    expect(nuevosRow).toBeTruthy()
    expect(within(nuevosRow as HTMLElement).getByText("2")).toBeTruthy()
    const canceladosRow = screen.getByText("Cancelados").closest("li")
    expect(canceladosRow).toBeTruthy()
    expect(within(canceladosRow as HTMLElement).getByText("1")).toBeTruthy()
    expect(screen.getByText("Confirmados")).toBeTruthy()
  })

  it("PaymentSplitCard lists each payment method with its label and count", () => {
    const payments: Record<MetodoPago, number> = { Efectivo: 3, Transferencia: 1 }
    render(<PaymentSplitCard payments={payments} />)

    expect(screen.getByText("Método de pago")).toBeTruthy()
    expect(screen.getByText("Cantidad de pedidos por método de pago.")).toBeTruthy()
    const efectivoRow = screen.getByText("Efectivo").closest("li")
    expect(efectivoRow).toBeTruthy()
    expect(within(efectivoRow as HTMLElement).getByText("3")).toBeTruthy()
    const transferenciaRow = screen.getByText("Transferencia").closest("li")
    expect(transferenciaRow).toBeTruthy()
    expect(within(transferenciaRow as HTMLElement).getByText("1")).toBeTruthy()
  })

  it("ResumenEmptyState renders its title and description", () => {
    render(
      <ResumenEmptyState
        title="No hay pedidos en este rango"
        description="Cuando llegue un pedido se reflejará aquí."
      />
    )

    expect(screen.getByText("No hay pedidos en este rango")).toBeTruthy()
    expect(screen.getByText("Cuando llegue un pedido se reflejará aquí.")).toBeTruthy()
  })
})
