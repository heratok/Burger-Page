import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import App from "./App"
import { adminGrantKey } from "@/store/admin-context"
import { STORAGE_KEY, storage } from "@/lib/storage"
import { SEED_RESTAURANTS } from "@/data/data"
import type { Restaurant } from "@/lib/domain"

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

  it("shows the restaurant password gate at /r/:slug/admin without a session", () => {
    renderAt("#/r/pizza-roma/admin")

    expect(
      screen.getByRole("heading", { name: "Panel de administración" })
    ).toBeTruthy()
    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeTruthy()
  })
})

describe("App admin routes (AD-1, session readiness for the super portal)", () => {
  it("shows the password gate at /admin/products without a session grant", () => {
    renderAt("#/admin/products")

    expect(
      screen.getByRole("heading", { name: "Panel de administración" })
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeTruthy()
  })

  it("renders the first-restaurant admin at /admin/products with a scoped grant", () => {
    sessionStorage.setItem(adminGrantKey("rest-burger-page"), "1")
    renderAt("#/admin/products")

    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
    expect(screen.getByText("Misisipi")).toBeTruthy()
  })

  it("redirects /admin to the product management section with a grant", () => {
    sessionStorage.setItem(adminGrantKey("rest-burger-page"), "1")
    renderAt("#/admin")

    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
  })

  it("does not open /admin with a restaurant-mode session for another restaurant", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderAt("#/admin/products")

    expect(
      screen.getByRole("heading", { name: "Panel de administración" })
    ).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Productos" })).toBeNull()
  })

  it("grants the scoped admin after the correct restaurant password", async () => {
    renderAt("#/r/pizza-roma/admin/products")

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "roma" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }))

    expect(await screen.findByRole("heading", { name: "Productos" })).toBeTruthy()
    expect(screen.getByText("PIZZA ROMA")).toBeTruthy()
    expect(screen.getByText("Pizza Margherita")).toBeTruthy()
    expect(screen.queryByText("Misisipi")).toBeNull()
  })

  it("rejects a wrong password at the restaurant gate and grants nothing", () => {
    renderAt("#/r/pizza-roma/admin")

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "nope" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }))

    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/contraseña incorrecta/i)).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Productos" })).toBeNull()
  })

  it("does not let a pizza-roma session open the burger-page admin (AD-1 Scoped)", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderAt("#/r/burger-page/admin")

    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Productos" })).toBeNull()
  })

  it("keeps a granted restaurant session across reloads (AD-1 Reload)", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderAt("#/r/pizza-roma/admin/products")

    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
    expect(screen.getByText("Pizza Margherita")).toBeTruthy()
  })

  it("shows not-found for an unknown restaurant admin slug", () => {
    renderAt("#/r/unknown/admin")

    expect(screen.getByText(/no encontrada/i)).toBeTruthy()
  })

  it("shows only the active restaurant's orders in the scoped admin", async () => {
    const roma = storage.getRepositoryFor("rest-pizza-roma")
    roma.saveOrder({
      items: [],
      customer: {
        nombre: "Cliente Roma",
        telefono: "3001112222",
        direccion: "Calle 1 #2-3",
        barrio: "Centro",
      },
      metodo: "Efectivo",
      total: 32000,
    })
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderAt("#/r/pizza-roma/admin/orders")

    expect(await screen.findByText("$32.000")).toBeTruthy()
    expect(screen.getByText(/Cliente Roma/)).toBeTruthy()
    expect(screen.queryByText(/no hay pedidos/i)).toBeNull()
  })

  it("does not leak another restaurant's orders into the scoped admin", () => {
    const roma = storage.getRepositoryFor("rest-pizza-roma")
    roma.saveOrder({
      items: [],
      customer: {
        nombre: "Cliente Roma",
        telefono: "3001112222",
        direccion: "Calle 1 #2-3",
        barrio: "Centro",
      },
      metodo: "Efectivo",
      total: 32000,
    })
    sessionStorage.setItem(adminGrantKey("rest-burger-page"), "1")
    renderAt("#/r/burger-page/admin/orders")

    expect(screen.getByText(/no hay pedidos/i)).toBeTruthy()
    expect(screen.queryByText("Cliente Roma")).toBeNull()
  })

  it("applies accent edits to the active restaurant's palette only (D1)", async () => {
    renderAt("#/r/pizza-roma/admin")
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "roma" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }))
    await screen.findByRole("heading", { name: "Productos" })

    navigateTo("#/r/pizza-roma/admin/config")
    const accent = await screen.findByLabelText(/color de acento/i)
    fireEvent.change(accent, { target: { value: "#123456" } })
    fireEvent.click(screen.getByRole("button", { name: /guardar configuración/i }))

    await waitFor(() => {
      const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
      const roma = envelope.restaurants.find(
        (r: Restaurant) => r.id === "rest-pizza-roma"
      )
      const burger = envelope.restaurants.find(
        (r: Restaurant) => r.id === "rest-burger-page"
      )
      expect(roma.palette.accent).toBe("#123456")
      expect(burger.palette.accent).toBe("#FF7A21")
    })
  })
})