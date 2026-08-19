import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { LocalStorageRepository } from "@/shared/storage/storage"
import { STORAGE_KEY } from "@/shared/storage/storage"
import { adminGrantKey } from "@/store/admin-context"
import type { Restaurant } from "@/shared/domain/domain"
import RestaurantsPage from "./RestaurantsPage"

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
})

function renderPage(directory: LocalStorageRepository) {
  return render(
    <MemoryRouter initialEntries={["/admin/restaurants"]}>
      <RestaurantsPage directory={directory} />
    </MemoryRouter>
  )
}

function seededDirectory(): LocalStorageRepository {
  return new LocalStorageRepository(window.localStorage)
}

function readEnvelope(): { restaurants: Restaurant[] } {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
}

describe("RestaurantsPage (SA-2 list, SA-3 delete)", () => {
  it("lists every restaurant with name, slug, logo and product count", () => {
    renderPage(seededDirectory())

    expect(screen.getByRole("heading", { name: "Restaurantes" })).toBeTruthy()
    expect(screen.getByText("BURGER PAGE")).toBeTruthy()
    expect(screen.getByText("PIZZA ROMA")).toBeTruthy()
    expect(screen.getByText("SUSHI TOKIO")).toBeTruthy()
    expect(screen.getByText(/pizza-roma/)).toBeTruthy()
    expect(screen.getByText(/5 productos/)).toBeTruthy()
    expect(screen.getAllByText(/3 productos/)).toHaveLength(2)
  })

  it("links to the unified admin for quick access and to the edit form", () => {
    renderPage(seededDirectory())

    const adminLink = screen.getByRole("link", { name: /administrar pizza roma/i })
    expect(adminLink.getAttribute("href")).toBe("/admin")

    const editLink = screen.getByRole("link", { name: /editar pizza roma/i })
    expect(editLink.getAttribute("href")).toBe("/admin/restaurants/rest-pizza-roma/edit")
  })

  it("keeps the restaurant when the delete confirmation is cancelled", () => {
    renderPage(seededDirectory())

    fireEvent.click(screen.getByRole("button", { name: /eliminar pizza roma/i }))
    expect(
      screen.getByRole("heading", { name: "Eliminar restaurante" })
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByRole("heading", { name: "Eliminar restaurante" })).toBeNull()
    expect(screen.getByText("PIZZA ROMA")).toBeTruthy()
    expect(readEnvelope().restaurants).toHaveLength(3)
  })

  it("removes the restaurant and its data on confirmed delete (SA-3 Confirm)", async () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderPage(seededDirectory())

    fireEvent.click(screen.getByRole("button", { name: /eliminar pizza roma/i }))
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }))

    await waitFor(() => expect(screen.queryByText("PIZZA ROMA")).toBeNull())
    const envelope = readEnvelope()
    expect(envelope.restaurants).toHaveLength(2)
    expect(
      envelope.restaurants.some((r) => r.id === "rest-pizza-roma")
    ).toBe(false)
  })

  it("invalidates the deleted restaurant's admin session (SA-3 session)", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderPage(seededDirectory())

    fireEvent.click(screen.getByRole("button", { name: /eliminar pizza roma/i }))
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }))

    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBeNull()
  })

  it("blocks deleting the last restaurant with a message (SA-3 Last)", () => {
    const directory = seededDirectory()
    const [first, second, third] = directory.listRestaurants()
    directory.deleteRestaurant(second.id)
    directory.deleteRestaurant(third.id)
    expect(directory.listRestaurants()).toHaveLength(1)

    renderPage(directory)

    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`eliminar ${first.config.name}`, "i") })
    )
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }))

    expect(screen.getByText(/no se puede eliminar el último restaurante/i)).toBeTruthy()
    expect(directory.listRestaurants()).toHaveLength(1)
    expect(readEnvelope().restaurants).toHaveLength(1)
  })
})