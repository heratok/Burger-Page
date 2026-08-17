import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { CartProvider } from "@/store/CartContext"
import Storefront from "./Storefront"

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute("style")
})

function renderStorefront(path: string) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/r/:slug" element={<Storefront />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>
  )
}

describe("Storefront (ST-1, RD-2)", () => {
  it("renders branding and WhatsApp from the active restaurant config", async () => {
    renderStorefront("/r/pizza-roma")

    // Header branding comes from Pizza Roma, not the legacy default.
    expect(screen.getByText("PIZZA ROMA")).toBeTruthy()
    expect(
      screen.getByLabelText("Contactar por WhatsApp").getAttribute("href")
    ).toBe("https://wa.me/573001234567")

    // Products belong to the active restaurant.
    expect(await screen.findByText("Pizza Margherita")).toBeTruthy()
    expect(screen.queryByText("Misisipi")).toBeNull()
  })

  it("applies the restaurant palette on mount", async () => {
    renderStorefront("/r/pizza-roma")

    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue("--accent")
      ).toBe("rgb(230, 57, 70)")
    )
  })

  it("shows prices in COP", async () => {
    renderStorefront("/r/sushi-tokio")

    expect(await screen.findByText("$28.000")).toBeTruthy()
  })

  it("shows a not-found state linking back to the directory for an unknown slug", () => {
    renderStorefront("/r/unknown")

    expect(screen.getByText(/no encontrada/i)).toBeTruthy()
    expect(screen.getByRole("link", { name: /volver al directorio/i })).toBeTruthy()
  })
})