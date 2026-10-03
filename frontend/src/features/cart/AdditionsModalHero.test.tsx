import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import AdditionsModal from "./AdditionsModal"
import { RestaurantProvider } from "@/context/RestaurantContext"
import type { MenuItem } from "@/types/restaurant"

describe("AdditionsModal Hero & Lightbox Behavior", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const dummyProduct: MenuItem = {
    id: "prod-hero",
    name: "Tenders Crispy x4",
    price: 22900,
    category: "Tenders",
    src: "https://example.com/tenders.jpg",
    description: "Tenders de pechuga de pollo crispy, con papas a la francesa, más una tostada de pan y salsa especial de la casa.",
    inStock: true,
  }

  it("renders the hero banner, full un-clamped description, and expands photo in lightbox on click", () => {
    render(
      <RestaurantProvider>
        <AdditionsModal
          product={dummyProduct}
          onClose={() => {}}
          onAddToCart={() => {}}
        />
      </RestaurantProvider>
    )

    // Full description is present and visible
    const desc = screen.getByText(dummyProduct.description)
    expect(desc).toBeDefined()
    expect(desc.className).not.toContain("line-clamp")

    // Hero image is present
    const heroImg = screen.getByAltText("Tenders Crispy x4")
    expect(heroImg).toBeDefined()

    // Lightbox is not open initially
    expect(screen.queryByLabelText("Foto ampliada de Tenders Crispy x4")).toBeNull()

    // Clicking "Ver foto" opens the lightbox
    const expandBtn = screen.getByRole("button", { name: "Ampliar imagen" })
    fireEvent.click(expandBtn)

    const lightbox = screen.getByLabelText("Foto ampliada de Tenders Crispy x4")
    expect(lightbox).toBeDefined()

    // Clicking close button on the lightbox closes it
    const closeLightboxBtn = screen.getByRole("button", { name: "Cerrar vista previa" })
    fireEvent.click(closeLightboxBtn)

    expect(screen.queryByLabelText("Foto ampliada de Tenders Crispy x4")).toBeNull()
  })

  it("closes only the lightbox and keeps AdditionsModal open when Escape is pressed", () => {
    const handleClose = vi.fn()
    render(
      <RestaurantProvider>
        <AdditionsModal
          product={dummyProduct}
          onClose={handleClose}
          onAddToCart={() => {}}
        />
      </RestaurantProvider>
    )

    const expandBtn = screen.getByRole("button", { name: "Ampliar imagen" })
    fireEvent.click(expandBtn)

    expect(screen.getByLabelText(`Foto ampliada de ${dummyProduct.name}`)).toBeDefined()

    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" })

    expect(screen.queryByLabelText(`Foto ampliada de ${dummyProduct.name}`)).toBeNull()
    expect(handleClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(expandBtn)
  })

  it("dismisses the lightbox and keeps AdditionsModal open when clicking the lightbox backdrop", () => {
    const handleClose = vi.fn()
    render(
      <RestaurantProvider>
        <AdditionsModal
          product={dummyProduct}
          onClose={handleClose}
          onAddToCart={() => {}}
        />
      </RestaurantProvider>
    )

    const expandBtn = screen.getByRole("button", { name: "Ampliar imagen" })
    fireEvent.click(expandBtn)

    const lightbox = screen.getByLabelText(`Foto ampliada de ${dummyProduct.name}`)
    expect(lightbox).toBeDefined()

    fireEvent.pointerDown(lightbox)
    fireEvent.mouseDown(lightbox)
    fireEvent.pointerUp(lightbox)
    fireEvent.mouseUp(lightbox)
    fireEvent.click(lightbox)

    expect(screen.queryByLabelText(`Foto ampliada de ${dummyProduct.name}`)).toBeNull()
    expect(handleClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(expandBtn)
  })

  it("manages focus and ensures lightbox is accessible when opened and closed", () => {
    render(
      <RestaurantProvider>
        <AdditionsModal
          product={dummyProduct}
          onClose={() => {}}
          onAddToCart={() => {}}
        />
      </RestaurantProvider>
    )

    const expandBtn = screen.getByRole("button", { name: "Ampliar imagen" })
    fireEvent.click(expandBtn)

    const lightbox = screen.getByLabelText(`Foto ampliada de ${dummyProduct.name}`)
    const closeBtn = screen.getByRole("button", { name: "Cerrar vista previa" })

    // Focus is moved to the close button
    expect(document.activeElement).toBe(closeBtn)

    // Lightbox is accessible (not marked aria-hidden="true", does not have inert)
    expect(lightbox.getAttribute("aria-hidden")).not.toBe("true")
    expect(lightbox.hasAttribute("inert")).toBe(false)

    // When closed, focus returns to the expand button
    fireEvent.click(closeBtn)
    expect(screen.queryByLabelText(`Foto ampliada de ${dummyProduct.name}`)).toBeNull()
    expect(document.activeElement).toBe(expandBtn)
  })

  it("renders the lightbox outside the AdditionsModal role=dialog element", () => {
    render(
      <RestaurantProvider>
        <AdditionsModal
          product={dummyProduct}
          onClose={() => {}}
          onAddToCart={() => {}}
        />
      </RestaurantProvider>
    )

    const expandBtn = screen.getByRole("button", { name: "Ampliar imagen" })
    fireEvent.click(expandBtn)

    const modalDialog = screen.getByRole("dialog", { name: dummyProduct.name })
    const lightbox = screen.getByRole("dialog", { name: `Foto ampliada de ${dummyProduct.name}` })

    expect(modalDialog.contains(lightbox)).toBe(false)
  })
})
