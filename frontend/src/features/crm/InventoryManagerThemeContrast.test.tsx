import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { InventoryManager } from "./InventoryManager"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"

describe("InventoryManager - Theme Contrast and Supplier Notes Legibility (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  })

  afterEach(() => {
    cleanup()
  })

  it("renders supplier notes and contact details with high contrast in Light Mode for 'rosto'", async () => {
    localStorage.setItem("burger_page_admin_theme_v2", "light")
    localStorage.setItem("burger_page_active_rest_v2", "rosto")

    render(
      <RestaurantProvider>
        <InventoryManager />
      </RestaurantProvider>
    )

    // Switch to Suppliers tab
    const suppliersTabButton = screen.getByRole("button", { name: /Proveedores/i })
    fireEvent.click(suppliersTabButton)

    // Verify supplier note is rendered
    const noteElement = screen.getByText(/Entrega cortes madurados al vacío los martes y jueves/i)
    expect(noteElement).toBeDefined()

    // In light mode, the note MUST NOT have hardcoded dark background and border
    expect(noteElement.className).not.toContain("bg-slate-900")
    expect(noteElement.className).not.toContain("border-slate-800")
    expect(noteElement.className).toContain("bg-slate-50")
    expect(noteElement.className).toContain("text-slate-700")

    // Contact name and phone should be dark in light mode, NOT low-contrast text-slate-300
    const contactNameElement = screen.getByText(/Mauricio Restrepo/i)
    expect(contactNameElement.className).not.toContain("text-slate-300")
    expect(contactNameElement.className).toMatch(/text-slate-800|text-slate-900/)

    const phoneElement = screen.getByText(/573112233445/i)
    expect(phoneElement.className).not.toContain("text-slate-300")
    expect(phoneElement.className).toMatch(/text-slate-800|text-slate-900/)
  })

  it("renders supplier notes and contact details with correct dark styling in Dark Mode for 'rosto'", async () => {
    localStorage.setItem("burger_page_admin_theme_v2", "dark")
    localStorage.setItem("burger_page_active_rest_v2", "rosto")

    render(
      <RestaurantProvider>
        <InventoryManager />
      </RestaurantProvider>
    )

    // Switch to Suppliers tab
    const suppliersTabButton = screen.getByRole("button", { name: /Proveedores/i })
    fireEvent.click(suppliersTabButton)

    const noteElement = screen.getByText(/Entrega cortes madurados al vacío los martes y jueves/i)
    expect(noteElement).toBeDefined()

    // In dark mode, note container should use dark background and legible text
    expect(noteElement.className).toContain("bg-slate-900")
    expect(noteElement.className).toContain("border-slate-800")
    expect(noteElement.className).toContain("text-slate-300")
  })
})
