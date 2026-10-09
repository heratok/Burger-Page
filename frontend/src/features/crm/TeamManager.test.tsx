import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { TeamManager } from "./TeamManager"
import { apiClient } from "@/core/api/apiClient"
import type { ApiUserRecord } from "@/core/api/apiClient"
import type { RoleDTO } from "@burger-page/contracts"

const mockRoles: RoleDTO[] = [
  {
    id: "role-cashier",
    restaurantId: "rest-1",
    name: "Cajero",
    description: "Caja y cobros",
    permissions: ["orders.view", "orders.manage"],
    isSystem: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-cook",
    restaurantId: "rest-1",
    name: "Cocinero",
    description: "Cocina y despacho",
    permissions: ["orders.view", "inventory.manage"],
    isSystem: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
]

const mockUsers: ApiUserRecord[] = [
  {
    id: "user-1",
    username: "admin_burger",
    role: "restaurant_admin",
    restaurantId: "rest-1",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "user-2",
    username: "carlos_caja",
    role: "restaurant_staff",
    restaurantId: "rest-1",
    roleId: "role-cashier",
    isActive: true,
    mustChangePassword: true,
    createdAt: "2026-01-02T00:00:00Z",
  },
]

const mockSetAdminTab = vi.fn()

vi.mock("@/context/RestaurantContext", () => ({
  useRestaurant: () => ({
    adminTheme: "light",
    activeRestaurant: { id: "rest-1", name: "Burger Craft" },
    effectiveRestaurantId: "rest-1",
    session: { role: "restaurant", username: "admin_burger" },
    setAdminTab: mockSetAdminTab,
  }),
}))

describe("TeamManager Component (TDD)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(apiClient, "listUsers").mockResolvedValue([...mockUsers])
    vi.spyOn(apiClient, "listRoles").mockResolvedValue([...mockRoles])
    vi.spyOn(apiClient, "createUser").mockResolvedValue({
      id: "user-3",
      username: "pedro_cocina",
      role: "restaurant_staff",
      restaurantId: "rest-1",
      roleId: "role-cook",
    })
    vi.spyOn(apiClient, "updateUser").mockResolvedValue({
      ...mockUsers[1],
      roleId: "role-cook",
    })
    vi.spyOn(apiClient, "resetUserPassword").mockResolvedValue({
      temporaryPassword: "temp-pass-1234",
    })
    vi.spyOn(apiClient, "deleteUser").mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it("renders list of staff members and maps roleId to role name", async () => {
    render(<TeamManager />)

    expect(apiClient.listUsers).toHaveBeenCalled()
    expect(apiClient.listRoles).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText("admin_burger")).toBeDefined()
      expect(screen.getByText("carlos_caja")).toBeDefined()
    })

    // Role name should be displayed for staff
    expect(screen.getAllByText("Cajero").length).toBeGreaterThanOrEqual(1)
    // Admin badge
    expect(screen.getByText("Administrador")).toBeDefined()
  })

  it("filters users by username search input", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    const searchInput = screen.getByPlaceholderText(/Buscar por nombre de usuario/i)
    fireEvent.change(searchInput, { target: { value: "carlos" } })

    expect(screen.getByText("carlos_caja")).toBeDefined()
    expect(screen.queryByText("admin_burger")).toBeNull()
  })

  it("creates a new staff member and reveals temporary credentials", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    // Click "+ Nuevo Miembro"
    const newMemberBtn = screen.getByRole("button", { name: /Nuevo Miembro/i })
    fireEvent.click(newMemberBtn)

    expect(screen.getByText("Registrar Nuevo Miembro")).toBeDefined()

    // Fill form
    const usernameInput = screen.getByLabelText(/Nombre de Usuario/i)
    fireEvent.change(usernameInput, { target: { value: "pedro_cocina" } })

    const roleSelect = screen.getByLabelText(/Rol Asignado/i)
    fireEvent.change(roleSelect, { target: { value: "role-cook" } })

    // Save
    const saveBtn = screen.getByRole("button", { name: /Crear Usuario/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(apiClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "pedro_cocina",
          role: "restaurant_staff",
          roleId: "role-cook",
        })
      )
    })

    // Credentials reveal modal
    await waitFor(() => {
      expect(screen.getByText("Credenciales de Acceso")).toBeDefined()
      expect(screen.getByText("pedro_cocina")).toBeDefined()
    })
  })

  it("edits an existing staff member role and status", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    const editBtn = screen.getByLabelText("Editar usuario carlos_caja")
    fireEvent.click(editBtn)

    expect(screen.getByText("Editar Miembro del Equipo")).toBeDefined()

    const roleSelect = screen.getByLabelText(/Rol Asignado/i)
    fireEvent.change(roleSelect, { target: { value: "role-cook" } })

    const saveBtn = screen.getByRole("button", { name: /Guardar Cambios/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(apiClient.updateUser).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({
          roleId: "role-cook",
        })
      )
    })
  })

  it("resets password of a staff member and shows temporary password modal", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    const resetBtn = screen.getByLabelText("Restablecer clave carlos_caja")
    fireEvent.click(resetBtn)

    // Confirm dialog
    expect(screen.getByText("¿Restablecer contraseña?")).toBeDefined()

    const confirmBtn = screen.getByRole("button", { name: /Restablecer clave/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(apiClient.resetUserPassword).toHaveBeenCalledWith("user-2")
    })

    // Shows new temporary password
    await waitFor(() => {
      expect(screen.getByText("Nueva Clave Temporal")).toBeDefined()
      expect(screen.getByText("temp-pass-1234")).toBeDefined()
    })
  })

  it("deletes a staff member after confirmation", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    const deleteBtn = screen.getByLabelText("Eliminar usuario carlos_caja")
    fireEvent.click(deleteBtn)

    // Confirm modal
    expect(screen.getByText("¿Eliminar usuario?")).toBeDefined()

    const confirmBtn = screen.getByRole("button", { name: /Eliminar definitivamente/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(apiClient.deleteUser).toHaveBeenCalledWith("user-2")
    })
  })

  it("shows each role's description in the role select and shows the selected role's description", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    const newMemberBtn = screen.getByRole("button", { name: /Nuevo Miembro/i })
    fireEvent.click(newMemberBtn)

    const roleSelect = screen.getByLabelText(/Rol Asignado/i)
    // Options should contain role name and description
    expect(roleSelect.textContent).toContain("Cajero — Caja y cobros")
    expect(roleSelect.textContent).toContain("Cocinero — Cocina y despacho")

    // The selected role description is shown in business language below the select
    expect(screen.getByText("Caja y cobros")).toBeDefined()

    // Changing selection updates the description
    fireEvent.change(roleSelect, { target: { value: "role-cook" } })
    expect(screen.getByText("Cocina y despacho")).toBeDefined()
  })

  it("shows a hint with navigation button to Roles screen when zero roles exist", async () => {
    vi.spyOn(apiClient, "listRoles").mockResolvedValue([])

    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    const newMemberBtn = screen.getByRole("button", { name: /Nuevo Miembro/i })
    fireEvent.click(newMemberBtn)

    // Select should NOT be rendered; hint should be rendered instead
    expect(screen.queryByRole("combobox", { name: /Rol Asignado/i })).toBeNull()
    expect(screen.getByText(/No hay roles creados todavía/i)).toBeDefined()

    // Link/button to Roles screen
    const goToRolesBtn = screen.getByRole("button", { name: /Ir a configurar roles/i })
    expect(goToRolesBtn).toBeDefined()

    fireEvent.click(goToRolesBtn)
    expect(mockSetAdminTab).toHaveBeenCalledWith("roles")
  })
})
