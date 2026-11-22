import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react"
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

let mockEffectiveRestaurantId = "rest-1"

vi.mock("@/context/RestaurantContext", () => ({
  useRestaurant: () => ({
    adminTheme: "light",
    effectiveRestaurantId: mockEffectiveRestaurantId,
  }),
}))

describe("RolesManager Component (TDD)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEffectiveRestaurantId = "rest-1"
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

  it("explains each role in plain language instead of raw permission codes", async () => {
    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    expect(screen.getAllByText("Puede:").length).toBe(2)
    expect(screen.getAllByText("ver y gestionar").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Clientes")).toBeDefined()
    expect(screen.getByText("Inventario")).toBeDefined()

    // No raw codes, no meaningless ratio, no truncation
    expect(screen.queryByText("orders.view")).toBeNull()
    expect(screen.queryByText(/Permisos asignados/i)).toBeNull()
    expect(screen.queryByText(/\d+ de \d+/)).toBeNull()
    expect(screen.queryByText(/más$/)).toBeNull()
  })

  it("flags sensitive permissions with an accessible label", async () => {
    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    // Cajero has finance.view; Cocinero has none
    expect(screen.getAllByLabelText("Permiso sensible").length).toBe(1)
  })

  it("shows a clear hint for a role without permissions", async () => {
    vi.spyOn(apiClient, "listRoles").mockResolvedValue([
      { ...mockRoles[0], id: "role-empty", name: "Pasante", permissions: [] },
    ])
    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Pasante")).toBeDefined())
    expect(screen.getByText("Sin permisos asignados")).toBeDefined()
    expect(screen.queryByText("Puede:")).toBeNull()
  })

  it("renders structured role card skeletons and visible live status while initial request is in flight", async () => {
    let resolveRoles!: (value: RoleDTO[]) => void
    vi.spyOn(apiClient, "listRoles").mockImplementation(
      () => new Promise<RoleDTO[]>((res) => { resolveRoles = res })
    )

    render(<RolesManager />)

    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.textContent).toMatch(/Cargando roles/i)

    const skeletonGrid = screen.getByTestId("roles-grid-skeleton")
    expect(skeletonGrid.children.length).toBe(3)
    const firstCard = skeletonGrid.children[0] as HTMLElement
    // Mirrors card anatomy: title bar, two description lines, permission summary lines, date footer
    expect(firstCard.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(7)

    resolveRoles([...mockRoles])

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())
    expect(screen.queryByTestId("roles-grid-skeleton")).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("keeps existing role cards visible while a refetch is in flight", async () => {
    let resolveRefetch!: (value: RoleDTO[]) => void
    vi.spyOn(apiClient, "listRoles")
      .mockResolvedValueOnce([...mockRoles])
      .mockImplementationOnce(
        () => new Promise<RoleDTO[]>((res) => { resolveRefetch = res })
      )

    render(<RolesManager />)

    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    fireEvent.click(screen.getByLabelText("Editar rol Cajero"))
    fireEvent.click(screen.getByRole("button", { name: /Guardar Rol/i }))

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/Cargando roles/i)
    })

    expect(screen.getByText("Cajero")).toBeDefined()
    expect(screen.getByText("Cocinero")).toBeDefined()
    expect(screen.queryByTestId("roles-grid-skeleton")).toBeNull()

    resolveRefetch([...mockRoles])

    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull()
    })
    expect(screen.getByText("Cajero")).toBeDefined()
  })

  it("shows an error state with Reintentar, hides false empty-state copy, and keeps Nuevo Rol disabled when initial load fails", async () => {
    vi.spyOn(apiClient, "listRoles").mockRejectedValue(new Error("Fallo de red"))

    render(<RolesManager />)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })

    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeDefined()
    expect(screen.queryByText(/No hay roles configurados/i)).toBeNull()
    expect(screen.queryByRole("button", { name: /Crear roles recomendados/i })).toBeNull()
    expect((screen.getByRole("button", { name: /Nuevo Rol/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("re-issues listRoles when clicking Reintentar and enables Nuevo Rol once it succeeds", async () => {
    vi.spyOn(apiClient, "listRoles")
      .mockRejectedValueOnce(new Error("Fallo temporal"))
      .mockResolvedValueOnce([...mockRoles])

    render(<RolesManager />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reintentar/i })).toBeDefined()
    })
    expect((screen.getByRole("button", { name: /Nuevo Rol/i }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }))

    await waitFor(() => {
      expect(screen.getByText("Cajero")).toBeDefined()
    })

    expect(apiClient.listRoles).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("alert")).toBeNull()
    expect((screen.getByRole("button", { name: /Nuevo Rol/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("hides previous tenant roles, disables Nuevo Rol, and shows skeletons immediately when effectiveRestaurantId changes", async () => {
    let resolveRest2Roles!: (value: RoleDTO[]) => void
    vi.spyOn(apiClient, "listRoles")
      .mockResolvedValueOnce([...mockRoles])
      .mockImplementationOnce(
        () => new Promise<RoleDTO[]>((res) => { resolveRest2Roles = res })
      )

    const { rerender } = render(<RolesManager />)
    await waitFor(() => expect(screen.getByText("Cajero")).toBeDefined())

    mockEffectiveRestaurantId = "rest-2"
    rerender(<RolesManager />)

    expect(screen.queryByText("Cajero")).toBeNull()
    expect(screen.queryByText("Cocinero")).toBeNull()
    expect(screen.getByTestId("roles-grid-skeleton")).toBeDefined()
    expect((screen.getByRole("button", { name: /Nuevo Rol/i }) as HTMLButtonElement).disabled).toBe(true)

    resolveRest2Roles([
      {
        id: "role-r2",
        restaurantId: "rest-2",
        name: "Hostess",
        description: "Recepción de mesas",
        permissions: ["tables.manage"],
        isSystem: false,
        createdAt: "2026-02-01T00:00:00Z",
        updatedAt: "2026-02-01T00:00:00Z",
      },
    ])

    await waitFor(() => expect(screen.getByText("Hostess")).toBeDefined())
    expect(screen.queryByText("Cajero")).toBeNull()
    expect((screen.getByRole("button", { name: /Nuevo Rol/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("ignores a late response from the previous tenant so it never overwrites the new tenant's roles", async () => {
    let resolveRest1Roles!: (value: RoleDTO[]) => void
    let resolveRest2Roles!: (value: RoleDTO[]) => void

    vi.spyOn(apiClient, "listRoles")
      .mockImplementationOnce(
        () => new Promise<RoleDTO[]>((res) => { resolveRest1Roles = res })
      )
      .mockImplementationOnce(
        () => new Promise<RoleDTO[]>((res) => { resolveRest2Roles = res })
      )

    const { rerender } = render(<RolesManager />)

    mockEffectiveRestaurantId = "rest-2"
    rerender(<RolesManager />)

    resolveRest2Roles([
      {
        id: "role-r2",
        restaurantId: "rest-2",
        name: "Hostess",
        description: "Recepción de mesas",
        permissions: ["tables.manage"],
        isSystem: false,
        createdAt: "2026-02-01T00:00:00Z",
        updatedAt: "2026-02-01T00:00:00Z",
      },
    ])

    await waitFor(() => expect(screen.getByText("Hostess")).toBeDefined())

    await act(async () => {
      resolveRest1Roles([...mockRoles])
    })

    expect(screen.getByText("Hostess")).toBeDefined()
    expect(screen.queryByText("Cajero")).toBeNull()
  })
})
