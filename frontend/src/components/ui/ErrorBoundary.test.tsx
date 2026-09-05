import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { useState } from "react"
import { ErrorBoundary } from "./ErrorBoundary"

// Component that conditionally throws an error to test boundary capture
const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("💥 Boom! Test render crash")
  }
  return <div>Healthy Component Content</div>
}

describe("ErrorBoundary UI Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Suppress console.error in vitest output for intentional error tests
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
  })

  it("renders children normally when there is no error", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText("Healthy Component Content")).toBeDefined()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("catches render errors and displays fallback UI without crashing app", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )

    const alert = screen.getByRole("alert")
    expect(alert).toBeDefined()
    expect(screen.getByText("Algo no salió como esperábamos")).toBeDefined()
    expect(screen.getByText("Reintentar")).toBeDefined()
    expect(screen.getByText("Recargar página")).toBeDefined()
  })

  it("supports custom fallback components", () => {
    render(
      <ErrorBoundary fallback={<div>Custom Error Screen</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText("Custom Error Screen")).toBeDefined()
  })

  it("calls onError callback when an error is caught", () => {
    const onErrorMock = vi.fn()

    render(
      <ErrorBoundary onError={onErrorMock}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onErrorMock).toHaveBeenCalledTimes(1)
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it("allows recovering state when clicking Reintentar button", () => {
    const TestContainer = () => {
      const [explode, setExplode] = useState(true)

      return (
        <div>
          <ErrorBoundary onReset={() => setExplode(false)}>
            <Bomb shouldThrow={explode} />
          </ErrorBoundary>
        </div>
      )
    }

    render(<TestContainer />)

    expect(screen.getByRole("alert")).toBeDefined()

    const retryButton = screen.getByText("Reintentar")
    fireEvent.click(retryButton)

    // After reset with healthy state, normal children render again
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Healthy Component Content")).toBeDefined()
  })
})
