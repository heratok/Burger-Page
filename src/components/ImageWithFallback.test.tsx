import { describe, expect, it, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import ImageWithFallback from "./ImageWithFallback"

describe("ImageWithFallback", () => {
  afterEach(() => {
    cleanup()
  })

  it("renderiza la imagen correctamente cuando src es válido", () => {
    render(<ImageWithFallback src="https://example.com/burger.jpg" alt="Hamburguesa" />)
    const img = screen.getByRole("img", { name: "Hamburguesa" })
    expect(img).toBeTruthy()
    expect(img.tagName.toLowerCase()).toBe("img")
  })

  it("muestra el fallback cuando la imagen dispara onError", () => {
    render(<ImageWithFallback src="https://example.com/broken.jpg" alt="Hamburguesa rota" />)
    const img = screen.getByRole("img", { name: "Hamburguesa rota" })
    fireEvent.error(img)

    const fallback = screen.getByRole("img", { name: "Hamburguesa rota" })
    expect(fallback.tagName.toLowerCase()).toBe("div")
  })

  it("muestra el fallback inmediatamente si src está vacío", () => {
    render(<ImageWithFallback src="" alt="Sin imagen" />)
    const fallback = screen.getByRole("img", { name: "Sin imagen" })
    expect(fallback.tagName.toLowerCase()).toBe("div")
  })
})
