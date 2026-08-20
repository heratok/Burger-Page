import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import Form from "./Form"
import type { BurgerCompra } from "@/data/data"

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

const noop = () => {}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText("Tu nombre"), {
    target: { value: "Juan" },
  })
  fireEvent.change(screen.getByPlaceholderText("3001234567"), {
    target: { value: "3001234567" },
  })
  fireEvent.change(screen.getByPlaceholderText("Calle 123 #45-67"), {
    target: { value: "Calle 123" },
  })
  fireEvent.change(screen.getByPlaceholderText("Tu barrio"), {
    target: { value: "Centro" },
  })
}

describe("Form — onOrderSent (CART-4/CART-5)", () => {
  beforeEach(() => {
    vi.spyOn(window, "open").mockImplementation(() => null)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("llama onOrderSent exactamente una vez al enviar por WhatsApp (CART-5)", async () => {
    const onOrderSent = vi.fn()
    render(
      <Form
        cerrar={noop}
        cerrarForm={noop}
        mostrar={noop}
        hamburguesas={[burger]}
        onOrderSent={onOrderSent}
      />
    )
    fillRequiredFields()
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Enviar pedido por WhatsApp/ })
      )
    })
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(onOrderSent).toHaveBeenCalledTimes(1)
  })

  it("no llama onOrderSent al volver sin enviar (CART-5)", () => {
    const onOrderSent = vi.fn()
    render(
      <Form
        cerrar={noop}
        cerrarForm={noop}
        mostrar={noop}
        hamburguesas={[burger]}
        onOrderSent={onOrderSent}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /Volver/ }))
    expect(onOrderSent).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })
})
