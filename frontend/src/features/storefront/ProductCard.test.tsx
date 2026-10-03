import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import ProductCard from "./ProductCard"
import { RestaurantProvider } from "@/context/RestaurantContext"
import type { MenuItem } from "@/types/restaurant"

const product: MenuItem = {
  id: "p1",
  name: "Hamburguesa Clásica",
  price: 25000,
  category: "Hamburguesas",
  src: "/images/classic.jpg",
  description: "Carne 150g",
  inStock: true,
}

const renderCard = (closed?: boolean, onSelect = () => {}) =>
  render(
    <RestaurantProvider>
      <ProductCard product={product} onSelectProduct={onSelect} closed={closed} />
    </RestaurantProvider>
  )

describe("ProductCard - closed store", () => {
  afterEach(cleanup)

  it("offers the add action while open", () => {
    renderCard(false)
    expect(screen.getByRole("button", { name: /Agregar Hamburguesa Clásica al carrito/ })).toBeDefined()
    expect(screen.queryByText("Cerrado")).toBeNull()
  })

  it("shows a Cerrado label and announces the reason instead of an add action", () => {
    renderCard(true)
    expect(screen.queryByRole("button", { name: /Agregar .* al carrito/ })).toBeNull()
    const card = screen.getByRole("button", { name: /Hamburguesa Clásica.*Cerrado/ })
    expect(card.textContent).toContain("Cerrado")
  })

  it("still lets the customer open the product details while closed", () => {
    const onSelect = vi.fn()
    renderCard(true, onSelect)
    fireEvent.click(screen.getByRole("button", { name: /Hamburguesa Clásica.*Cerrado/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("opens image lightbox when clicking zoom button without triggering card selection", () => {
    const onSelect = vi.fn()
    renderCard(false, onSelect)

    const zoomBtn = screen.getByRole("button", { name: "Ampliar foto de Hamburguesa Clásica" })
    expect(zoomBtn).toBeDefined()

    // Lightbox is closed initially
    expect(screen.queryByLabelText("Foto ampliada de Hamburguesa Clásica")).toBeNull()

    // Click zoom button
    fireEvent.click(zoomBtn)

    // Lightbox opens
    expect(screen.getByLabelText("Foto ampliada de Hamburguesa Clásica")).toBeDefined()
    // onSelect was NOT called because propagation was stopped
    expect(onSelect).not.toHaveBeenCalled()

    // Click close button on lightbox
    const closeBtn = screen.getByRole("button", { name: "Cerrar vista previa" })
    fireEvent.click(closeBtn)
    expect(screen.queryByLabelText("Foto ampliada de Hamburguesa Clásica")).toBeNull()
  })
})

