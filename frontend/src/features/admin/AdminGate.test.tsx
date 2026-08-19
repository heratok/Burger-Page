import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { LocalStorageRepository } from "@/shared/storage/storage"
import { AdminProvider } from "@/store/AdminContext"
import { SUPER_ADMIN_GRANT_KEY, adminGrantKey } from "@/store/admin-context"
import AdminGate from "./AdminGate"

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
})

function renderGate(
  directory: LocalStorageRepository = new LocalStorageRepository(window.localStorage)
) {
  return render(
    <AdminProvider>
      <AdminGate directory={directory}>
        <div>Contenido admin</div>
      </AdminGate>
    </AdminProvider>
  )
}

describe("AdminGate (unified role-driven gate, AD-1, SA-1)", () => {
  it("shows the password prompt and keeps admin content hidden when not granted", () => {
    renderGate()

    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.queryByText("Contenido admin")).toBeNull()
  })

  it("rejects a wrong password with an error and grants nothing", () => {
    renderGate()

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "secreto123" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/contraseña incorrecta/i)).toBeTruthy()
    expect(screen.queryByText("Contenido admin")).toBeNull()
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBeNull()
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBeNull()
  })

  it("grants a super session on the super password", () => {
    const directory = new LocalStorageRepository(window.localStorage)
    renderGate(directory)

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: directory.getSuperAdminPassword() },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByText("Contenido admin")).toBeTruthy()
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBe("1")
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBeNull()
  })

  it("grants a restaurant session on that restaurant's admin password", () => {
    const directory = new LocalStorageRepository(window.localStorage)
    renderGate(directory)

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "roma" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByText("Contenido admin")).toBeTruthy()
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBe("1")
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBeNull()
  })

  it("scopes the session to the restaurant whose password matched", () => {
    const directory = new LocalStorageRepository(window.localStorage)
    renderGate(directory)

    // burger-page's password ("admin") must grant burger-page, not roma.
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "admin" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(sessionStorage.getItem(adminGrantKey("rest-burger-page"))).toBe("1")
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBeNull()
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBeNull()
  })

  it("clears the error when the user types again after a failed attempt", () => {
    renderGate()

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "nope" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))
    expect(screen.getByRole("alert")).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "a" },
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("renders children with an existing super session", () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    renderGate()

    expect(screen.getByText("Contenido admin")).toBeTruthy()
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull()
  })

  it("renders children with an existing restaurant session for a live restaurant", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderGate()

    expect(screen.getByText("Contenido admin")).toBeTruthy()
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull()
  })

  it("re-prompts when the session's restaurant no longer exists", () => {
    const directory = new LocalStorageRepository(window.localStorage)
    directory.deleteRestaurant("rest-pizza-roma")
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderGate(directory)

    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.queryByText("Contenido admin")).toBeNull()
  })
})