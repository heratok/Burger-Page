import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { createTestQueryClient } from "@/test/testQueryClient"
import { apiClient } from "@/core/api/apiClient"
import { StoreSettingsManager } from "./StoreSettingsManager"

/** A promise settled by hand, so in-flight states stay observable. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

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
    const whatsappInput = screen.getByLabelText("Número de WhatsApp local") as HTMLInputElement
    fireEvent.change(whatsappInput, { target: { value: "3999999999" } })
    expect(whatsappInput.value).toBe("3999999999")

    // Pending changes badge and discard button should appear
    expect(screen.getByText("Cambios pendientes")).toBeDefined()
    expect(screen.getByText("Descartar")).toBeDefined()

    // Click Guardar
    const saveButton = screen.getByRole("button", { name: /Guardar Ajustes/i })
    fireEvent.click(saveButton)

    // After save, changes are applied
    expect(whatsappInput.value).toBe("3999999999")
  })

  it("replaces the editable form with a skeleton until the tenant data resolves", async () => {
    const directory = deferred<any[]>()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "listRestaurants").mockImplementation(() => directory.promise)
    const client = createTestQueryClient()

    render(
      <RestaurantProvider queryClient={client}>
        <StoreSettingsManager />
      </RestaurantProvider>
    )

    // Nothing editable can be typed while the tenant record is still unknown.
    expect(await screen.findByTestId("store-settings-skeleton")).toBeDefined()
    expect(screen.queryByLabelText("Número de WhatsApp local")).toBeNull()
    expect(screen.getByRole("button", { name: /Guardar Ajustes/i })).toHaveProperty("disabled", true)

    // The tenant lands: the real form replaces the skeleton.
    await waitFor(async () => {
      directory.resolve([])
      expect(await screen.findByLabelText("Número de WhatsApp local")).toBeDefined()
    })
    expect(screen.queryByTestId("store-settings-skeleton")).toBeNull()
  })
})
