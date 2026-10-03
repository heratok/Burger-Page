import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { AuditLogScreen } from "./AuditLogScreen"
import { parseLocalDateRange } from "./auditLogUtils"
import { apiClient, type AuditLogItem } from "@/core/api/apiClient"

const mockRestaurant = {
  id: "rest-burger-craft",
  name: "Burger Craft",
  slug: "burger-craft",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  config: {
    name: "Burger Craft",
    tagline: "Hamburguesas artesanales premium",
    whatsappNumber: "573001234567",
    currency: "COP",
    currencySymbol: "$",
    deliveryFee: 5000,
    minOrderAmount: 20000,
    estimatedDeliveryTime: "30-45 min",
    schedule: [],
    timezone: "America/Bogota",
    ordersPaused: false,
    address: "Calle 123",
    primaryColor: "#FF7A21",
    primaryHoverColor: "#E06516",
    bgTheme: "dark-charcoal",
    fontFamily: "sans",
    cardRadius: "lg",
    cardStyle: "elevated",
    compactGrid: false,
    showBadges: true,
    logoUrl: "",
    bannerUrl: "",
    showBanner: false,
    announcementText: "",
    showAnnouncement: false,
  },
  products: [],
  categories: [],
  orders: [],
  additions: [],
  customers: [],
}

const mockAuditLogs: AuditLogItem[] = [
  {
    id: "aud-1",
    createdAt: "2026-10-02T10:30:00.000Z",
    actorUserId: "usr-super-1",
    actorUsername: "admin_super",
    action: "restaurant.update",
    targetType: "restaurant",
    targetId: "rest-burger-craft",
    targetLabel: "Burger Craft",
    restaurantId: "rest-burger-craft",
    details: {
      changedFields: ["name", "timezone"],
    },
  },
  {
    id: "aud-2",
    createdAt: "2026-10-02T09:15:00.000Z",
    actorUserId: "usr-super-1",
    actorUsername: "admin_super",
    action: "user.create",
    targetType: "user",
    targetId: "usr-manager-2",
    targetLabel: "manager_two",
    restaurantId: "rest-burger-craft",
    details: {
      role: "restaurant_admin",
    },
  },
]

