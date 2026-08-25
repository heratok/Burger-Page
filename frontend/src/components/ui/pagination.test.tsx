import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { Pagination } from "./pagination"

describe("Pagination Component", () => {
  beforeEach(() => {
    cleanup()
  })
  it("renders correctly with total items and pages", () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={1}
        totalItems={45}
        pageSize={10}
        onPageChange={onPageChange}
      />
    )

    expect(screen.getByText("1")).toBeDefined()
    expect(screen.getByText("10")).toBeDefined()
    expect(screen.getByText("45")).toBeDefined()
    expect(screen.getByText("Pág. 1 de 5")).toBeDefined()
  })

  it("handles next, previous, first, and last page navigation", () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={2}
        totalItems={50}
        pageSize={10}
        onPageChange={onPageChange}
      />
    )

    // Next page
    const nextBtn = screen.getByTitle("Página siguiente")
    fireEvent.click(nextBtn)
    expect(onPageChange).toHaveBeenCalledWith(3)

    // Prev page
    const prevBtn = screen.getByTitle("Página anterior")
    fireEvent.click(prevBtn)
    expect(onPageChange).toHaveBeenCalledWith(1)

    // First page
    const firstBtn = screen.getByTitle("Primera página")
    fireEvent.click(firstBtn)
    expect(onPageChange).toHaveBeenCalledWith(1)

    // Last page
    const lastBtn = screen.getByTitle("Última página")
    fireEvent.click(lastBtn)
    expect(onPageChange).toHaveBeenCalledWith(5)
  })

  it("disables previous and first buttons when on first page", () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    )
    expect(screen.getByTitle("Página anterior")).toHaveProperty("disabled", true)
    expect(screen.getByTitle("Primera página")).toHaveProperty("disabled", true)
  })

  it("handles page size changes", () => {
    const onPageSizeChange = vi.fn()
    render(
      <Pagination
        currentPage={1}
        totalItems={100}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />
    )

    const select = screen.getByLabelText("Registros por página")
    fireEvent.change(select, { target: { value: "25" } })
    expect(onPageSizeChange).toHaveBeenCalledWith(25)
  })
})
