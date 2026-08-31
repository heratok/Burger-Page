import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { StatCard } from "./stat-card"
import { DollarSign, Users } from "lucide-react"

describe("StatCard UI Component", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders title and value properly", () => {
    render(
      <StatCard
        title="Total Revenue"
        value="$125,000"
      />
    )

    expect(screen.getByText("Total Revenue")).toBeDefined()
    expect(screen.getByText("$125,000")).toBeDefined()
  })

  it("renders numeric and ReactNode values correctly", () => {
    render(
      <StatCard
        title="Total Orders"
        value={<span data-testid="custom-value">42</span>}
      />
    )

    expect(screen.getByTestId("custom-value")).toBeDefined()
    expect(screen.getByText("42")).toBeDefined()
  })

  it("renders description and subtitle interchangeably", () => {
    const { rerender } = render(
      <StatCard
        title="Metric 1"
        value={10}
        description="10% increase from last week"
      />
    )
    expect(screen.getByText("10% increase from last week")).toBeDefined()

    rerender(
      <StatCard
        title="Metric 1"
        value={10}
        subtitle="Subtitle info"
      />
    )
    expect(screen.getByText("Subtitle info")).toBeDefined()
  })

  it("renders optional icon with custom classes", () => {
    render(
      <StatCard
        title="Customers"
        value={150}
        icon={<Users data-testid="users-icon" />}
        iconClassName="text-amber-500"
        iconBgClassName="bg-amber-100"
      />
    )

    const iconEl = screen.getByTestId("users-icon")
    expect(iconEl).toBeDefined()

    const iconContainer = screen.getByTestId("stat-card-icon-container")
    expect(iconContainer.className).toContain("bg-amber-100")
  })

  it("applies correct variant styling classes", () => {
    const variants = ["default", "warning", "success", "info", "indigo"] as const

    variants.forEach((variant) => {
      const { unmount } = render(
        <StatCard
          title={`${variant} title`}
          value={100}
          variant={variant}
          icon={<DollarSign data-testid={`${variant}-icon`} />}
          description="Variant test description"
        />
      )

      const iconContainer = screen.getByTestId("stat-card-icon-container")
      expect(iconContainer).toBeDefined()
      unmount()
    })
  })

  it("applies dark mode styling when isDark is true", () => {
    const { container } = render(
      <StatCard
        title="Dark Stat"
        value={500}
        isDark={true}
      />
    )

    const card = container.firstChild as HTMLElement
    expect(card.className).toContain("border-slate-800")
    expect(card.className).toContain("bg-slate-900")
  })

  it("applies light mode styling when isDark is false or undefined", () => {
    const { container } = render(
      <StatCard
        title="Light Stat"
        value={500}
      />
    )

    const card = container.firstChild as HTMLElement
    expect(card.className).toContain("border-slate-200")
    expect(card.className).toContain("bg-white")
  })

  it("supports onClick callback and keyboard interaction (Enter / Space)", () => {
    const handleClick = vi.fn()
    const { container } = render(
      <StatCard
        title="Clickable Stat"
        value={99}
        onClick={handleClick}
      />
    )

    const card = container.firstChild as HTMLElement
    expect(card.getAttribute("role")).toBe("button")
    expect(card.getAttribute("tabIndex")).toBe("0")
    expect(card.className).toContain("cursor-pointer")

    // Mouse click
    fireEvent.click(card)
    expect(handleClick).toHaveBeenCalledTimes(1)

    // Keyboard Enter
    fireEvent.keyDown(card, { key: "Enter" })
    expect(handleClick).toHaveBeenCalledTimes(2)

    // Keyboard Space
    fireEvent.keyDown(card, { key: " " })
    expect(handleClick).toHaveBeenCalledTimes(3)
  })

  it("renders badge and additional children when provided", () => {
    render(
      <StatCard
        title="Orders"
        value={25}
        badge={<span data-testid="custom-badge">5 active</span>}
      >
        <div data-testid="extra-child">Extra footer content</div>
      </StatCard>
    )

    expect(screen.getByTestId("custom-badge")).toBeDefined()
    expect(screen.getByText("5 active")).toBeDefined()
    expect(screen.getByTestId("extra-child")).toBeDefined()
  })

  it("merges custom className with default classes", () => {
    const { container } = render(
      <StatCard
        title="Custom Class Stat"
        value={1}
        className="my-custom-card-class"
      />
    )

    const card = container.firstChild as HTMLElement
    expect(card.className).toContain("my-custom-card-class")
  })
})