describe("AuditLogScreen (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({
        version: 2,
        restaurants: [mockRestaurant],
      })
    )
    vi.clearAllMocks()
    vi.spyOn(apiClient, "fetchAuditLog").mockResolvedValue({
      items: mockAuditLogs,
      nextCursor: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("renders audit log screen with humanized actions, actor, target and formatted details", async () => {
    render(
      <RestaurantProvider>
        <AuditLogScreen />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Registro de Auditoría/i)).toBeDefined()

    await waitFor(() => {
      // Human-readable Spanish actions
      expect(screen.getAllByText("Actualización de restaurante").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Creación de usuario").length).toBeGreaterThan(0)
    })

    // Actor and target
    expect(screen.getAllByText("admin_super").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Burger Craft").length).toBeGreaterThan(0)

    // Formatted details (not raw JSON)
    expect(screen.getAllByText(/Modificado: nombre, zona horaria/i).length).toBeGreaterThan(0)
  })

  it("filters audit logs by action and restaurant", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchAuditLog").mockResolvedValue({
      items: [mockAuditLogs[0]],
      nextCursor: null,
    })

    render(
      <RestaurantProvider>
        <AuditLogScreen />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    // Filter by action
    const actionSelect = screen.getByLabelText(/Filtrar por acción/i)
    fireEvent.change(actionSelect, { target: { value: "restaurant.update" } })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "restaurant.update",
        })
      )
    })
  })

  it("supports pagination with 'Cargar más' button", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchAuditLog")
      .mockResolvedValueOnce({
        items: [mockAuditLogs[0]],
        nextCursor: "cursor-page-2",
      })
      .mockResolvedValueOnce({
        items: [mockAuditLogs[1]],
        nextCursor: null,
      })

    render(
      <RestaurantProvider>
        <AuditLogScreen />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cargar más/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole("button", { name: /Cargar más/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: "cursor-page-2",
        })
      )
    })
  })

  it("displays empty state when no audit records are found", async () => {
    vi.spyOn(apiClient, "fetchAuditLog").mockResolvedValue({
      items: [],
      nextCursor: null,
    })

    render(
      <RestaurantProvider>
        <AuditLogScreen />
      </RestaurantProvider>
    )

    expect(
      await screen.findByText(/No se encontraron registros de auditoría/i)
    ).toBeDefined()
  })

  it("displays error state with retry button on failure", async () => {
    vi.spyOn(apiClient, "fetchAuditLog").mockRejectedValue(new Error("Network Error"))

    render(
      <RestaurantProvider>
        <AuditLogScreen />
      </RestaurantProvider>
    )

    expect(
      await screen.findByText(/Ocurrió un error al cargar el registro de auditoría/i)
    ).toBeDefined()

    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeDefined()
  })

  it("builds local start-of-day and end-of-day ISO strings from date filters", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchAuditLog").mockResolvedValue({
      items: [],
      nextCursor: null,
    })

    render(
      <RestaurantProvider>
        <AuditLogScreen />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    const fromInput = screen.getByLabelText(/Fecha desde/i)
    const toInput = screen.getByLabelText(/Fecha hasta/i)

    fireEvent.change(fromInput, { target: { value: "2026-10-02" } })
    fireEvent.change(toInput, { target: { value: "2026-10-02" } })

    const expectedFrom = new Date(2026, 9, 2, 0, 0, 0, 0).toISOString()
    const expectedTo = new Date(2026, 9, 2, 23, 59, 59, 999).toISOString()

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expectedFrom,
          to: expectedTo,
        })
      )
    })
  })

  it("guards against stale responses overwriting list when filter changes rapidly", async () => {
    let resolveFirst: (value: any) => void
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })

    vi.spyOn(apiClient, "fetchAuditLog")
      .mockReturnValueOnce(firstPromise as any)
      .mockResolvedValueOnce({
        items: [mockAuditLogs[1]], // user.create
        nextCursor: null,
      })

    render(
      <RestaurantProvider>
        <AuditLogScreen />
      </RestaurantProvider>
    )

    // Initial load triggered firstPromise (in flight)
    // Now user quickly changes action filter
    const actionSelect = screen.getByLabelText(/Filtrar por acción/i)
    fireEvent.change(actionSelect, { target: { value: "user.create" } })

    // Second call resolves immediately with mockAuditLogs[1]
    await waitFor(() => {
      expect(screen.getAllByText("Creación de usuario").length).toBeGreaterThan(0)
    })

    // Now first (stale) call resolves with restaurant.update
    resolveFirst!({
      items: [mockAuditLogs[0]], // restaurant.update
      nextCursor: null,
    })

    // Give microtasks time to execute
    await new Promise((r) => setTimeout(r, 50))

    // The list must still show the second result, not overwritten by stale first result
    const table = screen.getByRole("table")
    expect(within(table).getByText("Creación de usuario")).toBeDefined()
    expect(within(table).queryByText("Actualización de restaurante")).toBeNull()
  })

  it("guards against stale 'Cargar más' pagination responses when filter changes", async () => {
    let resolvePagination: (value: any) => void
    const paginationPromise = new Promise((resolve) => {
      resolvePagination = resolve
    })

    vi.spyOn(apiClient, "fetchAuditLog")
      .mockResolvedValueOnce({
        items: [mockAuditLogs[0]],
        nextCursor: "cursor-1",
      })
      .mockReturnValueOnce(paginationPromise as any)
      .mockResolvedValueOnce({
        items: [mockAuditLogs[1]],
        nextCursor: null,
      })

    render(
      <RestaurantProvider>
        <AuditLogScreen />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cargar más/i })).toBeDefined()
    })

    // Click Cargar más (starts in-flight pagination request)
    fireEvent.click(screen.getByRole("button", { name: /Cargar más/i }))

    // User changes filter while pagination is in flight
    const actionSelect = screen.getByLabelText(/Filtrar por acción/i)
    fireEvent.change(actionSelect, { target: { value: "user.create" } })

    await waitFor(() => {
      const table = screen.getByRole("table")
      expect(within(table).getByText("Creación de usuario")).toBeDefined()
    })

    // Now pagination from old filter resolves
    resolvePagination!({
      items: [{ ...mockAuditLogs[0], id: "old-paginated-item", targetLabel: "Old Restaurant" }],
      nextCursor: null,
    })

    await new Promise((r) => setTimeout(r, 50))

    // The old paginated item must NOT be appended to the new filter list
    const table = screen.getByRole("table")
    expect(within(table).queryByText("Old Restaurant")).toBeNull()
  })
})

describe("parseLocalDateRange", () => {
  it("returns undefined for empty or invalid strings", () => {
    expect(parseLocalDateRange("", false)).toBeUndefined()
    expect(parseLocalDateRange("invalid", false)).toBeUndefined()
    expect(parseLocalDateRange("2026-10", false)).toBeUndefined()
  })

  it("constructs local start of day (00:00:00.000) preserving local calendar day", () => {
    const iso = parseLocalDateRange("2026-10-02", false)!
    const d = new Date(iso)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9) // 0-indexed October
    expect(d.getDate()).toBe(2)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })

  it("constructs local end of day (23:59:59.999) preserving local calendar day", () => {
    const iso = parseLocalDateRange("2026-10-02", true)!
    const d = new Date(iso)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9) // 0-indexed October
    expect(d.getDate()).toBe(2)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
    expect(d.getSeconds()).toBe(59)
    expect(d.getMilliseconds()).toBe(999)
  })
})

