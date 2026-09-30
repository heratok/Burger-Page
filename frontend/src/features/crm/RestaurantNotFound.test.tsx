import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

vi.mock("@/context/RestaurantContext", () => ({
  useRestaurant: () => ({
    restaurants: [
      {
        id: "rest-secret",
        slug: "secret-tenant",
        config: { name: "Secret Tenant", tagline: "Private", logoUrl: "x.png" },
      },
    ],
    switchRestaurant: vi.fn(),
    setActiveView: vi.fn(),
  }),
}))

import { RestaurantNotFound } from "./RestaurantNotFound"

describe("RestaurantNotFound", () => {
  afterEach(() => cleanup())

  it("shows a clean not-found message and never lists platform restaurants", () => {
    render(<RestaurantNotFound attemptedSlug="nope" />)
    expect(screen.getByText("Restaurante no encontrado")).toBeDefined()
    expect(screen.getByText("/nope")).toBeDefined()
    expect(screen.queryByText("Secret Tenant")).toBeNull()
    expect(screen.queryByText(/Restaurantes Disponibles/i)).toBeNull()
    expect(screen.queryAllByRole("img")).toHaveLength(0)
  })

  it("keeps the retry button for the transient error state", () => {
    const onRetry = vi.fn()
    render(<RestaurantNotFound attemptedSlug="nope" loadError onRetry={onRetry} />)
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("Secret Tenant")).toBeNull()
  })
})
