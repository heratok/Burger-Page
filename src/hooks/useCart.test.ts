import { describe, expect, it, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCart } from "./useCart"
import { CART_DRAFT_KEY, CART_DRAFT_VERSION } from "@/lib/draft"
import type { BurgerCompra } from "@/data/data"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const sampleBurger: BurgerCompra = {
  adicion: [
    { name: "Extra queso", price: 2700, cantidad: 1, src: "https://img/queso" },
  ],
  name: "Misisipi",
  src: "https://img/misisipi",
  totalapagar: 29700,
  cantidad: 1,
  observacion: "Bien cocida",
}

const sampleBurger2: BurgerCompra = {
  adicion: [],
  name: "La Pollo",
  src: "https://img/pollo",
  totalapagar: 22900,
  cantidad: 1,
  observacion: "",
}

describe("useCart hook", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it("inicializa vacío sin borrador guardado", () => {
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
    expect(result.current.itemCount).toBe(0)
    expect(result.current.total).toBe(0)
    expect(result.current.showRecovery).toBe(false)
  })

  it("inicializa con items y showRecovery cuando existe un borrador", () => {
    window.localStorage.setItem(
      CART_DRAFT_KEY,
      JSON.stringify({ version: CART_DRAFT_VERSION, items: [sampleBurger] })
    )
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([sampleBurger])
    expect(result.current.itemCount).toBe(1)
    expect(result.current.total).toBe(29700)
    expect(result.current.showRecovery).toBe(true)
  })

  it("permite agregar items y actualiza el total y la persistencia", () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addItem(sampleBurger)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.total).toBe(29700)
    expect(window.localStorage.getItem(CART_DRAFT_KEY)).toContain("Misisipi")

    act(() => {
      result.current.addItem(sampleBurger2)
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.total).toBe(29700 + 22900)
  })

  it("permite editar un item existente", () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addItem(sampleBurger)
    })

    act(() => {
      result.current.startEditing(0)
    })

    expect(result.current.editingIndex).toBe(0)
    expect(result.current.editingItem).toEqual(sampleBurger)

    const updatedBurger = { ...sampleBurger, totalapagar: 35000, observacion: "Modificado" }

    act(() => {
      result.current.addItem(updatedBurger)
    })

    expect(result.current.editingIndex).toBeNull()
    expect(result.current.items[0].observacion).toBe("Modificado")
    expect(result.current.total).toBe(35000)
  })

  it("permite eliminar items", () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addItem(sampleBurger)
      result.current.addItem(sampleBurger2)
    })

    expect(result.current.items).toHaveLength(2)

    act(() => {
      result.current.removeItem(0)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].name).toBe("La Pollo")
  })

  it("permite descartar el borrador y limpiar el carrito", () => {
    window.localStorage.setItem(
      CART_DRAFT_KEY,
      JSON.stringify({ version: CART_DRAFT_VERSION, items: [sampleBurger] })
    )
    const { result } = renderHook(() => useCart())

    expect(result.current.showRecovery).toBe(true)

    act(() => {
      result.current.discardDraft()
    })

    expect(result.current.items).toEqual([])
    expect(result.current.showRecovery).toBe(false)
    expect(window.localStorage.getItem(CART_DRAFT_KEY)).toBeNull()
  })

  it("permite dismissRecovery manteniendo los items", () => {
    window.localStorage.setItem(
      CART_DRAFT_KEY,
      JSON.stringify({ version: CART_DRAFT_VERSION, items: [sampleBurger] })
    )
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.dismissRecovery()
    })

    expect(result.current.showRecovery).toBe(false)
    expect(result.current.items).toHaveLength(1)
  })
})
