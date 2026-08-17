import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import App from "./App"
import { ADMIN_GRANT_KEY } from "@/store/admin-context"

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = "#/"
})

describe("App routing", () => {
  it("renders the storefront with config-driven branding at the root route", () => {
    window.location.hash = "#/"
    render(<App />)
    expect(screen.getByText("BURGER PAGE")).toBeTruthy()
  })

  it("shows the password gate at /admin/products without a session grant", () => {
    window.location.hash = "#/admin/products"
    render(<App />)
    expect(screen.getByText("Panel de administración")).toBeTruthy()
    expect(screen.getByText(/contraseña de administrador/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeTruthy()
  })

  it("renders the admin product management at /admin/products with a grant", () => {
    sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
    window.location.hash = "#/admin/products"
    render(<App />)
    expect(screen.getByText("Panel de administración")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy()
  })

  it("redirects /admin to the product management section with a grant", () => {
    sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
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