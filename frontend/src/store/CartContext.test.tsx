import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { CartProvider } from "./CartContext"
import { useCart } from "./cart-context"
import type { CartItem } from "@/lib/domain"

afterEach(() => {
  cleanup()
})

function makeItem(id: string, total: number): CartItem {
  return {
    id,
    productId: id,
    name: `Item ${id}`,
    src: "",
    unitPrice: total,
    cantidad: 1,
    modifiers: [],
    observacion: "",
    total,
  }
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
)

describe("useCart", () => {
  it("starts empty with a zero total", () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    expect(result.current.items).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it("adds items and totals their prices", () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(makeItem("a", 27000)))
    act(() => result.current.addItem(makeItem("b", 5000)))
    expect(result.current.items).toHaveLength(2)
    expect(result.current.total).toBe(32000)
  })

  it("updates an item at a given index and recalculates the total", () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(makeItem("a", 1000)))
    act(() => result.current.addItem(makeItem("b", 2000)))
    act(() => result.current.updateItem(1, makeItem("b", 9000)))
    expect(result.current.items[1].total).toBe(9000)
    expect(result.current.total).toBe(10000)
  })

  it("removes an item at a given index and recalculates the total", () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(makeItem("a", 1000)))
    act(() => result.current.addItem(makeItem("b", 2000)))
    act(() => result.current.addItem(makeItem("c", 3000)))
    act(() => result.current.removeItem(1))
    expect(result.current.items.map((i) => i.id)).toEqual(["a", "c"])
    expect(result.current.total).toBe(4000)
  })

  it("clears all items", () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(makeItem("a", 1000)))
    act(() => result.current.addItem(makeItem("b", 2000)))
    act(() => result.current.clear())
    expect(result.current.items).toEqual([])
    expect(result.current.total).toBe(0)
  })
})

describe("useCart scope isolation (RD-2)", () => {
  it("keeps items when the scope does not change", () => {
    let scope = "pizza-roma"
    const { result, rerender } = renderHook(() => useCart(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <CartProvider scope={scope}>{children}</CartProvider>
      ),
    })
    act(() => result.current.addItem(makeItem("a", 27000)))
    rerender()
    expect(result.current.items).toHaveLength(1)
    expect(result.current.total).toBe(27000)
  })

  it("clears items when the scope changes to another restaurant", () => {
    let scope = "pizza-roma"
    const { result, rerender } = renderHook(() => useCart(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <CartProvider scope={scope}>{children}</CartProvider>
      ),
    })
    act(() => result.current.addItem(makeItem("a", 27000)))
    act(() => result.current.addItem(makeItem("b", 5000)))
    scope = "sushi-tokio"
    rerender()
    expect(result.current.items).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it("clears items when leaving the restaurant scope", () => {
    let scope = "pizza-roma"
    const { result, rerender } = renderHook(() => useCart(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <CartProvider scope={scope}>{children}</CartProvider>
      ),
    })
    act(() => result.current.addItem(makeItem("a", 27000)))
    scope = undefined
    rerender()
    expect(result.current.items).toEqual([])
    expect(result.current.total).toBe(0)
  })
})