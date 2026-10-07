import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import type { Customer } from "@/types/restaurant"
import { CustomerCRM } from "./CustomerCRM"

const updateCustomer = vi.fn()
const deleteCustomer = vi.fn()
const createCustomer = vi.fn()

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

const mockCan = vi.fn().mockReturnValue(true)

vi.mock("@/context/RestaurantContext", () => ({
  useRestaurant: () => ({
    customers,
    orders: [],
    createCustomer,
    updateCustomer,
    deleteCustomer,
    storeConfig: { name: "Burger" },
    adminTheme: "light",
    isLoadingOrders: false,
    can: mockCan,
  }),
  useAuth: () => ({
    can: mockCan,
  }),
}))

describe("CustomerCRM edit and delete", () => {
  beforeEach(() => {
    mockCan.mockReturnValue(true)
    createCustomer.mockReset().mockResolvedValue({
      id: "cust-new",
      nombre: "Nuevo Cliente",
      telefono: "3001234567",
      direccion: "",
      barrio: "",
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: new Date().toISOString(),
      loyaltyTier: "bronze",
    })
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

  describe("Financial metrics gating (finance.view)", () => {
    it("displays financial metrics and customer spend when user has finance.view", () => {
      mockCan.mockImplementation((perm: string) => perm === "finance.view")
      render(<CustomerCRM />)

      // Top metric card
      expect(screen.getByText("Gasto Acumulado")).toBeDefined()
      // Table column header
      expect(screen.getByText("Gasto Total")).toBeDefined()
      // Formatted values ($84.000 in top card and table)
      expect(screen.getAllByText(/\$?\s*84\.000/).length).toBeGreaterThanOrEqual(1)

      // Customer details modal
      fireEvent.click(screen.getByTitle("Ficha del cliente"))
      expect(screen.getByText("Inversión Total")).toBeDefined()
    })

    it("hides financial metrics and customer spend when user lacks finance.view", () => {
      mockCan.mockReturnValue(false) // lacks finance.view
      render(<CustomerCRM />)

      // Top metric card must NOT be displayed
      expect(screen.queryByText("Gasto Acumulado")).toBeNull()
      // Table column header must NOT be displayed
      expect(screen.queryByText("Gasto Total")).toBeNull()
      // Formatted customer spend must NOT be displayed
      expect(screen.queryByText(/\$?\s*84\.000/)).toBeNull()

      // Customer details modal must NOT show total investment
      fireEvent.click(screen.getByTitle("Ficha del cliente"))
      expect(screen.queryByText("Inversión Total")).toBeNull()
      // But non-financial stats like Total Pedidos must remain
      expect(screen.getAllByText("Total Pedidos").length).toBeGreaterThan(0)
    })
  })

  describe("Customer mutation gating (customers.manage)", () => {
    it("hides edit and delete row buttons when user lacks customers.manage permission", () => {
      mockCan.mockImplementation((perm: string) => perm === "customers.view")
      render(<CustomerCRM />)

      // Row edit and delete buttons must be hidden
      expect(screen.queryByTitle("Editar cliente")).toBeNull()
      expect(screen.queryByLabelText("Editar Santiago Restrepo")).toBeNull()
      expect(screen.queryByTitle("Eliminar cliente")).toBeNull()
      expect(screen.queryByLabelText("Eliminar Santiago Restrepo")).toBeNull()

      // Chat and profile buttons stay visible
      expect(screen.getByTitle("Contactar por WhatsApp")).toBeDefined()
      expect(screen.getByTitle("Ficha del cliente")).toBeDefined()
    })

    it("hides Editar datos, Eliminar cliente, Guardar Notas and disables notes in details modal for read-only users", () => {
      mockCan.mockImplementation((perm: string) => perm === "customers.view")
      render(<CustomerCRM />)

      // Open customer modal
      fireEvent.click(screen.getByTitle("Ficha del cliente"))

      // Modal mutation buttons must be hidden
      expect(screen.queryByRole("button", { name: "Editar datos" })).toBeNull()
      expect(screen.queryByRole("button", { name: "Eliminar cliente" })).toBeNull()
      expect(screen.queryByRole("button", { name: "Guardar Notas" })).toBeNull()

      // Notes textarea must be read-only or disabled
      const notesArea = screen.getByDisplayValue("Sin cebolla") as HTMLTextAreaElement
      expect(notesArea.disabled || notesArea.readOnly).toBe(true)

      // Customer details and order history remain visible
      expect(screen.getByRole("heading", { name: "Santiago Restrepo" })).toBeDefined()
      expect(screen.getByText(/Celular: 3109876543/)).toBeDefined()
      expect(screen.getByText(/Historial de Pedidos Registrados/)).toBeDefined()
    })
  })

  describe("Customer creation (customers.manage)", () => {
    it("shows '+ Nuevo cliente' button only when user has customers.manage permission", () => {
      mockCan.mockImplementation((perm: string) => perm === "customers.manage")
      render(<CustomerCRM />)
      expect(screen.getByRole("button", { name: /Nuevo cliente/i })).toBeDefined()
    })

    it("hides '+ Nuevo cliente' button when user lacks customers.manage permission", () => {
      mockCan.mockImplementation((perm: string) => perm === "customers.view")
      render(<CustomerCRM />)
      expect(screen.queryByRole("button", { name: /Nuevo cliente/i })).toBeNull()
    })

    it("opens create modal and requires name and phone fields with clean error states", async () => {
      render(<CustomerCRM />)
      fireEvent.click(screen.getByRole("button", { name: /Nuevo cliente/i }))

      expect(screen.getByText("Nuevo Cliente")).toBeDefined()

      // Attempt submit without filling required fields
      fireEvent.click(screen.getByRole("button", { name: /Registrar cliente/i }))

      expect(createCustomer).not.toHaveBeenCalled()
      expect(screen.getByText(/El nombre es obligatorio/i)).toBeDefined()
      expect(screen.getByText(/El teléfono es obligatorio/i)).toBeDefined()
    })

    it("submits valid customer data, calls createCustomer, and closes modal", async () => {
      render(<CustomerCRM />)
      fireEvent.click(screen.getByRole("button", { name: /Nuevo cliente/i }))

      fireEvent.change(screen.getByLabelText(/Nombre \*/i), { target: { value: "Mariana Rios" } })
      fireEvent.change(screen.getByLabelText(/Teléfono \*/i), { target: { value: "3209871234" } })
      fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Calle 45 # 12-34" } })
      fireEvent.change(screen.getByLabelText("Barrio"), { target: { value: "Poblado" } })
      fireEvent.change(screen.getByLabelText(/Correo|Email/i), { target: { value: "mariana@example.com" } })
      fireEvent.change(screen.getByLabelText(/Notas/i), { target: { value: "Prefiere hamburguesas sin salsa" } })

      fireEvent.click(screen.getByRole("button", { name: /Registrar cliente/i }))

      await waitFor(() => expect(createCustomer).toHaveBeenCalledTimes(1))
      expect(createCustomer).toHaveBeenCalledWith({
        name: "Mariana Rios",
        phone: "3209871234",
        address: "Calle 45 # 12-34",
        barrio: "Poblado",
        email: "mariana@example.com",
        notes: "Prefiere hamburguesas sin salsa",
      })

      // Modal closes after creation
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /Registrar cliente/i })).toBeNull()
      })
    })

    it("handles duplicate phone gracefully with feedback indicating existing customer upsert/merge", async () => {
      render(<CustomerCRM />)
      fireEvent.click(screen.getByRole("button", { name: /Nuevo cliente/i }))

      // Phone belongs to Santiago Restrepo (3109876543)
      fireEvent.change(screen.getByLabelText(/Nombre \*/i), { target: { value: "Santiago Restrepo Actualizado" } })
      fireEvent.change(screen.getByLabelText(/Teléfono \*/i), { target: { value: "3109876543" } })

      // Inline feedback indicating duplicate phone will update
      expect(screen.getByText(/Este teléfono ya está registrado/i)).toBeDefined()

      fireEvent.click(screen.getByRole("button", { name: /Registrar cliente/i }))

      await waitFor(() => expect(createCustomer).toHaveBeenCalledTimes(1))
      expect(createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Santiago Restrepo Actualizado",
          phone: "3109876543",
        })
      )
    })
  })
})

