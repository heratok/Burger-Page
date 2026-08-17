import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import App from "./App"

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.location.hash = "#/"
})

describe("App routing", () => {
  it("renders the storefront at the root route", () => {
    window.location.hash = "#/"
    render(<App />)
    expect(screen.getByText("Burger Page")).toBeTruthy()
  })

  it("renders the admin placeholder at /admin", () => {
    window.location.hash = "#/admin"
    render(<App />)
    expect(
      screen.getByRole("heading", { name: /panel de administración/i })
    ).toBeTruthy()
  })

  it("falls back to the storefront for unknown routes", () => {
    window.location.hash = "#/nope"
    render(<App />)
    expect(screen.getByText("Burger Page")).toBeTruthy()
  })
})