import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import LandingPage from "./LandingPage"

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("LandingPage - private platform directory", () => {
  const calls: string[] = []

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls.length = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input))
        return jsonResponse(401, { title: "Unauthorized", status: 401 })
      })
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const renderLanding = () =>
    render(
      <RestaurantProvider>
        <LandingPage />
      </RestaurantProvider>
    )

  it("does not render the public restaurant showcase or its demo links", async () => {
    renderLanding()
    expect(screen.queryByText("Tiendas en Vivo")).toBeNull()
    expect(screen.queryByText(/restaurantes de prueba/i)).toBeNull()
    expect(screen.queryByText("Crear Primer Restaurante")).toBeNull()
    expect(screen.queryByText("Ver Demos")).toBeNull()
    expect(screen.queryByText("Restaurantes Demo")).toBeNull()
    expect(document.getElementById("demo-stores")).toBeNull()
  })

  it("keeps the rest of the landing page (hero, admin access, final CTA)", () => {
    renderLanding()
    expect(screen.getByText("Acceso Administrador")).toBeTruthy()
    expect(screen.getByText("Ingresar al Panel de Gestión")).toBeTruthy()
  })

  it("never requests the restaurant list for an anonymous visitor", async () => {
    renderLanding()
    await new Promise((r) => setTimeout(r, 100))
    expect(calls.filter((u) => /\/restaurants\/?$/.test(u))).toHaveLength(0)
  })

  it("toggles between light and dark theme and persists choice", () => {
    renderLanding()
    const toggleBtn = screen.getByLabelText("Cambiar a tema oscuro")
    expect(toggleBtn).toBeTruthy()
    fireEvent.click(toggleBtn)
    expect(localStorage.getItem("foodos_landing_theme")).toBe("dark")
    expect(screen.getByLabelText("Cambiar a tema claro")).toBeTruthy()
  })

  it("switches interactive showcase tabs and keeps consistent $44.000 totals in Delivery", () => {
    renderLanding()

    const deliveryTab = screen.getByRole("tab", { name: /Pedido Delivery/i })
    const qrTab = screen.getByRole("tab", { name: /Mesa & Código QR/i })
    const kanbanTab = screen.getByRole("tab", { name: /Cocina & Kanban/i })

    expect(deliveryTab.getAttribute("aria-selected")).toBe("true")
    expect(screen.getByText(/Tocineta Extra \(\+\$3\.500\)/)).toBeTruthy()
    expect(screen.getByText("$44.000")).toBeTruthy()
    expect(screen.getByText(/Total a Pagar: \$44\.000/)).toBeTruthy()

    fireEvent.click(qrTab)
    expect(qrTab.getAttribute("aria-selected")).toBe("true")
    expect(deliveryTab.getAttribute("aria-selected")).toBe("false")
    expect(screen.getByText("Mesa 4 · Terraza")).toBeTruthy()
    expect(screen.getByText(/Pedido en Salón — Mesa 4 · Terraza/)).toBeTruthy()
    expect(screen.getByText("$62.000")).toBeTruthy()

    fireEvent.click(kanbanTab)
    expect(kanbanTab.getAttribute("aria-selected")).toBe("true")
    expect(screen.getByText("#104 · Mesa 4")).toBeTruthy()
    expect(screen.getByText("#103 · Delivery WhatsApp")).toBeTruthy()
  })

  it("keeps the header sticky: no ancestor creates a sticky-breaking overflow", () => {
    const { container } = renderLanding()

    const header = container.querySelector("header")
    expect(header).not.toBeNull()
    expect(header!.className).toContain("sticky")
    expect(header!.className).toContain("top-0")

    // `overflow-x: hidden` on any ancestor turns it into a scroll container and
    // unpins the sticky header; `overflow-x: clip` does not.
    let node: HTMLElement | null = header!.parentElement
    while (node && node !== container) {
      expect(node.className).not.toMatch(/overflow-x-(hidden|auto|scroll)/)
      node = node.parentElement
    }

    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain("overflow-x-clip")
  })

  it("renders the profitability comparison block", () => {
    renderLanding()
    expect(screen.getByText("Apps de Delivery Tradicionales")).toBeTruthy()
    expect(screen.getByText("Tu Canal Directo con FoodOS")).toBeTruthy()
    expect(screen.getByText("0% comisiones por venta")).toBeTruthy()
  })

  it("updates delivery total and simulates WhatsApp dispatch interactively", () => {
    renderLanding()

    const cheddarBtn = screen.getByRole("button", { name: /Queso Cheddar/i })
    fireEvent.click(cheddarBtn)

    expect(screen.getByText("$48.000")).toBeTruthy()
    expect(screen.getByText(/Total a Pagar: \$48\.000/)).toBeTruthy()

    const sendBtn = screen.getByRole("button", { name: /Simular Envío por WhatsApp/i })
    fireEvent.click(sendBtn)
    expect(screen.getByText(/Ticket enviado al instante · 0% comisión/)).toBeTruthy()
  })

  it("switches QR tables and adds drinks to the live round", () => {
    renderLanding()

    fireEvent.click(screen.getByRole("tab", { name: /Mesa & Código QR/i }))
    fireEvent.click(screen.getByRole("button", { name: /Mesa 7 · Patio/i }))

    expect(screen.getByText("$48.500")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /\+ Agregar Bebida/i }))
    expect(screen.getByText("$57.500")).toBeTruthy()
  })

  it("advances Kanban tickets across columns and resets the board", () => {
    renderLanding()

    fireEvent.click(screen.getByRole("tab", { name: /Cocina & Kanban/i }))
    const advanceButtons = screen.getAllByRole("button", { name: /A Cocina →/i })
    fireEvent.click(advanceButtons[0])

    const resetBtn = screen.getByRole("button", { name: /Reiniciar tablero/i })
    expect(resetBtn).toBeTruthy()

    fireEvent.click(resetBtn)
    expect(screen.queryByRole("button", { name: /Reiniciar tablero/i })).toBeNull()
  })

  it("updates live profitability savings when monthly order volume changes", () => {
    renderLanding()

    const slider = screen.getByLabelText("Pedidos mensuales estimados") as HTMLInputElement
    expect(slider.value).toBe("400")

    fireEvent.change(slider, { target: { value: "800" } })
    expect(slider.value).toBe("800")
    // 800 orders * $45.000 * 28% = $10.080.000/month -> $120.960.000/year
    expect(screen.getByText("$120.960.000")).toBeTruthy()
  })

  it("renders cleanly under prefers-reduced-motion: reduce", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes(": reduce"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    )

    renderLanding()
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("< 30s")).toBeTruthy()
    expect(screen.getByText("+45%")).toBeTruthy()
    expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Creá tu Menú")).toBeTruthy()
  })
})
