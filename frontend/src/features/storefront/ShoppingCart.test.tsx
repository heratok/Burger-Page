import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { CartContext, type CartContextValue } from "@/store/cart-context"
import ShoppingCart from "./ShoppingCart"
import type { CartItem } from "@/shared/domain/domain"

afterEach(() => {
  cleanup()
})

function makeItem(overrides: Partial<CartItem> = {}, index = 0): CartItem {
  return {
    id: `item-${index}`,
    productId: `product-${index}`,
    name: `Hamburguesa ${index}`,
    src: "",
    unitPrice: 10000,
    cantidad: 1,
    modifiers: [],
    observacion: "",
    total: 10000,
    ...overrides,
  }
}

function makeCartValue(items: CartItem[]): CartContextValue {
  return {
    items,
    total: items.reduce((acc, item) => acc + item.total, 0),
    addItem: () => {},
    updateItem: () => {},
    removeItem: () => {},
    clear: () => {},
  }
}

function renderCart(items: CartItem[]) {
  return render(
    <CartContext.Provider value={makeCartValue(items)}>
      <ShoppingCart
        cerrar={() => {}}
        cerrarCarrito={() => {}}
        abrirForm={() => {}}
        editarItem={() => {}}
      />
    </CartContext.Provider>
  )
}

describe("ShoppingCart long free-text wrapping", () => {
  it("wraps a long observation in a word-break span", () => {
    const longWord = "a".repeat(200)
    renderCart([
      makeItem({ observacion: longWord, modifiers: [] }),
    ])

    // The note paragraph is split into a label span and a content span;
    // getByText only matches leaf text nodes, so query the content span.
    const textSpan = screen.getByText(longWord)
    expect(textSpan.className).toContain("break-words")
    expect(textSpan.textContent).toBe(longWord)
  })

  it("wraps modifier additions in a word-break span", () => {
    const longModifierName = "b".repeat(120)
    renderCart([
      makeItem({
        observacion: "",
        modifiers: [
          { id: "m1", name: longModifierName, price: 2000, cantidad: 1 },
        ],
      }),
    ])

    const textSpan = screen.getByText((content) =>
      content.includes(longModifierName)
    )
    expect(textSpan.className).toContain("break-words")
    expect(textSpan.textContent).toContain(longModifierName)
  })

  it("renders cards without word-break spans when there is no free text", () => {
    renderCart([makeItem()])
    expect(screen.queryByText(/Nota:/)).toBeNull()
    expect(screen.queryByText(/Adiciones:/)).toBeNull()
    expect(screen.getByText("Hamburguesa 0")).toBeTruthy()
  })
})