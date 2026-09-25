import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { MenuFilterBar } from "./MenuFilterBar"

describe("MenuFilterBar", () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    categories: ["Hamburguesas", "Bebidas", "Postres", "Especiales"],
    selectedCategory: "ALL",
    totalProductsCount: 15,
    searchTerm: "",
    viewMode: "grid" as const,
    onSelectCategory: vi.fn(),
    onSearchChange: vi.fn(),
    onViewModeChange: vi.fn(),
    onOpenCategoryModal: vi.fn(),
  }

  it("renders categories and 'Todos' with correct counters", () => {
    render(<MenuFilterBar {...defaultProps} />)

    expect(screen.getByText("Todos (15)")).toBeDefined()
    expect(screen.getByText("Hamburguesas")).toBeDefined()
    expect(screen.getByText("Bebidas")).toBeDefined()
    expect(screen.getByText("Postres")).toBeDefined()
    expect(screen.getByText("Especiales")).toBeDefined()
  })

  it("uses a single-line horizontal scroll container with no-scrollbar and min-w-0 to prevent layout saturation", () => {
    const { container } = render(<MenuFilterBar {...defaultProps} />)

    const scrollContainer = container.querySelector("div.overflow-x-auto.no-scrollbar.min-w-0")
    expect(scrollContainer).not.toBeNull()

    // Verify all category buttons retain shrink-0 and whitespace-nowrap
    const buttons = scrollContainer?.querySelectorAll("button") || []
    expect(buttons.length).toBeGreaterThan(0)
    for (const btn of Array.from(buttons)) {
      expect(btn.className).toContain("shrink-0")
      expect(btn.className).toContain("whitespace-nowrap")
    }
  })

  it("calls onSelectCategory when a pill is clicked", () => {
    const onSelectCategory = vi.fn()
    render(<MenuFilterBar {...defaultProps} onSelectCategory={onSelectCategory} />)

    fireEvent.click(screen.getByText("Hamburguesas"))
    expect(onSelectCategory).toHaveBeenCalledWith("Hamburguesas")

    fireEvent.click(screen.getByText("Todos (15)"))
    expect(onSelectCategory).toHaveBeenCalledWith("ALL")
  })

  it("calls onSearchChange when typing in the search input", () => {
    const onSearchChange = vi.fn()
    render(<MenuFilterBar {...defaultProps} onSearchChange={onSearchChange} />)

    const input = screen.getByPlaceholderText("Buscar plato...")
    fireEvent.change(input, { target: { value: "Burger" } })
    expect(onSearchChange).toHaveBeenCalledWith("Burger")
  })

  it("calls onOpenCategoryModal when clicking 'Gestionar Categorías'", () => {
    const onOpenCategoryModal = vi.fn()
    render(<MenuFilterBar {...defaultProps} onOpenCategoryModal={onOpenCategoryModal} />)

    fireEvent.click(screen.getByText("Gestionar Categorías"))
    expect(onOpenCategoryModal).toHaveBeenCalled()
  })

  it("translates vertical wheel event to horizontal scroll for seamless desktop mouse navigation", () => {
    const { container } = render(<MenuFilterBar {...defaultProps} />)
    const scrollContainer = container.querySelector("div.overflow-x-auto") as HTMLElement
    expect(scrollContainer).not.toBeNull()

    expect(scrollContainer.scrollLeft).toBe(0)
    fireEvent.wheel(scrollContainer, { deltaY: 100 })
    expect(scrollContainer.scrollLeft).toBe(100)
  })

  it("supports mouse drag-to-scroll without accidentally triggering button clicks", () => {
    const onSelectCategory = vi.fn()
    const { container } = render(<MenuFilterBar {...defaultProps} onSelectCategory={onSelectCategory} />)
    const scrollContainer = container.querySelector("div.overflow-x-auto") as HTMLElement
    expect(scrollContainer).not.toBeNull()

    // Simulate drag start and move
    fireEvent.mouseDown(scrollContainer, { clientX: 100, pageX: 100 })
    fireEvent.mouseMove(scrollContainer, { clientX: 40, pageX: 40 }) // drag left by 60px
    fireEvent.mouseUp(scrollContainer)

    // A category click immediately after dragging should be suppressed
    fireEvent.click(screen.getByText("Hamburguesas"))
    expect(onSelectCategory).not.toHaveBeenCalled()
  })
})
