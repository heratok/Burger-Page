import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import App from "./App"
import { ADMIN_GRANT_KEY } from "@/store/admin-context"
import { SEED_RESTAURANTS } from "@/data/data"

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.removeAttribute("style")
  window.location.hash = "#/"
})

/** Navigate the HashRouter by setting the hash and notifying its history. */
function navigateTo(hash: string) {
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
}

function renderAt(hash: string) {
  window.location.hash = hash
  render(<App />)
}

describe("App routing (RD-1, RD-2, ST-2)", () => {
  it("renders the restaurant directory at the root route", () => {
    renderAt("#/")

    const list = screen.getByRole("list", { name: "Restaurantes disponibles" })
    expect(list.querySelectorAll("li")).toHaveLength(SEED_RESTAURANTS.length)
    for (const restaurant of SEED_RESTAURANTS) {
      expect(
        screen.getByRole("link", {
          name: new RegExp(restaurant.config.name),
        }).getAttribute("href")
      ).toBe(`#/r/${restaurant.slug}`)
    }
  })

  it("renders the storefront of the restaurant at /r/:slug", async () => {
    renderAt("#/r/pizza-roma")

    expect(screen.getByText("PIZZA ROMA")).toBeTruthy()
    expect(await screen.findByText("Pizza Margherita")).toBeTruthy()
    expect(screen.queryByText("Misisipi")).toBeNull()
  })

  it("shows a not-found state for an unknown slug", () => {
    renderAt("#/r/unknown")

    expect(screen.getByText(/no encontrada/i)).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /volver al directorio/i }).getAttribute("href")
    ).toBe("#/")
  })

  it("falls back to the directory not-found for unknown routes", () => {
    renderAt("#/nope")

    expect(screen.getByText(/no encontrada/i)).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /volver al directorio/i }).getAttribute("href")
    ).toBe("#/")
  })

  it("clears the cart when navigating between restaurants", async () => {
    renderAt("#/r/pizza-roma")

    fireEvent.click(
      await screen.findByRole("button", {
        name: /agregar pizza margherita al carrito/i,
      })
    )
    fireEvent.click(screen.getByRole("button", { name: /^agregar ·/i }))
    expect(screen.getAllByLabelText(/ver orden, 1 producto/i).length).toBeGreaterThan(0)

    navigateTo("#/r/sushi-tokio")
    await waitFor(() =>
      expect(screen.getByLabelText(/ver orden, 0 productos/i)).toBeTruthy()
    )
  })

  it("restores the default theme when leaving a restaurant", async () => {
    renderAt("#/r/pizza-roma")

    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue("--accent")
      ).toBe("rgb(230, 57, 70)")
    )

    navigateTo("#/")
    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue("--accent")
      ).toBe("rgb(255, 122, 33)")
    )
  })

  it("renders the restaurant admin placeholder at /r/:slug/admin", () => {
    renderAt("#/r/pizza-roma/admin")

    expect(
      screen.getByRole("heading", { name: "Panel de pizza-roma" })
    ).toBeTruthy()
  })
})

describe("App admin routes", () => {
  it("shows the password gate at /admin/products without a session grant", () => {
    renderAt("#/admin/products")

    expect(screen.getByText("Panel de administración")).toBeTruthy()
    expect(screen.getByText(/contraseña de administrador/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeTruthy()
  })

  it("renders the admin product management at /admin/products with a grant", () => {
    sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
    renderAt("#/admin/products")

    expect(screen.getByText("Panel de administración")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
  })

  it("redirects /admin to the product management section with a grant", () => {
    sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
    renderAt("#/admin")

    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
  })
})