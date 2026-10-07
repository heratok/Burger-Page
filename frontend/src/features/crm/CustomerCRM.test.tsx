import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import type { Customer } from "@/types/restaurant"
import { CustomerCRM } from "./CustomerCRM"

const updateCustomer = vi.fn()
const deleteCustomer = vi.fn()

const customers: Customer[] = [
  {
    id: "cust-1",
    nombre: "Santiago Restrepo",
    telefono: "3109876543",
    direccion: "Carrera 15 # 88-21",
    barrio: "Chico",
    totalOrders: 3,
    totalSpent: 84000,
    lastOrderDate: "2026-08-28T14:30:00.000Z",
    loyaltyTier: "silver",
    notes: "Sin cebolla",
  },
]

vi.mock("@/context/RestaurantContext", () => ({
  useRestaurant: () => ({
    customers,
    orders: [],
    updateCustomer,
    deleteCustomer,
    storeConfig: { name: "Burger" },
    adminTheme: "light",
    isLoadingOrders: false,
  }),
}))

describe("CustomerCRM edit and delete", () => {
  beforeEach(() => {
    updateCustomer.mockReset().mockResolvedValue(undefined)
    deleteCustomer.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it("edits the customer details from the modal", async () => {
    render(<CustomerCRM />)
    fireEvent.click(screen.getByTitle("Ficha del cliente"))

    fireEvent.click(screen.getByRole("button", { name: "Editar datos" }))
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Santiago R." } })
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "3000000000" } })
    fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Calle 1" } })
    fireEvent.change(screen.getByLabelText("Barrio"), { target: { value: "Centro" } })
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "a@b.co" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => expect(updateCustomer).toHaveBeenCalledTimes(1))
    expect(updateCustomer).toHaveBeenCalledWith("cust-1", {
      nombre: "Santiago R.",
      telefono: "3000000000",
      direccion: "Calle 1",
      barrio: "Centro",
      email: "a@b.co",
      notes: "Sin cebolla",
    })
  })

  it("does not save an edit with an empty name", () => {
    render(<CustomerCRM />)
    fireEvent.click(screen.getByTitle("Ficha del cliente"))
    fireEvent.click(screen.getByRole("button", { name: "Editar datos" }))
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  " } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))
    expect(updateCustomer).not.toHaveBeenCalled()
  })

  it("asks for confirmation before deleting from the table row", async () => {
    render(<CustomerCRM />)
    fireEvent.click(screen.getByTitle("Eliminar cliente"))

    expect(deleteCustomer).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: /Eliminar definitivamente/ }))

    await waitFor(() => expect(deleteCustomer).toHaveBeenCalledWith("cust-1"))
  })

  it("cancelling the confirmation keeps the customer", async () => {
    render(<CustomerCRM />)
    fireEvent.click(screen.getByTitle("Eliminar cliente"))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    expect(deleteCustomer).not.toHaveBeenCalled()
  })

  it("deletes from the modal after confirmation", async () => {
    render(<CustomerCRM />)
    fireEvent.click(screen.getByTitle("Ficha del cliente"))
    fireEvent.click(screen.getByRole("button", { name: "Eliminar cliente" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: /Eliminar definitivamente/ }))

    await waitFor(() => expect(deleteCustomer).toHaveBeenCalledWith("cust-1"))
  })
})
