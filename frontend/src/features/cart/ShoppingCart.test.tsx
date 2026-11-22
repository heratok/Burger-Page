import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import ShoppingCart from "./ShoppingCart"
import type { CartItem } from "./cartEngine"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import type { RestaurantRecord } from "@/types/restaurant"

function seedTenantWithMinOrder(minOrderAmount: number) {
  const record: RestaurantRecord = {
    id: "rest-test",
    slug: "test-rest",
    isActive: true,
    createdAt: new Date().toISOString(),
    config: {
      ...DEFAULT_STORE_CONFIG,
      minOrderAmount,
    },
    categories: [],
    products: [],
    additions: [],
    orders: [],
    customers: [],
    inventory: [],
    suppliers: [],
  }
  localStorage.setItem(
    "burger_page_platform_v2",
    JSON.stringify({ version: 2, restaurants: [record] })
  )
  localStorage.setItem("burger_page_active_rest_v2", "rest-test")
}

const mockItem: CartItem = {
  id: "p1",
  name: "Burger Clásica",
  price: 20000,
  cantidad: 1,
  total: 20000,
  src: "",
  adiciones: [],
}

describe("ShoppingCart - Min Order Validation", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("displays min order warning and disables Confirmar orden when subtotal is below minimum", () => {
    seedTenantWithMinOrder(30000)

    render(
      <RestaurantProvider>
        <ShoppingCart
          items={[mockItem]} // total 20000 < 30000
          onClose={() => {}}
          onCloseCart={() => {}}
          onOpenCheckout={() => {}}
          onDeleteCart={() => {}}
          onEditItem={() => {}}
        />
      </RestaurantProvider>
    )

    const alert = screen.getByText(/El pedido mínimo es de \$30\.000\. Te faltan \$10\.000 para poder ordenar\./i)
    expect(alert).toBeDefined()

    const confirmBtn = screen.getByRole("button", { name: /Confirmar orden/i }) as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
  })

  it("enables Confirmar orden and hides alert when subtotal meets or exceeds minimum", () => {
    seedTenantWithMinOrder(20000)

    render(
      <RestaurantProvider>
        <ShoppingCart
          items={[mockItem]} // total 20000 == 20000
          onClose={() => {}}
          onCloseCart={() => {}}
          onOpenCheckout={() => {}}
          onDeleteCart={() => {}}
          onEditItem={() => {}}
        />
      </RestaurantProvider>
    )

    expect(screen.queryByText(/El pedido mínimo es de/i)).toBeNull()
    const confirmBtn = screen.getByRole("button", { name: /Confirmar orden/i }) as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(false)
  })
})

describe("ShoppingCart - Product image fallback (S8 / G3)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  const renderItem = (item: CartItem) =>
    render(
      <RestaurantProvider>
        <ShoppingCart
          items={[item]}
          onClose={() => {}}
          onCloseCart={() => {}}
          onOpenCheckout={() => {}}
          onDeleteCart={() => {}}
          onEditItem={() => {}}
        />
      </RestaurantProvider>
    )

  it("renders the graceful image fallback instead of a native broken image when the item has no source", () => {
    seedTenantWithMinOrder(0)
    renderItem({ ...mockItem, src: "" })

    const row = screen.getByText("Burger Clásica").closest("li") as HTMLElement
    // No bare <img> may reach the browser: an empty src paints the native
    // broken-image glyph plus clipped alt text.
    expect(within(row).queryByRole("img")).toBeNull()
    expect(within(row).getByTestId("lazy-image-fallback")).toBeDefined()
  })

  it("keeps the product photo in the cart-sized frame when the item has a source", () => {
    seedTenantWithMinOrder(0)
    renderItem({
      ...mockItem,
      src: "https://example.supabase.co/storage/v1/object/public/image/products/burger.png",
    })

    const row = screen.getByText("Burger Clásica").closest("li") as HTMLElement
    const img = within(row).getByRole("img", { name: "Burger Clásica" })
    expect(img.getAttribute("src")).toContain("products/burger.png")

    const frame = img.parentElement as HTMLElement
    expect(frame.className).toContain("size-16")
    expect(frame.className).toContain("sm:size-20")
    expect(frame.className).toContain("rounded-xl")
  })
})

describe("ShoppingCart - Opening hours", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  function seedWith(overrides: Partial<RestaurantRecord["config"]>) {
    seedTenantWithMinOrder(0)
    const env = JSON.parse(localStorage.getItem("burger_page_platform_v2")!)
    env.restaurants[0].config = { ...env.restaurants[0].config, ...overrides }
    localStorage.setItem("burger_page_platform_v2", JSON.stringify(env))
  }

  const renderCart = () =>
    render(
      <RestaurantProvider>
        <ShoppingCart
          items={[mockItem]}
          onClose={() => {}}
          onCloseCart={() => {}}
          onOpenCheckout={() => {}}
          onDeleteCart={() => {}}
          onEditItem={() => {}}
        />
      </RestaurantProvider>
    )

  it("blocks Confirmar orden with the closed message when outside the schedule", () => {
    seedWith({ schedule: [] })
    renderCart()
    expect(screen.getByText("Este restaurante se encuentra fuera del horario de atención.")).toBeDefined()
    expect((screen.getByRole("button", { name: /Confirmar orden/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("blocks Confirmar orden with the paused message when orders are paused", () => {
    seedWith({ ordersPaused: true })
    renderCart()
    expect(screen.getByText("Este restaurante tiene los pedidos en pausa en este momento.")).toBeDefined()
    expect((screen.getByRole("button", { name: /Confirmar orden/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("does not block an open store", () => {
    seedWith({})
    renderCart()
    expect(screen.queryByText(/fuera del horario/)).toBeNull()
    expect((screen.getByRole("button", { name: /Confirmar orden/i }) as HTMLButtonElement).disabled).toBe(false)
  })
})

// S12 — dead blur. The cart footer is `fixed` across the whole viewport width
// and sits on the opaque `--color-bg-surface`, so a backdrop filter there
// composites every frame for zero visual effect.
describe("ShoppingCart - no dead blur on the fixed footer (S12)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  const renderCart = () =>
    render(
      <RestaurantProvider>
        <ShoppingCart
          items={[mockItem]}
          onClose={() => {}}
          onCloseCart={() => {}}
          onOpenCheckout={() => {}}
          onDeleteCart={() => {}}
          onEditItem={() => {}}
        />
      </RestaurantProvider>
    )

  const tokens = (element: Element | null) => (element?.className ?? "").split(/\s+/).filter(Boolean)

  it("removes the blur from the footer that floats over the opaque surface", () => {
    seedTenantWithMinOrder(0)
    renderCart()

    const footer = screen.getByRole("button", { name: /Confirmar orden/i }).closest(".fixed") as HTMLElement | null
    expect(footer).not.toBeNull()

    expect(tokens(footer).filter((c) => c.includes("backdrop-blur"))).toEqual([])
    // Everything else about the bar stays identical: same pin, same stacking,
    // same opaque surface colour behind the totals.
    expect(tokens(footer)).toContain("bottom-0")
    expect(tokens(footer)).toContain("z-30")
    expect(tokens(footer)).toContain("border-t")
    expect((footer as HTMLElement).style.backgroundColor).toBe("var(--color-bg-surface)")
  })
})
