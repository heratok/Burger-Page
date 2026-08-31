import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { ProductModal } from "./ProductModal"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

describe("ProductModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ProductModal
        isOpen={false}
        editingProduct={null}
        categories={["Hamburguesas", "Bebidas"]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders new product form and validates required fields", async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(
      <ProductModal
        isOpen={true}
        editingProduct={null}
        categories={["Hamburguesas", "Bebidas"]}
        onClose={onClose}
        onSave={onSave}
      />
    )

    expect(screen.getByText("Nuevo Producto")).toBeDefined()

    const nameInput = screen.getByPlaceholderText(/Plato Especial/i)
    fireEvent.change(nameInput, { target: { value: "   " } })

    const submitBtn = screen.getByRole("button", { name: /Guardar en Menú/i })
    fireEvent.submit(submitBtn.closest("form") || submitBtn)

    expect(toast.error).toHaveBeenCalledWith("El nombre del producto no puede estar vacío")
    expect(onSave).not.toHaveBeenCalled()
  })

  it("submits valid product form with correct payload", async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(
      <ProductModal
        isOpen={true}
        editingProduct={null}
        categories={["Hamburguesas", "Bebidas"]}
        onClose={onClose}
        onSave={onSave}
      />
    )

    const nameInput = screen.getByPlaceholderText(/Plato Especial/i)
    fireEvent.change(nameInput, { target: { value: "Super Burger" } })

    const submitBtn = screen.getByRole("button", { name: /Guardar en Menú/i })
    fireEvent.submit(submitBtn.closest("form") || submitBtn)

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Super Burger",
        price: 26000,
        category: "Hamburguesas",
      })
    )
  })
})
