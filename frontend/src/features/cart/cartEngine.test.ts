import { describe, it, expect } from "vitest"
import {
  calculateLineItemTotal,
  calculateCartSummary,
  createCartItem,
  cartItemToOrderItem,
  type CartItem,
} from "./cartEngine"
import type { MenuItem } from "@/types/restaurant"

const mockProduct: MenuItem = {
  id: "prod-1",
  name: "Classic Cheeseburger",
  price: 25000,
  category: "Burgers",
  src: "https://example.com/burger.jpg",
  description: "Delicious burger with cheese",
  inStock: true,
}

describe("Cart Engine - calculateLineItemTotal", () => {
  it("calculates total for item without additions", () => {
    const total = calculateLineItemTotal({
      price: 25000,
      cantidad: 2,
    })
    expect(total).toBe(50000)
  })

  it("calculates total with additions correctly", () => {
    const total = calculateLineItemTotal({
      price: 25000,
      cantidad: 1,
      adiciones: [
        { price: 3000, cantidad: 2 },
        { price: 2000, cantidad: 1 },
      ],
    })
    expect(total).toBe(33000)
  })

  it("handles fallback to quantity 1 when 0 or negative", () => {
    const total = calculateLineItemTotal({
      price: 25000,
      cantidad: 0,
    })
    expect(total).toBe(25000)
  })
})

describe("Cart Engine - calculateCartSummary", () => {
  const items: CartItem[] = [
    {
      id: "1",
      name: "Burger 1",
      price: 20000,
      cantidad: 1,
      total: 20000,
      src: "",
      adiciones: [],
    },
    {
      id: "2",
      name: "Burger 2",
      price: 25000,
      cantidad: 2,
      total: 55000,
      src: "",
      adiciones: [{ name: "Bacon", price: 5000, cantidad: 1 }],
    },
  ]

  it("calculates subtotal, total items, and grand total with delivery fee", () => {
    const summary = calculateCartSummary(items, 4000)
    expect(summary.subtotal).toBe(75000)
    expect(summary.totalItems).toBe(3)
    expect(summary.deliveryFee).toBe(4000)
    expect(summary.total).toBe(79000)
  })

  it("returns zero totals and zero delivery fee when cart is empty", () => {
    const summary = calculateCartSummary([], 4000)
    expect(summary.subtotal).toBe(0)
    expect(summary.totalItems).toBe(0)
    expect(summary.deliveryFee).toBe(0)
    expect(summary.total).toBe(0)
  })
})

describe("Cart Engine - createCartItem and cartItemToOrderItem", () => {
  it("creates a well-formed CartItem filtering out zero-quantity additions", () => {
    const item = createCartItem({
      product: mockProduct,
      cantidad: 2,
      adiciones: [
        { name: "Extra Cheese", price: 3000, cantidad: 1 },
        { name: "No Onion", price: 0, cantidad: 0 },
      ],
      observacion: "Extra crispy please",
      customId: "fixed-id",
    })

    expect(item.id).toBe("fixed-id")
    expect(item.menuItemId).toBe("prod-1")
    expect(item.name).toBe("Classic Cheeseburger")
    expect(item.cantidad).toBe(2)
    expect(item.adiciones).toHaveLength(1)
    expect(item.adiciones[0].name).toBe("Extra Cheese")
    expect(item.total).toBe(53000)
    expect(item.observacion).toBe("Extra crispy please")
  })

  it("converts CartItem into OrderItem", () => {
    const item = createCartItem({
      product: mockProduct,
      cantidad: 1,
      adiciones: [{ name: "Extra Bacon", price: 4000, cantidad: 1 }],
    })

    const orderItem = cartItemToOrderItem(item)
    expect(orderItem.name).toBe("Classic Cheeseburger")
    expect(orderItem.price).toBe(25000)
    expect(orderItem.cantidad).toBe(1)
    expect(orderItem.total).toBe(29000)
    expect(orderItem.adiciones).toEqual([
      { name: "Extra Bacon", price: 4000, cantidad: 1 },
    ])
  })
})
