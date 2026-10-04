import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import { apiClient } from "@/core/api/apiClient"
import { CustomizerTablesSection } from "./CustomizerTablesSection"
import { TestQueryProvider } from "@/test/queryClientWrapper"

const t = (id: string, name: string, sortOrder = 0, isActive = true) => ({ id, name, sortOrder, isActive })

const renderSection = () => render(<CustomizerTablesSection restaurantId="rest-1" />, { wrapper: TestQueryProvider })

describe("CustomizerTablesSection", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
  })

  it("shows an empty state when the restaurant has no tables", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    renderSection()

    expect(await screen.findByText(/Todavía no tenés mesas/i)).toBeDefined()
  })

  it("lists the tables in order with their state", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1"), t("b", "Terraza", 1, false)])
    renderSection()

    expect(await screen.findByText("Mesa 1")).toBeDefined()
    expect(screen.getByText("Terraza")).toBeDefined()
    expect(screen.getByRole("switch", { name: /Activar Terraza/i }).getAttribute("aria-checked")).toBe("false")
    expect(screen.getByRole("switch", { name: /Activar Mesa 1/i }).getAttribute("aria-checked")).toBe("true")
  })

  it("creates a table from the name field and clears it", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    const create = vi.spyOn(apiClient, "createTable").mockResolvedValue(t("a", "Mesa 7"))
    renderSection()
    await screen.findByText(/Todavía no tenés mesas/i)

    const input = screen.getByLabelText(/Nombre de la nueva mesa/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: "  Mesa 7 " } })
    fireEvent.click(screen.getByRole("button", { name: /Agregar mesa/i }))

    await waitFor(() => expect(create).toHaveBeenCalledWith("Mesa 7", "rest-1"))
    expect(await screen.findByText("Mesa 7")).toBeDefined()
    expect(input.value).toBe("")
  })

  it("does not create a table with a blank name", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    const create = vi.spyOn(apiClient, "createTable")
    renderSection()
    await screen.findByText(/Todavía no tenés mesas/i)

    fireEvent.change(screen.getByLabelText(/Nombre de la nueva mesa/i), { target: { value: "   " } })
    fireEvent.click(screen.getByRole("button", { name: /Agregar mesa/i }))

    expect(create).not.toHaveBeenCalled()
  })

  it("renames a table inline", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    const update = vi.spyOn(apiClient, "updateTable").mockResolvedValue(t("a", "Barra"))
    renderSection()
    await screen.findByText("Mesa 1")

    fireEvent.click(screen.getByRole("button", { name: /Renombrar Mesa 1/i }))
    const input = screen.getByLabelText(/Nuevo nombre de Mesa 1/i)
    fireEvent.change(input, { target: { value: "Barra" } })
    fireEvent.click(screen.getByRole("button", { name: /Guardar nombre/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith("a", { name: "Barra" }, "rest-1"))
    expect(await screen.findByText("Barra")).toBeDefined()
  })

  it("deactivates a table with its switch", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    const update = vi.spyOn(apiClient, "updateTable").mockResolvedValue(t("a", "Mesa 1", 0, false))
    renderSection()
    await screen.findByText("Mesa 1")

    fireEvent.click(screen.getByRole("switch", { name: /Activar Mesa 1/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith("a", { isActive: false }, "rest-1"))
  })

  it("reorders with the arrows and disables them at the ends", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "A"), t("b", "B", 1)])
    const reorder = vi.spyOn(apiClient, "reorderTables").mockResolvedValue([t("b", "B"), t("a", "A", 1)])
    renderSection()
    await screen.findByText("A")

    expect((screen.getByRole("button", { name: /Subir A/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: /Bajar B/i }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: /Subir B/i }))

    await waitFor(() => expect(reorder).toHaveBeenCalledWith(["b", "a"], "rest-1"))
  })

  it("asks for confirmation before deleting and keeps the table when cancelled", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    const del = vi.spyOn(apiClient, "deleteTable").mockResolvedValue(undefined)
    renderSection()
    await screen.findByText("Mesa 1")

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Mesa 1/i }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/Mesa 1/)).toBeDefined()
    fireEvent.click(within(dialog).getByRole("button", { name: /Cancelar/i }))
    expect(del).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Mesa 1/i }))
    const again = await screen.findByRole("dialog")
    fireEvent.click(within(again).getByRole("button", { name: /Eliminar definitivamente/i }))

    await waitFor(() => expect(del).toHaveBeenCalledWith("a", "rest-1"))
    await waitFor(() => expect(screen.queryByText("Mesa 1")).toBeNull())
  })

  it("shows a retry when the tables cannot be loaded", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchTables").mockRejectedValueOnce(new Error("boom"))
    fetchSpy.mockResolvedValueOnce([t("a", "Mesa 1")])
    renderSection()

    fireEvent.click(await screen.findByRole("button", { name: /Reintentar/i }))

    expect(await screen.findByText("Mesa 1")).toBeDefined()
  })
})
