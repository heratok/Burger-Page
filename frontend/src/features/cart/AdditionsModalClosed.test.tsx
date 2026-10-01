import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import AdditionsModal from "./AdditionsModal"
import { RestaurantProvider } from "@/context/RestaurantContext"
import type { MenuItem } from "@/types/restaurant"
import type { CartItem } from "./cartEngine"

const product: any = {
  id: "p1",
  name: "Hamburguesa Clásica",
  price: 25000,
  category: "Hamburguesas",
  src: "/images/classic.jpg",
  description: "Carne 150g",
  inStock: true,
  additions: ["Tocineta"],
} satisfies MenuItem & { additions: string[] }

const initial: CartItem = {
  id: "c1",
  menuItemId: "p1",
  name: "Hamburguesa Clásica",
  price: 25000,
  cantidad: 2,
  total: 50000,
  src: "/images/classic.jpg",
  observacion: "",
  adiciones: [],
}

const renderModal = (props: Record<string, unknown>) =>
  render(
    <RestaurantProvider>
      <AdditionsModal product={product} onClose={() => {}} onAddToCart={() => {}} {...props} />
    </RestaurantProvider>
  )

describe("AdditionsModal - closed store", () => {
  afterEach(cleanup)

  it("replaces the add button with a disabled Cerrado button", () => {
    const onAdd = vi.fn()
    renderModal({ closed: true, onAddToCart: onAdd })
    const btn = screen.getByRole("button", { name: /Cerrado/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /^Agregar ·/ })).toBeNull()
  })

  it("disables the quantity and addition increase controls", () => {
    renderModal({ closed: true })
    expect((screen.getByLabelText("Aumentar cantidad") as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText("Agregar Tocineta") as HTMLButtonElement).disabled).toBe(true)
  })

  it("keeps saving an edit available (it can only reduce) while closed", () => {
    const onAdd = vi.fn()
    renderModal({ closed: true, editing: true, initial, onAddToCart: onAdd })
    fireEvent.click(screen.getByLabelText("Disminuir cantidad"))
    const save = screen.getByRole("button", { name: /Guardar cambios/ }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd.mock.calls[0][0].cantidad).toBe(1)
  })

  it("is unchanged while open", () => {
    renderModal({ closed: false })
    expect((screen.getByLabelText("Aumentar cantidad") as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole("button", { name: /^Agregar ·/ })).toBeDefined()
  })
})
