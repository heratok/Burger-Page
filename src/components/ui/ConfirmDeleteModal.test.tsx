import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { ConfirmDeleteModal } from "./ConfirmDeleteModal"

describe("ConfirmDeleteModal Component", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <ConfirmDeleteModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        targetName="Tacos El Rey"
      />
    )
    expect(container.innerHTML).toBe("")
  })

  it("renders title, custom description, and calls onConfirm when clicked", () => {
    const onConfirmMock = vi.fn()
    const onCloseMock = vi.fn()

    render(
      <ConfirmDeleteModal
        isOpen={true}
        onClose={onCloseMock}
        onConfirm={onConfirmMock}
        title="¿Eliminar restaurante?"
        targetName="Tacos El Rey"
        confirmText="Eliminar definitivamente"
      />
    )

    expect(screen.getByText("¿Eliminar restaurante?")).toBeDefined()
    expect(screen.getByText(/Tacos El Rey/i)).toBeDefined()

    const confirmBtn = screen.getByRole("button", { name: /Eliminar definitivamente/i })
    fireEvent.click(confirmBtn)

    expect(onConfirmMock).toHaveBeenCalledTimes(1)
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when cancel button is clicked", () => {
    const onConfirmMock = vi.fn()
    const onCloseMock = vi.fn()

    render(
      <ConfirmDeleteModal
        isOpen={true}
        onClose={onCloseMock}
        onConfirm={onConfirmMock}
        title="¿Eliminar plato?"
        cancelText="Cancelar"
      />
    )

    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i })
    fireEvent.click(cancelBtn)

    expect(onCloseMock).toHaveBeenCalledTimes(1)
    expect(onConfirmMock).not.toHaveBeenCalled()
  })
})
