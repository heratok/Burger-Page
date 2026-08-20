import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import Home from "./Home"
import { CART_DRAFT_KEY, CART_DRAFT_VERSION } from "@/lib/draft"
import type { BurgerCompra } from "@/data/data"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const burger: BurgerCompra = {
  adicion: [
    { name: "Queso extra", price: 2000, cantidad: 1, src: "https://img/queso" },
  ],
  name: "Misisipi",
  src: "https://img/misisipi",
  totalapagar: 29000,
  cantidad: 1,
  observacion: "sin cebolla",
}

function seedDraft() {
  window.localStorage.setItem(
    CART_DRAFT_KEY,
    JSON.stringify({ version: CART_DRAFT_VERSION, items: [burger] })
  )
}

function recoveryTitle() {
  return screen.queryByRole("heading", { name: "Recuperar tu carrito" })
}

describe("Home — recuperación de carrito (CART-3)", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("muestra el diálogo con Continuar/Descartar cuando hay un borrador válido", () => {
    seedDraft()
    render(<Home />)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(recoveryTitle()).toBeTruthy()
    expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Descartar" })).toBeTruthy()
  })

  it("no muestra el diálogo cuando no hay borrador válido", () => {
    render(<Home />)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(recoveryTitle()).toBeNull()
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Descartar" })).toBeNull()
  })
})

describe("Home — acciones del diálogo", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("Continuar restaura el carrito y cierra el diálogo (CART-1)", () => {
    seedDraft()
    render(<Home />)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(recoveryTitle()).toBeNull()
    // El carrito se rehidrata con 1 producto (header + barra móvil lo reflejan).
    expect(
      screen.getAllByRole("button", { name: /Ver orden, 1 producto/ })
    ).toHaveLength(2)
  })

  it("Descartar limpia el borrador y deja el carrito vacío (CART-3)", () => {
    seedDraft()
    render(<Home />)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }))
    expect(recoveryTitle()).toBeNull()
    expect(window.localStorage.getItem(CART_DRAFT_KEY)).toBeNull()
    expect(
      screen.queryByRole("button", { name: /Ver orden, 1 producto/ })
    ).toBeNull()
  })
})

describe("Home — sin envío explícito (CART-5)", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("recargar sin enviar conserva el borrador y muestra la recuperación (CART-5)", () => {
    seedDraft()
    render(<Home />)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    // No se hizo ningún envío: el borrador sigue intacto y se ofrece continuar.
    expect(window.localStorage.getItem(CART_DRAFT_KEY)).not.toBeNull()
    expect(recoveryTitle()).toBeTruthy()
  })

  it("un borrador ya limpiado evita el doble envío: sin diálogo ni carrito (CART-5)", () => {
    // El envío explícito ya limpió el borrador → al recargar no se restaura nada.
    render(<Home />)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(recoveryTitle()).toBeNull()
    expect(
      screen.queryByRole("button", { name: /Ver orden, 1 producto/ })
    ).toBeNull()
  })
})
