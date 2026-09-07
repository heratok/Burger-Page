import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCart, getCartStorageKey, DEFAULT_CART_TTL_MS } from "./useCart"
import type { CartItem } from "./cartEngine"
import type { MenuItem } from "@/types/restaurant"

const mockProductA: MenuItem = {
  id: "prod-1",
  name: "Hamburguesa Clásica",
  price: 25000,
  category: "Hamburguesas",
  src: "https://example.com/hamburguesa.jpg",
  description: "Carne 150g, queso cheddar y vegetales",
  inStock: true,
}

const mockProductB: MenuItem = {
  id: "prod-2",
  name: "Papas Rústicas",
  price: 12000,
  category: "Acompañamientos",
  src: "https://example.com/papas.jpg",
  description: "Papas crocantes con especias",
  inStock: true,
}

const mockCartItemA: CartItem = {
  id: "cart-item-1",
  menuItemId: "prod-1",
  name: "Hamburguesa Clásica",
  price: 25000,
  cantidad: 2,
  total: 50000,
  src: "https://example.com/hamburguesa.jpg",
  observacion: "Sin cebolla",
  adiciones: [],
}

const mockCartItemB: CartItem = {
  id: "cart-item-2",
  menuItemId: "prod-2",
  name: "Papas Rústicas",
  price: 12000,
  cantidad: 1,
  total: 12000,
  src: "https://example.com/papas.jpg",
  observacion: "",
  adiciones: [],
}

describe("useCart hook - Multi-Tenant Persistence & Catalog Revalidation", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("initializes with empty cart when localStorage is empty", () => {
    const { result } = renderHook(() =>
      useCart({ restaurantId: "rest-craft", products: [mockProductA] })
    )

    expect(result.current.cartItems).toEqual([])
    expect(result.current.totalCart).toBe(0)
    expect(result.current.itemCount).toBe(0)
  })

  it("persists items to localStorage when adding to cart", () => {
    const { result } = renderHook(() =>
      useCart({ restaurantId: "rest-craft", products: [mockProductA] })
    )

    act(() => {
      result.current.addToCart(mockCartItemA)
    })

    expect(result.current.cartItems).toHaveLength(1)
    expect(result.current.cartItems[0].name).toBe("Hamburguesa Clásica")
    expect(result.current.totalCart).toBe(50000)
    expect(result.current.itemCount).toBe(2)

    // Check localStorage
    const storageKey = getCartStorageKey("rest-craft")
    const raw = localStorage.getItem(storageKey)
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw!)
    expect(parsed.restaurantId).toBe("rest-craft")
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0].name).toBe("Hamburguesa Clásica")
  })

  it("rehydrates cart items from localStorage on mount", () => {
    const storageKey = getCartStorageKey("rest-craft")
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        restaurantId: "rest-craft",
        updatedAt: Date.now(),
        items: [mockCartItemA, mockCartItemB],
      })
    )

    const { result } = renderHook(() =>
      useCart({ restaurantId: "rest-craft", products: [mockProductA, mockProductB] })
    )

    expect(result.current.cartItems).toHaveLength(2)
    expect(result.current.totalCart).toBe(62000)
    expect(result.current.itemCount).toBe(3)
  })

  it("isolates carts across different restaurants (multi-tenant isolation)", () => {
    // Save cart for restaurant 1
    const key1 = getCartStorageKey("rest-burger-craft")
    localStorage.setItem(
      key1,
      JSON.stringify({
        version: 1,
        restaurantId: "rest-burger-craft",
        updatedAt: Date.now(),
        items: [mockCartItemA],
      })
    )

    // Render hook for restaurant 2
    const { result } = renderHook(() =>
      useCart({ restaurantId: "rest-pizza-place", products: [] })
    )

    expect(result.current.cartItems).toEqual([])

    // Now switch to restaurant 1
    const { result: resultRest1 } = renderHook(() =>
      useCart({ restaurantId: "rest-burger-craft", products: [mockProductA] })
    )

    expect(resultRest1.current.cartItems).toHaveLength(1)
    expect(resultRest1.current.cartItems[0].name).toBe("Hamburguesa Clásica")
  })

  it("discards expired cart items when TTL is exceeded", () => {
    const storageKey = getCartStorageKey("rest-craft")
    const twoDaysAgo = Date.now() - (DEFAULT_CART_TTL_MS + 10000)

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        restaurantId: "rest-craft",
        updatedAt: twoDaysAgo,
        items: [mockCartItemA],
      })
    )

    const { result } = renderHook(() =>
      useCart({ restaurantId: "rest-craft", products: [mockProductA] })
    )

    expect(result.current.cartItems).toEqual([])
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it("revalidates and removes out-of-stock items from cart", () => {
    const storageKey = getCartStorageKey("rest-craft")
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        restaurantId: "rest-craft",
        updatedAt: Date.now(),
        items: [mockCartItemA, mockCartItemB],
      })
    )

    // mockProductA is now out of stock
    const productAOutOfStock = { ...mockProductA, inStock: false }
    const onItemRemoved = vi.fn()

    const { result } = renderHook(() =>
      useCart({
        restaurantId: "rest-craft",
        products: [productAOutOfStock, mockProductB],
        onItemRemoved,
      })
    )

    expect(onItemRemoved).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Hamburguesa Clásica" }),
      "out_of_stock"
    )
    expect(result.current.cartItems).toHaveLength(1)
    expect(result.current.cartItems[0].name).toBe("Papas Rústicas")
  })

  it("revalidates and updates prices when product prices change in catalog", () => {
    const storageKey = getCartStorageKey("rest-craft")
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        restaurantId: "rest-craft",
        updatedAt: Date.now(),
        items: [mockCartItemA], // Price was 25000, quantity 2 = total 50000
      })
    )

    // Product price changed to 30000
    const productAPriceUpdated = { ...mockProductA, price: 30000 }
    const onPriceUpdated = vi.fn()

    const { result } = renderHook(() =>
      useCart({
        restaurantId: "rest-craft",
        products: [productAPriceUpdated],
        onPriceUpdated,
      })
    )

    expect(onPriceUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Hamburguesa Clásica" }),
      25000,
      30000
    )
    expect(result.current.cartItems).toHaveLength(1)
    expect(result.current.cartItems[0].price).toBe(30000)
    expect(result.current.cartItems[0].total).toBe(60000)
  })

  it("clears cart and removes it from localStorage when clearCart is called", () => {
    const { result } = renderHook(() =>
      useCart({ restaurantId: "rest-craft", products: [mockProductA] })
    )

    act(() => {
      result.current.addToCart(mockCartItemA)
    })
    expect(result.current.cartItems).toHaveLength(1)

    act(() => {
      result.current.clearCart()
    })
    expect(result.current.cartItems).toHaveLength(0)
    expect(localStorage.getItem(getCartStorageKey("rest-craft"))).toBeNull()
  })
})
