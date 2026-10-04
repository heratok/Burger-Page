import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { AuditLogScreen } from "../AuditLogScreen"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient, type AuditLogItem } from "@/core/api/apiClient"

const item = (id: string, action: AuditLogItem["action"], targetLabel: string): AuditLogItem => ({
  id,
  createdAt: "2026-10-01T10:00:00.000Z",
  actorUserId: "usr-1",
  actorUsername: "admin_super",
  action,
  targetType: "restaurant",
  targetId: id,
  targetLabel,
  restaurantId: null,
  details: {},
} as AuditLogItem)

const inTable = () => within(screen.getByRole("table"))
const findInTable = (text: string) => waitFor(() => inTable().getByText(text))

const renderScreen = () =>
  render(
    <RestaurantProvider>
      <AuditLogScreen />
    </RestaurantProvider>
  )

describe("AuditLogScreen server state (infinite query)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("reuses the cached pages on remount instead of fetching again", async () => {
    const fetchSpy = vi
      .spyOn(apiClient, "fetchAuditLog")
      .mockResolvedValue({ items: [item("a1", "restaurant.update", "First Target")], nextCursor: null })

    const first = renderScreen()
    expect(await findInTable("First Target")).toBeDefined()
    first.unmount()

    renderScreen()
    expect(inTable().getByText("First Target")).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("serves a previously visited filter from the cache", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchAuditLog").mockImplementation(async (query) => ({
      items:
        query?.action === "user.create"
          ? [item("u1", "user.create", "User Target")]
          : [item("a1", "restaurant.update", "All Target")],
      nextCursor: null,
    }))

    renderScreen()
    await findInTable("All Target")
    const select = screen.getByLabelText(/Filtrar por acción/i)

    fireEvent.change(select, { target: { value: "user.create" } })
    await findInTable("User Target")
    fireEvent.change(select, { target: { value: "" } })

    expect(inTable().getByText("All Target")).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("requests 25 items per page and passes the cursor as the page param", async () => {
    const fetchSpy = vi
      .spyOn(apiClient, "fetchAuditLog")
      .mockResolvedValueOnce({ items: [item("a1", "restaurant.update", "Page One")], nextCursor: "c-2" })
      .mockResolvedValueOnce({ items: [item("a2", "restaurant.update", "Page Two")], nextCursor: null })

    renderScreen()
    fireEvent.click(await screen.findByRole("button", { name: /Cargar más/i }))

    expect(await findInTable("Page Two")).toBeDefined()
    expect(inTable().getByText("Page One")).toBeDefined()
    expect(fetchSpy).toHaveBeenNthCalledWith(1, { limit: 25 })
    expect(fetchSpy).toHaveBeenNthCalledWith(2, { limit: 25, cursor: "c-2" })
  })

  it("'Actualizar' reloads from the first page only", async () => {
    const fetchSpy = vi
      .spyOn(apiClient, "fetchAuditLog")
      .mockResolvedValueOnce({ items: [item("a1", "restaurant.update", "Page One")], nextCursor: "c-2" })
      .mockResolvedValueOnce({ items: [item("a2", "restaurant.update", "Page Two")], nextCursor: null })
      .mockResolvedValue({ items: [item("a3", "restaurant.update", "Fresh One")], nextCursor: null })

    renderScreen()
    fireEvent.click(await screen.findByRole("button", { name: /Cargar más/i }))
    await findInTable("Page Two")

    fireEvent.click(screen.getByRole("button", { name: /Actualizar/i }))

    expect(await findInTable("Fresh One")).toBeDefined()
    expect(inTable().queryByText("Page Two")).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(fetchSpy).toHaveBeenLastCalledWith({ limit: 25 })
  })
})
