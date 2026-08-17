import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { LocalStorageRepository } from "@/lib/storage"
import type { DirectoryRepository } from "@/lib/repository"
import { SEED_RESTAURANTS } from "@/data/data"
import RestaurantDirectory from "./RestaurantDirectory"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/** Full DirectoryRepository mock per the codebase convention (Form.test / ProductsPage.test). */
function createDirectoryRepo(restaurants: ReturnType<DirectoryRepository["listRestaurants"]>) {
  const repo: DirectoryRepository = {
    listRestaurants: () => restaurants,
    getBySlug: vi.fn(),
    createRestaurant: vi.fn(),
    deleteRestaurant: vi.fn(),
    updateRestaurant: vi.fn(),
    getSuperAdminPassword: vi.fn(),
    setSuperAdminPassword: vi.fn(),
  }
  return repo
}

function renderDirectory(directory: DirectoryRepository) {
  return render(
    <MemoryRouter>
      <RestaurantDirectory directory={directory} />
    </MemoryRouter>
  )
}

describe("RestaurantDirectory (RD-1)", () => {
  it("lists every seeded restaurant as a card linking its storefront", () => {
    const directory = new LocalStorageRepository(window.localStorage)
    renderDirectory(directory)

    const list = screen.getByRole("list", { name: "Restaurantes disponibles" })
    const cards = within(list).getAllByRole("listitem")
    expect(cards).toHaveLength(SEED_RESTAURANTS.length)

    for (const restaurant of SEED_RESTAURANTS) {
      const card = screen.getByRole("link", {
        name: new RegExp(restaurant.config.name),
      })
      expect(card.getAttribute("href")).toBe(`/r/${restaurant.slug}`)
      expect(within(card).getByText(restaurant.config.name)).toBeTruthy()
      const logo = card.querySelector("img") as HTMLImageElement | null
      expect(logo?.getAttribute("src")).toBe(restaurant.config.logo)
      const accentDot = card.querySelector("[data-accent]") as HTMLElement | null
      expect(accentDot?.style.backgroundColor).toBe(
        `rgb(${hexToRgb(restaurant.palette.accent).join(", ")})`
      )
    }
  })

  it("renders an empty state with guidance when there are no restaurants", () => {
    const directory = createDirectoryRepo([])
    renderDirectory(directory)

    expect(screen.getByText(/aún no hay restaurantes/i)).toBeTruthy()
    expect(screen.getByRole("link", { name: /administración/i })).toBeTruthy()
  })
})

function hexToRgb(hex: string): number[] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}