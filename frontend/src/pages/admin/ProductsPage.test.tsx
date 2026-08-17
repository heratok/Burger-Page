import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type {
  Modifier,
  Order,
  Product,
  RestaurantConfig,
} from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"
import { initialProducts } from "@/data/data"
import ProductsPage from "./ProductsPage"

afterEach(() => {
  cleanup()
})

/** Mock repository per design contract (src/lib/repository.ts), in-memory state. */
function createMockRepo(products: Product[] = [...initialProducts]) {
  const state = { products: [...products] }
  const repo: RestaurantRepository = {
    getConfig: () => ({}) as RestaurantConfig,
    saveConfig: vi.fn(),
    getPalette: () => ({ accent: "#FF7A21", primary: "#FF7A21", background: "#0F1112", surface: "#181A1B" }),
    savePalette: vi.fn(),
    listProducts: () => state.products,
    saveProduct: vi.fn((product: Product) => {
      const index = state.products.findIndex((p) => p.id === product.id)
      if (index === -1) {
        state.products.push(product)
      } else {
        state.products[index] = product
      }
    }),
    deleteProduct: vi.fn((id: string) => {
      state.products = state.products.filter((p) => p.id !== id)
    }),
    listModifiers: () => [] as Modifier[],
    saveModifier: vi.fn(),
    deleteModifier: vi.fn(),
    listOrders: () => [] as Order[],
    saveOrder: vi.fn(),
    updateOrderStatus: vi.fn(),
  }
  return { repo, state }
}

describe("ProductsPage", () => {
  it("lista todos los productos sembrados con su precio en COP", () => {
    const { repo } = createMockRepo()
    render(<ProductsPage repo={repo} />)

    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
    for (const product of initialProducts) {
      expect(screen.getByText(product.name)).toBeTruthy()
    }
    // Misisipi y MegaBurger comparten precio ($27.000) → contar coincidencias.
    expect(screen.getAllByText("$27.000")).toHaveLength(2)
    expect(screen.getByText("$22.900")).toBeTruthy()
    expect(screen.getByText("$27.900")).toBeTruthy()
    expect(screen.getByText("$25.000")).toBeTruthy()
    expect(screen.getAllByRole("listitem")).toHaveLength(initialProducts.length)
  })

  it("oculta un producto al alternar su disponibilidad y persiste el cambio", () => {
    const { repo } = createMockRepo()
    render(<ProductsPage repo={repo} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Alternar disponibilidad de Misisipi" })
    )

    expect(repo.saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", name: "Misisipi", available: false })
    )
    expect(screen.getByText("Oculto")).toBeTruthy()
  })

  it("vuelve a mostrar un producto oculto al alternar de nuevo", () => {
    const hidden = initialProducts.map((p, i) =>
      i === 0 ? { ...p, available: false } : p
    )
    const { repo } = createMockRepo(hidden)
    render(<ProductsPage repo={repo} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Alternar disponibilidad de Misisipi" })
    )

    expect(repo.saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", available: true })
    )
    const row = screen.getByText("Misisipi").closest("li") as HTMLElement
    expect(within(row).getByText("Disponible")).toBeTruthy()
  })

  it("edita el precio de un producto y lo refleja en la lista", async () => {
    const { repo } = createMockRepo()
    render(<ProductsPage repo={repo} />)

    fireEvent.click(screen.getByRole("button", { name: "Editar Misisipi" }))

    const dialog = screen.getByRole("dialog")
    const priceInput = within(dialog).getByLabelText(/precio/i)
    fireEvent.change(priceInput, { target: { value: "28000" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }))

    await waitFor(() =>
      expect(repo.saveProduct).toHaveBeenCalledWith(
        expect.objectContaining({ id: "p1", price: 28000 })
      )
    )
    expect(screen.getByText("$28.000")).toBeTruthy()
  })

  it("elimina un producto tras confirmar y lo quita de la lista", () => {
    const { repo, state } = createMockRepo()
    render(<ProductsPage repo={repo} />)

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Misisipi" }))

    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText(/¿Eliminar «Misisipi»\?/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }))

    expect(repo.deleteProduct).toHaveBeenCalledWith("p1")
    expect(state.products.some((p) => p.id === "p1")).toBe(false)
    expect(screen.queryByText("Misisipi")).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(initialProducts.length - 1)
  })

  it("cancela la eliminación y conserva el producto", () => {
    const { repo } = createMockRepo()
    render(<ProductsPage repo={repo} />)

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Misisipi" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    expect(repo.deleteProduct).not.toHaveBeenCalled()
    expect(screen.getByText("Misisipi")).toBeTruthy()
  })

  it("crea un producto nuevo y lo agrega a la lista", async () => {
    const { repo, state } = createMockRepo()
    render(<ProductsPage repo={repo} />)

    fireEvent.click(screen.getByRole("button", { name: "Nuevo producto" }))

    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/nombre/i), {
      target: { value: "Test Burger" },
    })
    fireEvent.change(within(dialog).getByLabelText(/precio/i), {
      target: { value: "12345" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }))

    await waitFor(() =>
      expect(repo.saveProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Burger",
          price: 12345,
          available: true,
        })
      )
    )
    expect(state.products.some((p) => p.name === "Test Burger")).toBe(true)
    expect(screen.getByText("Test Burger")).toBeTruthy()
    expect(screen.getByText("$12.345")).toBeTruthy()
  })

  it("muestra errores de validación al guardar un producto inválido", async () => {
    const { repo } = createMockRepo()
    render(<ProductsPage repo={repo} />)

    fireEvent.click(screen.getByRole("button", { name: "Nuevo producto" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }))

    await waitFor(() =>
      expect(within(dialog).getByText(/mín\. 2 caracteres/i)).toBeTruthy()
    )
    expect(within(dialog).getByText(/precio válido/i)).toBeTruthy()
    expect(repo.saveProduct).not.toHaveBeenCalled()
  })
})
