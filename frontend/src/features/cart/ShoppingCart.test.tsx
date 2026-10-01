import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
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
