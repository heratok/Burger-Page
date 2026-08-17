import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type {
  Modifier,
  Order,
  Product,
  RestaurantConfig,
} from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"
import ConfigPage from "./ConfigPage"

afterEach(() => {
  cleanup()
})

function createConfigRepo(config: RestaurantConfig) {
  const state = { config: { ...config } }
  const repo: RestaurantRepository = {
    getConfig: () => state.config,
    saveConfig: vi.fn((next: RestaurantConfig) => {
      state.config = { ...next }
    }),
    listProducts: () => [] as Product[],
    saveProduct: vi.fn(),
    deleteProduct: vi.fn(),
    listModifiers: () => [] as Modifier[],
    saveModifier: vi.fn(),
    deleteModifier: vi.fn(),
    listOrders: () => [] as Order[],
    saveOrder: vi.fn(),
    updateOrderStatus: vi.fn(),
  }
  return { repo, state }
}

const BASE_CONFIG: RestaurantConfig = {
  name: "BURGER PAGE",
  whatsapp: "573022575805",
  logo: "/logo.jpg",
  accent: "#FF7A21",
  adminPassword: "admin",
}

function renderPage(repo: RestaurantRepository) {
  render(<ConfigPage repo={repo} />)
}

describe("ConfigPage", () => {
  it("pre-fills every config field from the repository", () => {
    const { repo } = createConfigRepo(BASE_CONFIG)
    renderPage(repo)

    const name = screen.getByLabelText(/nombre/i) as HTMLInputElement
    const whatsapp = screen.getByLabelText(/whatsapp/i) as HTMLInputElement
    const logo = screen.getByLabelText(/logo/i) as HTMLInputElement
    const accent = screen.getByLabelText(/color/i) as HTMLInputElement
    const password = screen.getByLabelText(/contraseña/i) as HTMLInputElement

    expect(name.value).toBe("BURGER PAGE")
    expect(whatsapp.value).toBe("573022575805")
    expect(logo.value).toBe("/logo.jpg")
    expect(accent.value).toBe("#FF7A21")
    expect(password.value).toBe("admin")
  })

  it("has no currency field (fixed COP per spec restaurant-config)", () => {
    const { repo } = createConfigRepo(BASE_CONFIG)
    renderPage(repo)

    expect(screen.queryByLabelText(/moneda|currency|divisa/i)).toBeNull()
    expect(screen.queryByText(/COP/i)).toBeNull()
  })

  it("persists edited fields and re-applies the accent color on save", async () => {
    const { repo } = createConfigRepo(BASE_CONFIG)
    renderPage(repo)

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "MI BURGER" },
    })
    fireEvent.change(screen.getByLabelText(/color/i), {
      target: { value: "#123456" },
    })
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }))

    await waitFor(() =>
      expect(repo.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ name: "MI BURGER", accent: "#123456" })
      )
    )
    expect(
      document.documentElement.style.getPropertyValue("--color-accent")
    ).toBe("rgb(18, 52, 86)")
  })

  it("rejects an invalid accent color and does not save", async () => {
    const { repo } = createConfigRepo(BASE_CONFIG)
    renderPage(repo)

    fireEvent.change(screen.getByLabelText(/color/i), {
      target: { value: "naranja" },
    })
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }))

    await waitFor(() => expect(screen.getByText(/color inválido/i)).toBeTruthy())
    expect(repo.saveConfig).not.toHaveBeenCalled()
  })
})