import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { AdditionModal } from "./AdditionModal"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

describe("AdditionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <AdditionModal
        isOpen={false}
        editingAddition={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("validates empty name on submission", () => {
    const onSave = vi.fn()
    render(
      <AdditionModal
        isOpen={true}
        editingAddition={null}
        onClose={vi.fn()}
        onSave={onSave}
      />
    )

    const nameInput = screen.getByPlaceholderText(/Tocineta ahumada extra/i)
    fireEvent.change(nameInput, { target: { value: "   " } })

    const saveBtn = screen.getByRole("button", { name: /^Guardar$/i })
    fireEvent.submit(saveBtn.closest("form") || saveBtn)

    expect(toast.error).toHaveBeenCalledWith("El nombre del adicional no puede estar vacío")
    expect(onSave).not.toHaveBeenCalled()
  })

  it("submits valid addition data", () => {
    const onSave = vi.fn()
    render(
      <AdditionModal
        isOpen={true}
        editingAddition={null}
        onClose={vi.fn()}
        onSave={onSave}
      />
    )

    const nameInput = screen.getByPlaceholderText(/Tocineta ahumada extra/i)
    fireEvent.change(nameInput, { target: { value: "Salsa BBQ Especial" } })

    const saveBtn = screen.getByRole("button", { name: /^Guardar$/i })
    fireEvent.submit(saveBtn.closest("form") || saveBtn)

    expect(onSave).toHaveBeenCalledWith({
      name: "Salsa BBQ Especial",
      price: 3000,
      available: true,
    })
  })
})
