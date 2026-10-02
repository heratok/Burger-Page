import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { UsersDirectory } from "./UsersDirectory"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"

describe("UsersDirectory - Super Admin User Management (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders user directory header, search bar, role filter and user rows", async () => {
    const mockUsers = [
      {
        id: "usr-1",
        username: "admin_super",
        role: "super_admin",
        createdAt: "2026-08-01T12:00:00Z",
      },
      {
        id: "usr-2",
        username: "admin_craft",
        role: "restaurant_admin",
        restaurantId: "burger-craft",
        createdAt: "2026-08-05T12:00:00Z",
      },
      {
        id: "usr-3",
        username: "admin_napoli",
        role: "restaurant_admin",
        restaurantId: "pizzeria-napoli",
        createdAt: "2026-08-10T12:00:00Z",
      },
    ]

    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    // Header & description
    expect(screen.getByText(/Directorio Global de Usuarios/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /\+ Nuevo Usuario/i })).toBeDefined()

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText("admin_super")).toBeDefined()
      expect(screen.getByText("admin_craft")).toBeDefined()
      expect(screen.getByText("admin_napoli")).toBeDefined()
    })

    // Roles badges check
    expect(screen.getAllByText(/Super Admin/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Admin Local/i).length).toBeGreaterThan(0)
  })

  it("filters users by username search input", async () => {
    const mockUsers = [
      {
        id: "usr-1",
        username: "super_admin",
        role: "super_admin",
        createdAt: "2026-08-01T12:00:00Z",
      },
      {
        id: "usr-2",
        username: "chef_pruebas",
        role: "restaurant_admin",
        restaurantId: "tienda-pruebas",
        createdAt: "2026-08-05T12:00:00Z",
      },
    ]

    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("super_admin")).toBeDefined()
      expect(screen.getByText("chef_pruebas")).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(/Buscar por nombre de usuario/i)
    fireEvent.change(searchInput, { target: { value: "chef" } })

    expect(screen.getByText("chef_pruebas")).toBeDefined()
    expect(screen.queryByText("super_admin")).toBeNull()
  })

  it("opens CreateUserModal when clicking '+ Nuevo Usuario'", async () => {
    vi.spyOn(apiClient, "listUsers").mockResolvedValue([])

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    const createUserBtn = screen.getByRole("button", { name: /\+ Nuevo Usuario/i })
    fireEvent.click(createUserBtn)

    expect(screen.getByRole("heading", { name: "Crear Usuario" })).toBeDefined()
  })

  it("displays active and inactive status badges correctly", async () => {
    const mockUsers = [
      { id: "usr-active", username: "active_user", role: "restaurant_admin", isActive: true },
      { id: "usr-inactive", username: "inactive_user", role: "restaurant_admin", isActive: false },
    ]
    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers as any)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("active_user")).toBeDefined()
      expect(screen.getByText("inactive_user")).toBeDefined()
    })

    expect(screen.getByText("Activo")).toBeDefined()
    expect(screen.getByText("Inactivo")).toBeDefined()
  })

  it("activates and deactivates a user with PATCH /users/:id", async () => {
    const mockUsers = [
      { id: "usr-1", username: "other_user", role: "restaurant_admin", isActive: true },
    ]
    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers as any)
    const setActiveSpy = vi.spyOn(apiClient, "setUserActive").mockResolvedValue({
      id: "usr-1",
      username: "other_user",
      role: "restaurant_admin",
      isActive: false,
    } as any)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("other_user")).toBeDefined()
    })

    const deactivateBtn = screen.getByRole("button", { name: /Desactivar/i })
    fireEvent.click(deactivateBtn)

    await waitFor(() => {
      expect(setActiveSpy).toHaveBeenCalledWith("usr-1", false)
    })
  })

  it("resets a user password and opens modal with temporary password and copy button", async () => {
    const mockUsers = [
      { id: "usr-reset", username: "reset_user", role: "restaurant_admin", isActive: true },
    ]
    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers as any)
    const resetSpy = vi.spyOn(apiClient, "resetUserPassword").mockResolvedValue({
      temporaryPassword: "temporary-super-secret-password-123",
    })

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("reset_user")).toBeDefined()
    })

    const resetBtn = screen.getByRole("button", { name: /Restablecer clave|Restablecer contraseña/i })
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith("usr-reset")
    })

    expect(await screen.findByText("temporary-super-secret-password-123")).toBeDefined()
    expect(screen.getByText(/solo se mostrará una vez/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Copiar/i })).toBeDefined()
  })

  it("deletes a user after confirmation in dialog", async () => {
    const mockUsers = [
      { id: "usr-del", username: "to_delete", role: "restaurant_admin", isActive: true },
    ]
    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers as any)
    const deleteSpy = vi.spyOn(apiClient, "deleteUser").mockResolvedValue(undefined as any)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("to_delete")).toBeDefined()
    })

    const deleteBtn = screen.getByRole("button", { name: /Eliminar usuario/i })
    fireEvent.click(deleteBtn)

    expect(await screen.findByText(/¿Eliminar usuario\?/i)).toBeDefined()
    const confirmBtn = screen.getByRole("button", { name: /Confirmar|Eliminar definitivamente/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("usr-del")
    })
  })

  it("hides or disables destructive actions on the current logged-in user's own row", async () => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "super", userId: "usr-super-me", username: "super_me" })
    )

    const mockUsers = [
      { id: "usr-super-me", username: "super_me", role: "super_admin", isActive: true },
      { id: "usr-other", username: "someone_else", role: "restaurant_admin", isActive: true },
    ]
    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers as any)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("super_me")).toBeDefined()
      expect(screen.getByText("someone_else")).toBeDefined()
    })

    // On own row: destructive buttons (delete, deactivate) must be disabled or not rendered
    const ownRow = screen.getByText("super_me").closest("tr")!
    const otherRow = screen.getByText("someone_else").closest("tr")!

    // Own row must have disabled delete or no delete button
    const ownDelete = ownRow.querySelector("button[aria-label*='Eliminar'], button[title*='Eliminar']")
    if (ownDelete) {
      expect((ownDelete as HTMLButtonElement).disabled).toBe(true)
    }

    const otherDelete = otherRow.querySelector("button[aria-label*='Eliminar'], button[title*='Eliminar']")
    expect(otherDelete).toBeDefined()
    if (otherDelete) {
      expect((otherDelete as HTMLButtonElement).disabled).toBe(false)
    }
  })

  it("shows Spanish error toast when deactivating the last active super admin fails with 409", async () => {
    const { toast } = await import("sonner")
    const toastErrorSpy = vi.spyOn(toast, "error")

    const mockUsers = [
      { id: "usr-last", username: "sole_super", role: "super_admin", isActive: true },
    ]
    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers as any)
    const error: any = new Error("Cannot deactivate the last active super admin")
    error.status = 409
    vi.spyOn(apiClient, "setUserActive").mockRejectedValue(error)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("sole_super")).toBeDefined()
    })

    const deactivateBtn = screen.getByRole("button", { name: /Desactivar/i })
    fireEvent.click(deactivateBtn)

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No es posible desactivar ni eliminar al único super administrador activo")
      )
    })
  })

  it("does not show fake fallback users when listUsers returns an empty list", async () => {
    vi.spyOn(apiClient, "listUsers").mockResolvedValue([])

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/No se encontraron usuarios/i)).toBeDefined()
    })

    expect(screen.queryByText("admin_craft")).toBeNull()
    expect(screen.queryByText("admin_napoli")).toBeNull()
  })
})

