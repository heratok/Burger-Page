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

describe("Form — validación de pago en efectivo", () => {
  beforeEach(() => {
    vi.spyOn(window, "open").mockImplementation(() => null)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("muestra error y deshabilita envío si el monto ingresado es menor al total", async () => {
    render(
      <Form
        cerrar={noop}
        cerrarForm={noop}
        mostrar={noop}
        hamburguesas={[burger]} // total: 29000
      />
    )

    const pagoInput = screen.getByPlaceholderText("50000")
    fireEvent.change(pagoInput, { target: { value: "15000" } })

    expect(
      screen.getByText(/debe cubrir el total de la orden/)
    ).toBeTruthy()

    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/ }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })

  it("muestra mensaje de pago exacto cuando el monto es igual al total", async () => {
    render(
      <Form
        cerrar={noop}
        cerrarForm={noop}
        mostrar={noop}
        hamburguesas={[burger]} // total: 29000
      />
    )

    const pagoInput = screen.getByPlaceholderText("50000")
    fireEvent.change(pagoInput, { target: { value: "29000" } })

    expect(
      screen.getByText(/Pago exacto \(no requieres cambio\)/)
    ).toBeTruthy()

    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/ }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })

  it("calcula y muestra el cambio cuando el monto supera el total", async () => {
    render(
      <Form
        cerrar={noop}
        cerrarForm={noop}
        mostrar={noop}
        hamburguesas={[burger]} // total: 29000
      />
    )

    const pagoInput = screen.getByPlaceholderText("50000")
    fireEvent.change(pagoInput, { target: { value: "50000" } })

    expect(screen.getByText(/Tu cambio:/)).toBeTruthy()
    expect(screen.getByText(/\$21.000/)).toBeTruthy()

    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/ }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })
})

