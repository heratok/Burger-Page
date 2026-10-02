import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { TablesManager } from "./TablesManager"

describe("TablesManager Component", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders header and tables management view", () => {
    render(
      <RestaurantProvider>
        <TablesManager />
      </RestaurantProvider>
    )

    expect(screen.getByText("Gestión de Mesas & Códigos QR")).toBeDefined()
    expect(screen.getByText(/Configura las mesas de tu salón/i)).toBeDefined()
    expect(screen.getByText("Mesas del salón")).toBeDefined()
  })
})
