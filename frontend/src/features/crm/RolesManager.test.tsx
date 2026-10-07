import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { RolesManager } from "./RolesManager"
import { apiClient } from "@/core/api/apiClient"
import type { RoleDTO } from "@burger-page/contracts"

const mockRoles: RoleDTO[] = [
  {
    id: "role-1",
    restaurantId: "rest-1",
    name: "Cajero",
    description: "Atención y cobro de pedidos en caja",
    permissions: ["orders.view", "orders.manage", "customers.view", "finance.view"],
    isSystem: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-2",
    restaurantId: "rest-1",
    name: "Cocinero",
    description: "Preparación y despacho de pedidos en cocina",
    permissions: ["orders.view", "orders.manage", "inventory.manage"],
    isSystem: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
]

vi.mock("@/context/RestaurantContext", () => ({
  useRestaurant: () => ({
    adminTheme: "light",
  }),
}))

describe("RolesManager Component (TDD)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(apiClient, "listRoles").mockResolvedValue([...mockRoles])
    vi.spyOn(apiClient, "createRole").mockResolvedValue({
      id: "role-3",
      restaurantId: "rest-1",
      name: "Mesero",
      description: "Servicio de mesas",
      permissions: ["orders.view", "tables.manage"],
      isSystem: false,
      createdAt: "2026-01-02T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    })
    vi.spyOn(apiClient, "updateRole").mockResolvedValue({
      ...mockRoles[0],
      name: "Cajero Principal",
    })
    vi.spyOn(apiClient, "deleteRole").mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it("renders list of roles fetched from apiClient", async () => {
    render(<RolesManager />)

    expect(apiClient.listRoles).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText("Cajero")).toBeDefined()
      expect(screen.getByText("Cocinero")).toBeDefined()
    })

    expect(screen.getByText("Atención y cobro de pedidos en caja")).toBeDefined()
    expect(screen.getByText("Preparación y despacho de pedidos en cocina")).toBeDefined()
  })

  it("filters roles by search query", async () => {
    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    const searchInput = screen.getByPlaceholderText(/Buscar rol por nombre/i)
    fireEvent.change(searchInput, { target: { value: "Cocina" } })

    expect(screen.queryByText("Cajero")).toBeNull()
    expect(screen.getByText("Cocinero")).toBeDefined()
  })

  it("creates a new role with presets and grouped permissions", async () => {
    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    // Open create modal
    const newRoleBtn = screen.getByRole("button", { name: /Nuevo Rol/i })
    fireEvent.click(newRoleBtn)

    expect(screen.getByText("Crear Nuevo Rol")).toBeDefined()

    // Fill name & description
    const nameInput = screen.getByLabelText(/Nombre del Rol/i)
    fireEvent.change(nameInput, { target: { value: "Mesero" } })

    // Click preset button "Cocina / Pedidos"
    const cocinaPresetBtn = screen.getByRole("button", { name: /Cocina/i })
    fireEvent.click(cocinaPresetBtn)

    // Check that orders.view checkbox is checked
    const ordersViewCheckbox = screen.getByLabelText(/Ver pedidos/i) as HTMLInputElement
    expect(ordersViewCheckbox.checked).toBe(true)

    // Submit form
    const saveBtn = screen.getByRole("button", { name: /Guardar Rol/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(apiClient.createRole).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mesero",
          permissions: expect.arrayContaining(["orders.view", "orders.manage", "inventory.manage"]),
        })
      )
    })
  })

  it("edits an existing role", async () => {
    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    // Click edit on Cajero
    const editBtn = screen.getByLabelText("Editar rol Cajero")
    fireEvent.click(editBtn)

    expect(screen.getByText("Editar Rol")).toBeDefined()
    const nameInput = screen.getByLabelText(/Nombre del Rol/i) as HTMLInputElement
    expect(nameInput.value).toBe("Cajero")

    fireEvent.change(nameInput, { target: { value: "Cajero Principal" } })

    const saveBtn = screen.getByRole("button", { name: /Guardar Rol/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(apiClient.updateRole).toHaveBeenCalledWith(
        "role-1",
        expect.objectContaining({
          name: "Cajero Principal",
        })
      )
    })
  })

  it("deletes a role after confirmation", async () => {
    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    const deleteBtn = screen.getByLabelText("Eliminar rol Cajero")
    fireEvent.click(deleteBtn)

    // Confirm modal should appear
    expect(screen.getByText("¿Eliminar rol?")).toBeDefined()

    const confirmBtn = screen.getByRole("button", { name: /Eliminar rol/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(apiClient.deleteRole).toHaveBeenCalledWith("role-1")
    })
  })

  it("handles 409 conflict error when deleting a role with assigned users", async () => {
    const conflictError = new Error("Role has assigned users")
    ;(conflictError as any).status = 409
    vi.spyOn(apiClient, "deleteRole").mockRejectedValue(conflictError)

    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    const deleteBtn = screen.getByLabelText("Eliminar rol Cajero")
    fireEvent.click(deleteBtn)

    const confirmBtn = screen.getByRole("button", { name: /Eliminar rol/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText(/No se puede eliminar el rol porque tiene usuarios asignados/i)).toBeDefined()
    })
  })
})
