import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { toast } from "sonner"
import { CreateUserModal } from "./CreateUserModal"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"

describe("CreateUserModal - error mapping", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("maps a username-taken conflict to the shared Spanish copy instead of the raw backend message", async () => {
    const conflictError: any = new Error('Username "ana" already exists')
    conflictError.status = 409
    vi.spyOn(apiClient, "createUser").mockRejectedValue(conflictError)
    const toastErrorSpy = vi.spyOn(toast, "error")

    render(
      <RestaurantProvider>
        <CreateUserModal isOpen onClose={() => {}} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByPlaceholderText("Ej. admin_local"), { target: { value: "ana" } })
    fireEvent.change(screen.getByPlaceholderText("Contraseña segura"), { target: { value: "supersecret" } })
    // Super Admin needs no restaurant selection, keeping the test focused on
    // the error-mapping path rather than the role/restaurant form plumbing.
    fireEvent.click(screen.getByRole("button", { name: /Super Admin/i }))
    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }))

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith("El nombre de usuario ya está en uso por otra cuenta.")
    })
  })

  it('associates labels with their controls and exposes the role picker as a labelled group', () => {
    render(
      <RestaurantProvider>
        <CreateUserModal isOpen onClose={() => {}} />
      </RestaurantProvider>
    )
    expect(screen.getByLabelText(/Nombre de Usuario/i)).toBe(screen.getByPlaceholderText('Ej. admin_local'))
    expect(screen.getByLabelText(/Contraseña \*/i)).toBe(screen.getByPlaceholderText('Contraseña segura'))
    const group = screen.getByRole('group', { name: 'Rol del Usuario' })
    expect(group.querySelectorAll('button[aria-pressed]').length).toBe(2)
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDefined()
  })
})

describe("CreateUserModal - keyboard accessibility", () => {
  afterEach(() => cleanup())

  it("closes on Escape and exposes a named modal dialog", () => {
    const onClose = vi.fn()
    render(
      <RestaurantProvider>
        <CreateUserModal isOpen onClose={onClose} />
      </RestaurantProvider>
    )
    const dialog = screen.getByRole("dialog", { name: "Crear Usuario" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
