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
          permissions: ["orders.view", "orders.manage"],
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

  it("renders empty state with call to action 'Crear roles recomendados' when zero roles exist", async () => {
    vi.spyOn(apiClient, "listRoles").mockResolvedValue([])

    render(<RolesManager />)

    await waitFor(() => {
      expect(screen.getByText("No hay roles configurados")).toBeDefined()
    })

    const seedBtn = screen.getByRole("button", { name: /Crear roles recomendados/i })
    expect(seedBtn).toBeDefined()
  })

  it("seeds all DEFAULT_ROLE_TEMPLATES when clicking 'Crear roles recomendados'", async () => {
    vi.spyOn(apiClient, "listRoles")
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: "seeded-1",
          restaurantId: "rest-1",
          name: "Cajero",
          permissions: ["orders.view", "orders.manage", "customers.view", "customers.manage", "tables.manage"],
          isSystem: false,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ])

    render(<RolesManager />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Crear roles recomendados/i })).toBeDefined()
    })

    const seedBtn = screen.getByRole("button", { name: /Crear roles recomendados/i })
    fireEvent.click(seedBtn)

    await waitFor(() => {
      // 4 templates: Cajero, Mesero, Cocina, Gerente
      expect(apiClient.createRole).toHaveBeenCalledTimes(4)
    })

    expect(apiClient.createRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cajero",
        permissions: expect.not.arrayContaining(["finance.view"]),
      })
    )
    expect(apiClient.createRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Gerente",
      })
    )
    // Refetched roles after seeding
    expect(apiClient.listRoles).toHaveBeenCalledTimes(2)
  })

  it("handles 409 conflict per-role without aborting remaining templates during seeding", async () => {
    vi.spyOn(apiClient, "listRoles").mockResolvedValue([])
    vi.spyOn(apiClient, "createRole").mockImplementation(async (input) => {
      if (input.name === "Cajero") {
        const conflictErr = new Error("Role already exists")
        ;(conflictErr as any).status = 409
        throw conflictErr
      }
      return {
        id: `seeded-${input.name}`,
        restaurantId: "rest-1",
        name: input.name,
        permissions: input.permissions,
        isSystem: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }
    })

    render(<RolesManager />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Crear roles recomendados/i })).toBeDefined()
    })

    const seedBtn = screen.getByRole("button", { name: /Crear roles recomendados/i })
    fireEvent.click(seedBtn)

    await waitFor(() => {
      // Still attempted all 4 templates despite Cajero failing with 409
      expect(apiClient.createRole).toHaveBeenCalledTimes(4)
    })
  })

  it("presets in create modal are driven by DEFAULT_ROLE_TEMPLATES and Cajero preset does not include finance.view", async () => {
    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    const newRoleBtn = screen.getByRole("button", { name: /Nuevo Rol/i })
    fireEvent.click(newRoleBtn)

    // Presets should include Cajero, Mesero, Cocina, Gerente, Administrador General
    expect(screen.getByRole("button", { name: /^Cajero$/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /^Mesero$/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /^Cocina$/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /^Gerente$/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /^Administrador General$/i })).toBeDefined()

    // Click Cajero preset
    const cajeroPresetBtn = screen.getByRole("button", { name: /^Cajero$/i })
    fireEvent.click(cajeroPresetBtn)

    // finance.view checkbox must NOT be checked
    const financeCheckbox = screen.getByLabelText(/Ver finanzas y reportes/i) as HTMLInputElement
    expect(financeCheckbox.checked).toBe(false)

    // orders.view and customers.view should be checked
    const ordersCheckbox = screen.getByLabelText(/Ver pedidos/i) as HTMLInputElement
    expect(ordersCheckbox.checked).toBe(true)
  })
})
