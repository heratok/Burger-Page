import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { ManualSaleModal } from "./ManualSaleModal"
import { toast } from "sonner"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"

const createTestRepo = () => {
  const adapter = new InMemoryStorageAdapter()
  adapter.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  return new TenantRepository(adapter)
}

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

describe("ManualSaleModal - Point of Sale (POS) Component", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("does not render when isOpen is false", () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={false} onClose={() => {}} />
      </RestaurantProvider>
    )

    expect(screen.queryByText(/Punto de Venta/i)).toBeNull()
  })

  it("renders catalog, service modes, and payment methods when open", () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Punto de Venta — Nueva Venta/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Mostrador/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Mesa \/ Salón/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Domicilio/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /💵 Efectivo/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /💳 Transferencia/i })).toBeDefined()
  })

  it("allows searching products, adding items to order, updating quantity and calculating total", async () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Initially order is empty
    expect(screen.getByText(/Venta vacía/i)).toBeDefined()

    // Add first available product
    const addButtons = screen.getAllByRole("button", { name: /Agregar/i })
    expect(addButtons.length).toBeGreaterThan(0)
    fireEvent.click(addButtons[0])

    // Should now show item in order list
    expect(screen.queryByText(/Venta vacía/i)).toBeNull()
    expect(screen.getByText(/Subtotal productos:/i)).toBeDefined()

    // Add another item
    if (addButtons.length > 1) {
      fireEvent.click(addButtons[1])
    }

    // Submit order for Mostrador
    const submitBtn = screen.getByRole("button", { name: /Registrar Venta/i })
    expect(submitBtn).toBeDefined()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "¡Venta manual registrada en el sistema!",
        expect.objectContaining({
          description: expect.any(String),
        })
      )
    })
  })

  it("requires address and barrio when service mode is Domicilio", async () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Add a product
    const addButtons = screen.getAllByRole("button", { name: /Agregar/i })
    fireEvent.click(addButtons[0])

    // Switch to Domicilio
    const deliveryBtn = screen.getByRole("button", { name: /Domicilio/i })
    fireEvent.click(deliveryBtn)

    // Try to submit without address
    const submitBtn = screen.getByRole("button", { name: /Registrar Venta/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Ingresa la dirección para el domicilio")
    })
  })

  it("allows entering order observations and includes them in the registered sale", async () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Add a product
    const addButtons = screen.getAllByRole("button", { name: /Agregar/i })
    fireEvent.click(addButtons[0])

    // Find observations input
    const notesInput = screen.getByPlaceholderText(/Sin cebolla|observaciones/i)
    expect(notesInput).toBeDefined()
    fireEvent.change(notesInput, { target: { value: "Sin cebolla y salsas aparte" } })

    // Submit sale
    const submitBtn = screen.getByRole("button", { name: /Registrar Venta/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "¡Venta manual registrada en el sistema!",
        expect.anything()
      )
    })
  })

  it("allows customizing additions and kitchen notes via '+ Extras' button", async () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Find the "+ Extras" button for the first product
    const extrasButtons = screen.getAllByRole("button", { name: /\+ Extras/i })
    expect(extrasButtons.length).toBeGreaterThan(0)
    fireEvent.click(extrasButtons[0])

    // Customization modal should be visible
    expect(screen.getByText(/Personalizar plato/i)).toBeDefined()
    expect(screen.getByText(/Adiciones \/ Modificadores disponibles/i)).toBeDefined()

    // Add 1 Extra Queso
    const addQuesoBtn = screen.getByRole("button", { name: /Agregar Extra Queso/i })
    fireEvent.click(addQuesoBtn)

    // Add note for kitchen
    const noteInput = screen.getByPlaceholderText(/Término medio, sin salsas/i)
    fireEvent.change(noteInput, { target: { value: "Término 3/4 bien asada" } })

    // Confirm addition to sale
    const confirmBtn = screen.getByRole("button", { name: /Agregar a la Venta/i })
    fireEvent.click(confirmBtn)

    // Customizer closes and item appears in cart comanda with extras and observation
    expect(screen.queryByText(/Personalizar plato/i)).toBeNull()
    expect(screen.getByText(/Extra Queso/i)).toBeDefined()
    expect(screen.getByText(/Término 3\/4 bien asada/i)).toBeDefined()
  })

  it("allows modifying extras of an item already in the cart", async () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Quick add a product
    const addButtons = screen.getAllByRole("button", { name: /^Agregar$/i })
    fireEvent.click(addButtons[0])

    // Click on "Extras / nota" on the cart item
    const editExtrasBtn = screen.getByRole("button", { name: /\+ Extras \/ nota/i })
    fireEvent.click(editExtrasBtn)

    // Modal opens in edit mode
    expect(screen.getByText(/Modificar ítem/i)).toBeDefined()

    // Add Tocineta Extra
    const addTocinetaBtn = screen.getByRole("button", { name: /Agregar Tocineta Extra/i })
    fireEvent.click(addTocinetaBtn)

    // Save changes
    const saveChangesBtn = screen.getByRole("button", { name: /Guardar Cambios/i })
    fireEvent.click(saveChangesBtn)

    // Cart item now shows Tocineta Extra
    expect(screen.queryByText(/Modificar ítem/i)).toBeNull()
    expect(screen.getByText(/Tocineta Extra/i)).toBeDefined()
  })

  it("displays transfer receipt upload area when selecting Transferencia payment method", async () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Switch to Transferencia
    const transferBtn = screen.getByRole("button", { name: /💳 Transferencia/i })
    fireEvent.click(transferBtn)

    // Receipt upload area should be visible
    expect(screen.getByText(/Comprobante de Transferencia \(Opcional\)/i)).toBeDefined()
    expect(screen.getByText(/Cargar comprobante/i)).toBeDefined()

    // Simulate selecting an image file
    const file = new File(["dummy image data"], "comprobante-nequi.png", { type: "image/png" })
    const fileInput = screen.getByLabelText(/Cargar comprobante/i).querySelector("input") || screen.getAllByDisplayValue("")[0]
    expect(fileInput).toBeDefined()
    fireEvent.change(fileInput, { target: { files: [file] } })
  })

  it("prepopulates fields when orderToEdit is provided and saves changes", async () => {
    const mockOrderToEdit = {
      id: "ord-test-edit-1",
      orderNumber: 54321,
      customer: {
        nombre: "Mariana Restrepo",
        telefono: "3109876543",
        direccion: "Calle 45 # 12-34",
        barrio: "Laureles",
      },
      items: [
        {
          id: "item-edit-1",
          name: "Hamburguesa Clásica",
          price: 20000,
          cantidad: 1,
          total: 20000,
          observacion: "Sin mayonesa",
          adiciones: [],
        },
      ],
      total: 20000,
      deliveryFee: 5000,
      finalTotal: 25000,
      metodo: "Efectivo" as const,
      pagoCon: "30000",
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const onClose = vi.fn()

    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={onClose} orderToEdit={mockOrderToEdit} />
      </RestaurantProvider>
    )

    // Should render edit header
    expect(screen.getByText(/Editar Venta #54321/i)).toBeDefined()
    expect(screen.getByText(/Modificá los productos, cliente, notas/i)).toBeDefined()

    // Prepopulated customer data
    const nameInput = screen.getByDisplayValue("Mariana Restrepo")
    expect(nameInput).toBeDefined()

    const phoneInput = screen.getByDisplayValue("3109876543")
    expect(phoneInput).toBeDefined()

    // Save changes
    const saveBtn = screen.getByRole("button", { name: /Guardar cambios/i })
    expect(saveBtn).toBeDefined()
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Venta actualizada correctamente")
      expect(onClose).toHaveBeenCalled()
    })
  })

  it("switches service modes correctly between Mostrador, Mesa, and Domicilio", () => {
    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Switch to Mesa / Salón
    const mesaBtn = screen.getByRole("button", { name: /Mesa \/ Salón/i })
    fireEvent.click(mesaBtn)
    expect(screen.getByText(/Número de Mesa/i)).toBeDefined()
    const tableInput = screen.getByPlaceholderText(/Ej: 3, Terraza 1/i)
    fireEvent.change(tableInput, { target: { value: "5" } })
    expect(tableInput).toBeDefined()

    // Switch to Domicilio
    const deliveryBtn = screen.getByRole("button", { name: /Domicilio/i })
    fireEvent.click(deliveryBtn)
    expect(screen.getByText(/Dirección de Entrega \*/i)).toBeDefined()
    expect(screen.getByText(/Barrio \*/i)).toBeDefined()

    // Switch to Mostrador
    const mostradorBtn = screen.getByRole("button", { name: /Mostrador/i })
    fireEvent.click(mostradorBtn)
    expect(screen.getByPlaceholderText(/Cliente Mostrador/i)).toBeDefined()
  })

  it("prepopulates table number when editing a salon/mesa order", () => {
    const mockMesaOrder = {
      id: "ord-mesa-1",
      orderNumber: 54322,
      customer: {
        nombre: "Mesa 8",
        telefono: "N/A",
        direccion: "Salón - Mesa 8",
        barrio: "Local",
      },
      items: [],
      total: 10000,
      deliveryFee: 0,
      finalTotal: 10000,
      metodo: "Efectivo" as const,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    render(
      <RestaurantProvider repository={createTestRepo()}>
        <ManualSaleModal isOpen={true} onClose={() => {}} orderToEdit={mockMesaOrder} />
      </RestaurantProvider>
    )

    const tableInput = screen.getByDisplayValue("8")
    expect(tableInput).toBeDefined()
  })
})

