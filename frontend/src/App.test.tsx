import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import App from "./App"

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.location.hash = "#/"
})

describe("App routing", () => {
  it("renders the storefront with config-driven branding at the root route", () => {
    window.location.hash = "#/"
    render(<App />)
    expect(screen.getByText("BURGER PAGE")).toBeTruthy()
  })

  it("renders the admin product management at /admin/products", () => {
    window.location.hash = "#/admin/products"
    render(<App />)
    expect(screen.getByText("Panel de administración")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
  })

  it("redirects /admin to the product management section", () => {
    window.location.hash = "#/admin"
    render(<App />)
    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
  })

  it("falls back to the storefront for unknown routes", () => {
    window.location.hash = "#/nope"
    render(<App />)
    expect(screen.getByText("BURGER PAGE")).toBeTruthy()
  })
})