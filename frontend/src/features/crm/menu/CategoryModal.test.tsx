import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { CategoryModal } from "./CategoryModal"

describe("CategoryModal", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders active categories and allows adding a new category", () => {
    const onAddCategory = vi.fn()
    const onUpdateCategory = vi.fn()
    const onDeleteCategory = vi.fn()
    const onClose = vi.fn()

    render(
      <CategoryModal
        isOpen={true}
        categories={["Hamburguesas", "Bebidas"]}
        products={[]}
        onClose={onClose}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
      />
    )

    expect(screen.getByText("Gestionar Categorías del Menú")).toBeDefined()
    expect(screen.getByText("Hamburguesas")).toBeDefined()
    expect(screen.getByText("Bebidas")).toBeDefined()

    const input = screen.getByPlaceholderText(/Nueva categoría/i)
    fireEvent.change(input, { target: { value: "Postres" } })

    const addBtn = screen.getByRole("button", { name: /Agregar/i })
    fireEvent.click(addBtn)

    expect(onAddCategory).toHaveBeenCalledWith("Postres")
  })
})
