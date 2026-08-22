import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import EmptyCart from "@/features/cart/EmptyCart"
import ShoppingCart from "@/features/cart/ShoppingCart"

describe("Cart Theme Contrast & Empty State", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders EmptyCart with visible text and brand action button", () => {
    render(
      <RestaurantProvider>
        <EmptyCart onBackToMenu={() => {}} />
      </RestaurantProvider>
    )

    expect(screen.getByText("Tu carrito está vacío")).toBeDefined()
    expect(screen.getByText("Agregá productos desde el menú para empezar tu pedido.")).toBeDefined()
    expect(screen.getByRole("button", { name: /Explorar menú/i })).toBeDefined()
  })

  it("renders empty ShoppingCart properly", () => {
    render(
      <RestaurantProvider>
        <ShoppingCart
          items={[]}
          onClose={() => {}}
          onCloseCart={() => {}}
          onOpenCheckout={() => {}}
          onDeleteCart={() => {}}
          onEditItem={() => {}}
        />
      </RestaurantProvider>
    )

    expect(screen.getByText("Tu carrito está vacío")).toBeDefined()
  })
})
