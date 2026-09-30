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

  describe("renaming a category", () => {
    const setup = () => {
      const onUpdateCategory = vi.fn()
      render(
        <CategoryModal
          isOpen={true}
          categories={["Hamburguesas", "Bebidas"]}
          products={[]}
          onClose={vi.fn()}
          onAddCategory={vi.fn()}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={vi.fn()}
        />
      )
      fireEvent.click(screen.getAllByTitle("Renombrar categoría")[0])
      const input = screen.getByDisplayValue("Hamburguesas")
      return { input, onUpdateCategory }
    }

    it("saves on Enter exactly once, same as the Guardar button", () => {
      const { input, onUpdateCategory } = setup()
      fireEvent.change(input, { target: { value: "Burgers" } })
      fireEvent.keyDown(input, { key: "Enter" })

      expect(onUpdateCategory).toHaveBeenCalledTimes(1)
      expect(onUpdateCategory).toHaveBeenCalledWith("Hamburguesas", "Burgers")
      expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull()
    })

    it("still saves with the Guardar button", () => {
      const { input, onUpdateCategory } = setup()
      fireEvent.change(input, { target: { value: "Burgers" } })
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
      expect(onUpdateCategory).toHaveBeenCalledTimes(1)
      expect(onUpdateCategory).toHaveBeenCalledWith("Hamburguesas", "Burgers")
    })

    it("cancels on Escape without saving", () => {
      const { input, onUpdateCategory } = setup()
      fireEvent.change(input, { target: { value: "Burgers" } })
      fireEvent.keyDown(input, { key: "Escape" })

      expect(onUpdateCategory).not.toHaveBeenCalled()
      expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull()
      expect(screen.getByText("Hamburguesas")).toBeDefined()
    })
  })
})
