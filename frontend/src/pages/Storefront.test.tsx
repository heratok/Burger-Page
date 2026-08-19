import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { CartProvider } from "@/store/CartContext"
import Storefront from "./Storefront"
import type { DirectoryRepository, RestaurantRepository } from "@/lib/repository"
import type { Product, Restaurant } from "@/lib/domain"

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
          <Route path="/:slug" element={<Storefront />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>
  )
}

// ST-3 seam helpers: a fake directory whose data differs from the `storage`
// singleton, proving every read flows through the injected seam.
const FAKE_PRODUCT: Product = {
  id: "fake-1",
  name: "Burger Fantasma",
  src: "https://example.com/fake.png",
  price: 33000,
  description: "Producto del directorio falso",
  available: true,
}

function fakeRestaurant(products: Product[]): Restaurant {
  return {
    id: "rest-fake",
    slug: "fake-slug",
    config: {
      name: "CASA FANTASMA",
      whatsapp: "573009999999",
      logo: "/fake.jpg",
      accent: "#123456",
      adminPassword: "admin",
    },
    palette: {
      accent: "#123456",
      primary: "#123456",
      background: "#FFFFFF",
      surface: "#F2F2F2",
    },
    products,
    modifiers: [],
    orders: [],
  }
}

function fakeRepo(products: Product[]): RestaurantRepository {
  return {
    getConfig: () => fakeRestaurant(products).config,
    saveConfig: () => {},
    getPalette: () => fakeRestaurant(products).palette,
    savePalette: () => {},
    listProducts: () => products,
    saveProduct: () => {},
    deleteProduct: () => {},
    listModifiers: () => [],
    saveModifier: () => {},
    deleteModifier: () => {},
    listOrders: () => [],
    saveOrder: (order) => ({
      ...order,
      id: 1,
      status: "new",
      createdAt: new Date().toISOString(),
    }),
    updateOrderStatus: () => false,
  }
}

function fakeDirectory(products: Product[]): DirectoryRepository {
  const restaurant = fakeRestaurant(products)
  return {
    listRestaurants: () => [restaurant],
    getBySlug: (slug) => (slug === restaurant.slug ? restaurant : undefined),
    getRepositoryFor: (id) => (id === restaurant.id ? fakeRepo(products) : fakeRepo([])),
    createRestaurant: () => restaurant,
    deleteRestaurant: () => true,
    updateRestaurant: () => {},
    getSuperAdminPassword: () => "superadmin",
    setSuperAdminPassword: () => {},
  }
}

function renderWithDirectory(directory: DirectoryRepository) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={["/fake-slug"]}>
        <Routes>
          <Route path="/:slug" element={<Storefront directory={directory} />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>
  )
}

describe("Storefront (ST-1, RD-2)", () => {
  it("renders branding and WhatsApp from the active restaurant config", async () => {
    renderStorefront("/pizza-roma")

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
    renderStorefront("/pizza-roma")

    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue("--accent")
      ).toBe("rgb(230, 57, 70)")
    )
  })

  it("shows prices in COP", async () => {
    renderStorefront("/sushi-tokio")

    expect(await screen.findByText("$28.000")).toBeTruthy()
  })

  it("does not link the brand out of the storefront to / or /admin", async () => {
    renderStorefront("/pizza-roma")

    // The customer stays on their restaurant: the brand is not an anchor.
    expect(screen.getByText("PIZZA ROMA")).toBeTruthy()
    expect(screen.queryByRole("link", { name: /pizza roma/i })).toBeNull()
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull()
  })

  it("shows a not-found state for an unknown slug", () => {
    renderStorefront("/unknown")

    expect(screen.getByText(/no encontrada/i)).toBeTruthy()
    expect(screen.getByRole("link", { name: /volver al directorio/i })).toBeTruthy()
  })
})

describe("Storefront (ST-3 seam)", () => {
  it("reads branding, menu and WhatsApp through the injected directory", async () => {
    renderWithDirectory(fakeDirectory([FAKE_PRODUCT]))

    // Branding comes from the fake, not the storage singleton.
    expect(screen.getByText("CASA FANTASMA")).toBeTruthy()
    expect(await screen.findByText("Burger Fantasma")).toBeTruthy()
    expect(
      screen.getByLabelText("Contactar por WhatsApp").getAttribute("href")
    ).toBe("https://wa.me/573009999999")
    expect(screen.queryByText("PIZZA ROMA")).toBeNull()
  })

  it("renders the empty menu state when no products are available, without a seed burger", async () => {
    renderWithDirectory(fakeDirectory([{ ...FAKE_PRODUCT, available: false }]))

    expect(await screen.findByText(/no encontramos hamburguesas/i)).toBeTruthy()
    expect(screen.getByText("CASA FANTASMA")).toBeTruthy()
    expect(screen.queryByText("Misisipi")).toBeNull()
  })
})