import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { StoreSettingsManager } from "./StoreSettingsManager"

describe("StoreSettingsManager Component", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders header, allows editing business settings and saving changes", () => {
    render(
      <RestaurantProvider>
        <StoreSettingsManager />
      </RestaurantProvider>
    )

    expect(screen.getByText("Ajustes de Negocio & Operación")).toBeDefined()
    expect(screen.getByText("Canales & Reglas de Compra")).toBeDefined()

    // Edit WhatsApp
    const whatsappInput = screen.getByPlaceholderText("573022575805") as HTMLInputElement
    fireEvent.change(whatsappInput, { target: { value: "573999999999" } })
    expect(whatsappInput.value).toBe("573999999999")

    // Pending changes badge and discard button should appear
    expect(screen.getByText("Cambios pendientes")).toBeDefined()
    expect(screen.getByText("Descartar")).toBeDefined()

    // Click Guardar
    const saveButton = screen.getByRole("button", { name: /Guardar Ajustes/i })
    fireEvent.click(saveButton)

    // After save, changes are applied
    expect(whatsappInput.value).toBe("573999999999")
  })
})
