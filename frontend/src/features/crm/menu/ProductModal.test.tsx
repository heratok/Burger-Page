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

  it("validates file size when uploading an image larger than 10MB", async () => {
    const { container } = render(
      <ProductModal
        isOpen={true}
        editingProduct={null}
        categories={["Hamburguesas"]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).not.toBeNull()

    const oversizedBlob = new Blob(["a".repeat(1024 * 1024 * 11)], { type: "image/jpeg" })
    const oversizedFile = new File([oversizedBlob], "huge.jpg", { type: "image/jpeg" })

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } })

    expect(toast.error).toHaveBeenCalledWith("La imagen original debe ser menor a 10MB")
  })

  it("validates unsupported file formats", async () => {
    const { container } = render(
      <ProductModal
        isOpen={true}
        editingProduct={null}
        categories={["Hamburguesas"]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).not.toBeNull()

    const pdfBlob = new Blob(["fake pdf"], { type: "application/pdf" })
    const pdfFile = new File([pdfBlob], "document.pdf", { type: "application/pdf" })

    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    expect(toast.error).toHaveBeenCalledWith(
      "Formato no compatible. Por favor sube una imagen JPG, PNG, WebP o AVIF."
    )
  })
})
