import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react"
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
let mockEffectiveRestaurantId = "rest-1"

vi.mock("@/context/RestaurantContext", () => ({
  useRestaurant: () => ({
    adminTheme: "light",
    activeRestaurant: { id: mockEffectiveRestaurantId, name: "Burger Craft" },
    effectiveRestaurantId: mockEffectiveRestaurantId,
    session: { role: "restaurant", username: "admin_burger" },
    setAdminTab: mockSetAdminTab,
  }),
}))

describe("TeamManager Component (TDD)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEffectiveRestaurantId = "rest-1"
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

    const roleSelect = screen.getByLabelText(/Rol Asignado/i, { selector: "select" })
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

    const roleSelect = screen.getByLabelText(/Rol Asignado/i, { selector: "select" })
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

  it("uses the modern select for the create-member role with name and description as separate lines", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())
    fireEvent.click(screen.getByRole("button", { name: /Nuevo Miembro/i }))

    // Native select is only the hidden form twin; the visible control is the modern trigger
    const trigger = screen.getByTestId("create-role-select-trigger")
    expect(trigger.textContent).toContain("Cajero")
    expect(document.querySelector("select#create-role-select")).not.toBeNull()

    fireEvent.click(trigger)
    const menu = screen.getByTestId("create-role-select-menu")
    expect(menu.textContent).toContain("Caja y cobros")
    expect(menu.textContent).toContain("Cocina y despacho")
    // description is no longer glued to the name
    expect(menu.textContent).not.toContain("Cajero — Caja y cobros")

    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Cocinero/ }))
    expect(screen.getByTestId("create-role-select-trigger").textContent).toContain("Cocinero")
    // hidden select stays in sync for forms
    expect((document.querySelector("select#create-role-select") as HTMLSelectElement).value).toBe(
      "role-cook"
    )
  })

  it("falls back to the permission areas when a role has no description", async () => {
    vi.spyOn(apiClient, "listRoles").mockResolvedValue([
      { ...mockRoles[0], description: undefined },
    ])
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())
    fireEvent.click(screen.getByRole("button", { name: /Nuevo Miembro/i }))
    fireEvent.click(screen.getByTestId("create-role-select-trigger"))

    expect(screen.getByTestId("create-role-select-menu").textContent).toContain("Pedidos")
    expect(screen.getByTestId("create-role-select-menu").textContent).not.toContain("permisos")
  })

  it("filters the team by role using the modern select", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    fireEvent.click(screen.getByTestId("team-role-filter-trigger"))
    const menu = screen.getByTestId("team-role-filter-menu")
    expect(menu.textContent).toContain("Todos los roles")
    expect(menu.textContent).toContain("Administrador General")

    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Administrador General/ }))
    expect(screen.getByText("admin_burger")).toBeDefined()
    expect(screen.queryByText("carlos_caja")).toBeNull()
  })

  it("uses the modern select in the edit modal", async () => {
    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())
    fireEvent.click(screen.getByLabelText("Editar usuario carlos_caja"))

    const trigger = screen.getByTestId("edit-role-select-trigger")
    expect(trigger.textContent).toContain("Cajero")
    fireEvent.click(trigger)
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Cocinero/ }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    await waitFor(() => {
      expect(apiClient.updateUser).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({ roleId: "role-cook" })
      )
    })
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

  it("renders a 6-column TableSkeleton, visible live status, and disables Nuevo Miembro while initial requests are in flight", async () => {
    let resolveUsers!: (value: ApiUserRecord[]) => void
    let resolveRoles!: (value: RoleDTO[]) => void
    vi.spyOn(apiClient, "listUsers").mockImplementation(
      () => new Promise<ApiUserRecord[]>((res) => { resolveUsers = res })
    )
    vi.spyOn(apiClient, "listRoles").mockImplementation(
      () => new Promise<RoleDTO[]>((res) => { resolveRoles = res })
    )

    render(<TeamManager />)

    const skeleton = screen.getByTestId("table-skeleton")
    expect(skeleton).toBeDefined()
    expect(within(skeleton).getAllByRole("columnheader").length).toBe(6)

    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.textContent).toMatch(/Cargando equipo/i)

    const newMemberBtn = screen.getByRole("button", { name: /Nuevo Miembro/i }) as HTMLButtonElement
    expect(newMemberBtn.disabled).toBe(true)

    fireEvent.click(newMemberBtn)
    expect(screen.queryByText("Registrar Nuevo Miembro")).toBeNull()
    expect(screen.queryByText(/No hay roles creados todavía/i)).toBeNull()

    resolveUsers([...mockUsers])
    resolveRoles([...mockRoles])

    await waitFor(() => {
      expect(screen.getByText("carlos_caja")).toBeDefined()
      expect((screen.getByRole("button", { name: /Nuevo Miembro/i }) as HTMLButtonElement).disabled).toBe(false)
    })
    expect(screen.queryByTestId("table-skeleton")).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("keeps existing team rows visible while a refetch is in flight", async () => {
    let resolveRefetchUsers!: (value: ApiUserRecord[]) => void
    let resolveRefetchRoles!: (value: RoleDTO[]) => void
    vi.spyOn(apiClient, "listUsers")
      .mockResolvedValueOnce([...mockUsers])
      .mockImplementationOnce(
        () => new Promise<ApiUserRecord[]>((res) => { resolveRefetchUsers = res })
      )
    vi.spyOn(apiClient, "listRoles")
      .mockResolvedValueOnce([...mockRoles])
      .mockImplementationOnce(
        () => new Promise<RoleDTO[]>((res) => { resolveRefetchRoles = res })
      )

    render(<TeamManager />)

    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    // Trigger a mutation that invokes fetchData()
    fireEvent.click(screen.getByLabelText("Editar usuario carlos_caja"))
    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/Cargando equipo/i)
    })

    // Existing rows stay rendered and are not replaced by TableSkeleton
    expect(screen.getByText("admin_burger")).toBeDefined()
    expect(screen.getByText("carlos_caja")).toBeDefined()
    expect(screen.queryByTestId("table-skeleton")).toBeNull()

    resolveRefetchUsers([...mockUsers])
    resolveRefetchRoles([...mockRoles])

    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull()
    })
    expect(screen.getByText("carlos_caja")).toBeDefined()
  })

  it("shows an error state with Reintentar, hides false empty-state copy, and keeps Nuevo Miembro disabled when initial load fails", async () => {
    vi.spyOn(apiClient, "listUsers").mockRejectedValue(new Error("Fallo de red"))
    vi.spyOn(apiClient, "listRoles").mockRejectedValue(new Error("Fallo de red"))

    render(<TeamManager />)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })

    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeDefined()
    expect(screen.queryByText(/No hay miembros registrados/i)).toBeNull()
    expect(screen.queryByText(/No hay roles creados todavía/i)).toBeNull()
    expect((screen.getByRole("button", { name: /Nuevo Miembro/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("re-issues fetchData when clicking Reintentar and enables Nuevo Miembro once it succeeds", async () => {
    vi.spyOn(apiClient, "listUsers")
      .mockRejectedValueOnce(new Error("Fallo temporal"))
      .mockResolvedValueOnce([...mockUsers])
    vi.spyOn(apiClient, "listRoles")
      .mockRejectedValueOnce(new Error("Fallo temporal"))
      .mockResolvedValueOnce([...mockRoles])

    render(<TeamManager />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reintentar/i })).toBeDefined()
    })
    expect((screen.getByRole("button", { name: /Nuevo Miembro/i }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }))

    await waitFor(() => {
      expect(screen.getByText("carlos_caja")).toBeDefined()
    })

    expect(apiClient.listUsers).toHaveBeenCalledTimes(2)
    expect(apiClient.listRoles).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("alert")).toBeNull()
    expect((screen.getByRole("button", { name: /Nuevo Miembro/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("hides previous tenant rows, disables Nuevo Miembro, and shows TableSkeleton immediately when effectiveRestaurantId changes", async () => {
    let resolveRest2Users!: (value: ApiUserRecord[]) => void
    let resolveRest2Roles!: (value: RoleDTO[]) => void
    vi.spyOn(apiClient, "listUsers")
      .mockResolvedValueOnce([...mockUsers])
      .mockImplementationOnce(
        () => new Promise<ApiUserRecord[]>((res) => { resolveRest2Users = res })
      )
    vi.spyOn(apiClient, "listRoles")
      .mockResolvedValueOnce([...mockRoles])
      .mockImplementationOnce(
        () => new Promise<RoleDTO[]>((res) => { resolveRest2Roles = res })
      )

    const { rerender } = render(<TeamManager />)
    await waitFor(() => expect(screen.getByText("carlos_caja")).toBeDefined())

    mockEffectiveRestaurantId = "rest-2"
    rerender(<TeamManager />)

    expect(screen.queryByText("carlos_caja")).toBeNull()
    expect(screen.queryByText("admin_burger")).toBeNull()
    expect(screen.getByTestId("table-skeleton")).toBeDefined()
    expect((screen.getByRole("button", { name: /Nuevo Miembro/i }) as HTMLButtonElement).disabled).toBe(true)

    resolveRest2Users([
      {
        id: "user-r2",
        username: "maria_mesera",
        role: "restaurant_staff",
        restaurantId: "rest-2",
        roleId: "role-cashier",
        isActive: true,
        mustChangePassword: false,
        createdAt: "2026-02-01T00:00:00Z",
      },
    ])
    resolveRest2Roles([...mockRoles])

    await waitFor(() => expect(screen.getByText("maria_mesera")).toBeDefined())
    expect(screen.queryByText("carlos_caja")).toBeNull()
    expect((screen.getByRole("button", { name: /Nuevo Miembro/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("ignores a late response from the previous tenant so it never overwrites the new tenant's rows", async () => {
    let resolveRest1Users!: (value: ApiUserRecord[]) => void
    let resolveRest1Roles!: (value: RoleDTO[]) => void
    let resolveRest2Users!: (value: ApiUserRecord[]) => void
    let resolveRest2Roles!: (value: RoleDTO[]) => void

    vi.spyOn(apiClient, "listUsers")
      .mockImplementationOnce(
        () => new Promise<ApiUserRecord[]>((res) => { resolveRest1Users = res })
      )
      .mockImplementationOnce(
        () => new Promise<ApiUserRecord[]>((res) => { resolveRest2Users = res })
      )
    vi.spyOn(apiClient, "listRoles")
      .mockImplementationOnce(
        () => new Promise<RoleDTO[]>((res) => { resolveRest1Roles = res })
      )
      .mockImplementationOnce(
        () => new Promise<RoleDTO[]>((res) => { resolveRest2Roles = res })
      )

    const { rerender } = render(<TeamManager />)

    // Switch tenant while rest-1 is still in flight
    mockEffectiveRestaurantId = "rest-2"
    rerender(<TeamManager />)

    // rest-2 settles first
    resolveRest2Users([
      {
        id: "user-r2",
        username: "maria_mesera",
        role: "restaurant_staff",
        restaurantId: "rest-2",
        roleId: "role-cashier",
        isActive: true,
        mustChangePassword: false,
        createdAt: "2026-02-01T00:00:00Z",
      },
    ])
    resolveRest2Roles([...mockRoles])

    await waitFor(() => expect(screen.getByText("maria_mesera")).toBeDefined())

    // Now rest-1 resolves late
    await act(async () => {
      resolveRest1Users([...mockUsers])
      resolveRest1Roles([...mockRoles])
    })

    expect(screen.getByText("maria_mesera")).toBeDefined()
    expect(screen.queryByText("carlos_caja")).toBeNull()
  })
})
