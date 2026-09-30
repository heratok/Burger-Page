import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
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
})
