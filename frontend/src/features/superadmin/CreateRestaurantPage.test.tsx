import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { LocalStorageRepository } from "@/shared/storage/storage"
import { STORAGE_KEY } from "@/shared/storage/storage"
import type { Restaurant } from "@/shared/domain/domain"
import CreateRestaurantPage from "./CreateRestaurantPage"

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

function renderPage(directory: LocalStorageRepository) {
  return render(
    <MemoryRouter initialEntries={["/admin/restaurants/new"]}>
      <CreateRestaurantPage directory={directory} />
    </MemoryRouter>
  )
}

function seededDirectory(): LocalStorageRepository {
  return new LocalStorageRepository(window.localStorage)
}

function readEnvelope(): { restaurants: Restaurant[] } {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
}

function fillCreateForm({
  name,
  whatsapp = "573001112233",
  logo = "/logo-nuevo.png",
  password = "clave123",
  slug,
}: {
  name: string
  whatsapp?: string
  logo?: string
  password?: string
  slug?: string
}) {
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/whatsapp/i), { target: { value: whatsapp } })
  fireEvent.change(screen.getByLabelText(/logo/i), { target: { value: logo } })
  fireEvent.change(screen.getByLabelText(/contraseña/i), {
    target: { value: password },
  })
  if (slug !== undefined) {
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: slug } })
  }
}

describe("CreateRestaurantPage (SA-2)", () => {
  it("creates a restaurant that appears in the directory immediately", async () => {
    const directory = seededDirectory()
    const before = directory.listRestaurants().length
    renderPage(directory)

    fillCreateForm({ name: "Marisquería Don Pepe" })
    fireEvent.click(screen.getByRole("button", { name: /crear restaurante/i }))

    await waitFor(() =>
      expect(directory.listRestaurants().length).toBe(before + 1)
    )
    const created = directory
      .listRestaurants()
      .find((r) => r.config.name === "Marisquería Don Pepe")
    expect(created?.slug).toBe("marisqueria-don-pepe")
    expect(created?.config.whatsapp).toBe("573001112233")
    expect(created?.palette.accent).toBe("#FF7A21")
    const envelope = readEnvelope()
    expect(
      envelope.restaurants.some((r) => r.slug === "marisqueria-don-pepe")
    ).toBe(true)
  })

  it("assigns a unique suffix when the auto slug collides (SA-2 Slug auto)", async () => {
    const directory = seededDirectory()
    renderPage(directory)

    fillCreateForm({ name: "Pizza Roma" })
    fireEvent.click(screen.getByRole("button", { name: /crear restaurante/i }))

    await waitFor(() =>
      expect(directory.listRestaurants().some((r) => r.slug === "pizza-roma-2")).toBe(true)
    )
  })

  it("rejects a manual slug that is already in use and writes nothing (SA-2 Slug manual)", async () => {
    const directory = seededDirectory()
    const before = directory.listRestaurants().length
    renderPage(directory)

    fillCreateForm({ name: "Nuevo Lugar", slug: "pizza-roma" })
    fireEvent.click(screen.getByRole("button", { name: /crear restaurante/i }))

    expect(await screen.findByText(/ya está en uso/i)).toBeTruthy()
    expect(directory.listRestaurants().length).toBe(before)
    expect(readEnvelope().restaurants).toHaveLength(before)
  })

  it("rejects a manual slug reserved for system routes and writes nothing", async () => {
    const directory = seededDirectory()
    const before = directory.listRestaurants().length
    renderPage(directory)

    fillCreateForm({ name: "Nuevo Lugar", slug: "admin" })
    fireEvent.click(screen.getByRole("button", { name: /crear restaurante/i }))

    expect(await screen.findByText(/ya está en uso/i)).toBeTruthy()
    expect(directory.listRestaurants().length).toBe(before)
    expect(readEnvelope().restaurants).toHaveLength(before)
  })

  it("suffixes an auto slug that would collide with a reserved route", async () => {
    const directory = seededDirectory()
    renderPage(directory)

    fillCreateForm({ name: "Admin" })
    fireEvent.click(screen.getByRole("button", { name: /crear restaurante/i }))

    await waitFor(() =>
      expect(directory.listRestaurants().some((r) => r.slug === "admin-2")).toBe(true)
    )
  })

  it("transliterates non-ASCII names into the slug (SA-2 Non-ASCII)", async () => {
    const directory = seededDirectory()
    renderPage(directory)

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Ñoquis Bar" },
    })
    expect(screen.getByText(/noquis-bar/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/whatsapp/i), {
      target: { value: "573001112233" },
    })
    fireEvent.change(screen.getByLabelText(/logo/i), {
      target: { value: "/logo-noquis.png" },
    })
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "clave123" },
    })
    fireEvent.click(screen.getByRole("button", { name: /crear restaurante/i }))

    await waitFor(() =>
      expect(directory.listRestaurants().some((r) => r.slug === "noquis-bar")).toBe(true)
    )
  })

  it("validates the form and does not create on invalid data", async () => {
    const directory = seededDirectory()
    const before = directory.listRestaurants().length
    renderPage(directory)

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "X" } })
    fireEvent.change(screen.getByLabelText(/whatsapp/i), {
      target: { value: "no-es-numero" },
    })
    fireEvent.change(screen.getByLabelText(/logo/i), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "clave123" },
    })
    fireEvent.click(screen.getByRole("button", { name: /crear restaurante/i }))

    expect(await screen.findByText(/al menos 2 caracteres/i)).toBeTruthy()
    expect(directory.listRestaurants().length).toBe(before)
  })
})