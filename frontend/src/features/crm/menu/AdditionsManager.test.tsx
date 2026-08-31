import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { AdditionsManager } from "./AdditionsManager"
import type { AdditionItem } from "@/types/restaurant"

const mockAdditions: AdditionItem[] = [
  { id: "a-1", name: "Queso Extra", price: 4000, available: true },
  { id: "a-2", name: "Tocineta", price: 5000, available: true },
]

describe("AdditionsManager", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders additions and handles edit and delete clicks", () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()

    render(
      <AdditionsManager
        additions={mockAdditions}
        onEditAddition={onEdit}
        onDeleteAddition={onDelete}
      />
    )

    expect(screen.getByText("Queso Extra")).toBeDefined()
    expect(screen.getByText("Tocineta")).toBeDefined()

    const editButtons = screen.getAllByTitle("Editar adicional")
    fireEvent.click(editButtons[0])
    expect(onEdit).toHaveBeenCalledWith(mockAdditions[0])

    const deleteButtons = screen.getAllByTitle("Eliminar adicional")
    fireEvent.click(deleteButtons[0])
    expect(onDelete).toHaveBeenCalledWith(mockAdditions[0])
  })
})
