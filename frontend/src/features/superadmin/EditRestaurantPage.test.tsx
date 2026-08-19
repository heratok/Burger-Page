import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { LocalStorageRepository, STORAGE_KEY } from "@/shared/storage/storage"
import type { Restaurant } from "@/shared/domain/domain"
import EditRestaurantPage from "./EditRestaurantPage"

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

function renderPage(directory: LocalStorageRepository, id: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/restaurants/${id}/edit`]}>
      <Routes>
        <Route
          path="/admin/restaurants/:id/edit"
          element={<EditRestaurantPage directory={directory} />}
        />
      </Routes>
    </MemoryRouter>
  )
}

function seededDirectory(): LocalStorageRepository {
  return new LocalStorageRepository(window.localStorage)
}

function readEnvelope(): { restaurants: Restaurant[] } {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
}

function findRestaurant(id: string): Restaurant {
  const found = readEnvelope().restaurants.find((r) => r.id === id)
  if (!found) throw new Error(`restaurant ${id} missing`)
  return found
}

describe("EditRestaurantPage (SA-2 Rename, SA-4 Scoped)", () => {
  it("pre-fills the form from the restaurant and shows the immutable slug", () => {
    const directory = seededDirectory()
    renderPage(directory, "rest-pizza-roma")

    expect(
      (screen.getByLabelText("Nombre del restaurante") as HTMLInputElement).value
    ).toBe("PIZZA ROMA")
    expect(
      (screen.getByLabelText("Contraseña de administrador") as HTMLInputElement)
        .value
    ).toBe("roma")
    expect((screen.getByLabelText(/slug/i) as HTMLInputElement).value).toBe(
      "pizza-roma"
    )
    expect(
      (screen.getByLabelText("Color de acento") as HTMLInputElement).value
    ).toBe("#E63946")
  })

  it("renames the restaurant without changing its slug (SA-2 Rename)", async () => {
    const directory = seededDirectory()
    renderPage(directory, "rest-pizza-roma")

    fireEvent.change(screen.getByLabelText("Nombre del restaurante"), {
      target: { value: "PIZZA NAPOLI" },
    })
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }))

    await waitFor(() =>
      expect(findRestaurant("rest-pizza-roma").config.name).toBe("PIZZA NAPOLI")
    )
    const updated = findRestaurant("rest-pizza-roma")
    expect(updated.slug).toBe("pizza-roma")
    expect(updated.products).toHaveLength(3)
  })

  it("changes only the edited restaurant's password (SA-4 Scoped)", async () => {
    const directory = seededDirectory()
    renderPage(directory, "rest-pizza-roma")

    fireEvent.change(screen.getByLabelText("Contraseña de administrador"), {
      target: { value: "nueva-roma" },
    })
    fireEvent.change(screen.getByLabelText("Confirmar contraseña de administrador"), {
      target: { value: "nueva-roma" },
    })
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }))

    await waitFor(() =>
      expect(findRestaurant("rest-pizza-roma").config.adminPassword).toBe(
        "nueva-roma"
      )
    )
    expect(findRestaurant("rest-burger-page").config.adminPassword).toBe("admin")
  })

  it("rejects a password confirmation mismatch and saves nothing", async () => {
    const directory = seededDirectory()
    renderPage(directory, "rest-pizza-roma")

    fireEvent.change(screen.getByLabelText("Contraseña de administrador"), {
      target: { value: "nueva-roma" },
    })
    fireEvent.change(screen.getByLabelText("Confirmar contraseña de administrador"), {
      target: { value: "otra-cosa" },
    })
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }))

    expect(await screen.findByText(/no coinciden/i)).toBeTruthy()
    expect(findRestaurant("rest-pizza-roma").config.adminPassword).toBe("roma")
  })

  it("shows the not-found state for an unknown restaurant id", () => {
    const directory = seededDirectory()
    renderPage(directory, "rest-unknown")

    expect(screen.getByText(/no encontrada/i)).toBeTruthy()
  })
})