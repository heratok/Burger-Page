import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import CharacterCounter from "./CharacterCounter"

describe("CharacterCounter", () => {
  it("no renderiza nada cuando el valor está vacío", () => {
    const { container } = render(<CharacterCounter value="" max={200} />)
    expect(container.querySelector("[data-slot='character-counter']")).toBeNull()
  })

  it("muestra el progreso con el formato actual/máximo", () => {
    const { getByText } = render(<CharacterCounter value="sin cebolla" max={200} />)
    expect(getByText("11/200")).toBeTruthy()
  })

  it("resalta en color de error al llegar al máximo", () => {
    const value = "x".repeat(200)
    const { container } = render(<CharacterCounter value={value} max={200} />)
    const el = container.querySelector("[data-slot='character-counter']")
    expect(el?.textContent).toBe("200/200")
    expect(el?.className).toContain("text-destructive")
  })

  it("es anunciado por lectores de pantalla", () => {
    const { container } = render(<CharacterCounter value="hola" max={200} />)
    const el = container.querySelector("[data-slot='character-counter']")
    expect(el?.getAttribute("aria-live")).toBe("polite")
  })
})
