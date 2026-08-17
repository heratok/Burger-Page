import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { LocalStorageRepository } from "@/lib/storage"
import { AdminProvider } from "@/store/AdminContext"
import { SUPER_ADMIN_GRANT_KEY, adminGrantKey } from "@/store/admin-context"
import SuperAdminGate from "./SuperAdminGate"

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
})

function renderGate() {
  return render(
    <AdminProvider>
      <SuperAdminGate>
        <div>Contenido super admin</div>
      </SuperAdminGate>
    </AdminProvider>
  )
}

describe("SuperAdminGate (SA-1)", () => {
  it("shows the super password prompt and keeps the portal hidden when not granted", () => {
    renderGate()

    expect(
      screen.getByRole("heading", { name: "Portal de administración" })
    ).toBeTruthy()
    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.queryByText("Contenido super admin")).toBeNull()
  })

  it("rejects a wrong super password with an error and grants nothing", () => {
    renderGate()

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "secreto123" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/contraseña incorrecta/i)).toBeTruthy()
    expect(screen.queryByText("Contenido super admin")).toBeNull()
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBeNull()
  })

  it("grants a super session on the correct envelope password", () => {
    const directory = new LocalStorageRepository(window.localStorage)
    render(
      <AdminProvider>
        <SuperAdminGate directory={directory}>
          <div>Contenido super admin</div>
        </SuperAdminGate>
      </AdminProvider>
    )

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: directory.getSuperAdminPassword() },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByText("Contenido super admin")).toBeTruthy()
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBe("1")
  })

  it("denies restaurant-mode sessions (the super portal is super-only)", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderGate()

    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.queryByText("Contenido super admin")).toBeNull()
  })

  it("renders the portal when a super session already exists", () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    renderGate()

    expect(screen.getByText("Contenido super admin")).toBeTruthy()
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull()
  })
})