import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import { apiClient } from "@/core/api/apiClient"
import { CustomizerTablesSection } from "./CustomizerTablesSection"
import { TestQueryProvider } from "@/test/queryClientWrapper"

const t = (id: string, name: string, sortOrder = 0, isActive = true) => {
  const match = /^(.*?)\s*(\d+)$/.exec(name)
  return { id, zone: match ? match[1] : name, number: match ? Number(match[2]) : 1, alias: null, name, sortOrder, isActive }
}

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

  it("lists the tables grouped by zone with their state", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([
      t("a", "Salón 1"),
      t("b", "Terraza 1", 1, false),
      t("c", "Salón 2", 2),
    ])
    renderSection()

    expect(await screen.findByText("Salón 1")).toBeDefined()
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["Salón", "Terraza"])
    expect(screen.getByRole("switch", { name: /Activar Terraza 1/i }).getAttribute("aria-checked")).toBe("false")
    expect(screen.getByRole("switch", { name: /Activar Salón 1/i }).getAttribute("aria-checked")).toBe("true")
  })

  it("defaults to Salón and number 1 when there are no tables, and previews the name", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    renderSection()
    await screen.findByText(/Todavía no tenés mesas/i)

    expect((screen.getByLabelText(/Zona de la nueva mesa/i) as HTMLInputElement).value).toBe("Salón")
    expect((screen.getByLabelText(/Número de la nueva mesa/i) as HTMLInputElement).value).toBe("1")
    expect(screen.getByText("Se creará: Salón 1")).toBeDefined()
  })

  it("suggests the most used zone and its next free number, recomputed when the zone changes", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1"), t("b", "Mesa 2", 1), t("c", "Barra 1", 2)])
    renderSection()
    await screen.findByText("Mesa 1")

    const zone = screen.getByLabelText(/Zona de la nueva mesa/i) as HTMLInputElement
    const number = screen.getByLabelText(/Número de la nueva mesa/i) as HTMLInputElement
    expect(zone.value).toBe("Mesa")
    expect(number.value).toBe("3")

    fireEvent.change(zone, { target: { value: "barra" } })
    expect(number.value).toBe("2")
    fireEvent.change(zone, { target: { value: "Terraza" } })
    expect(number.value).toBe("1")
  })

  it("offers the existing zones as suggestions", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1"), t("b", "Barra 1", 1)])
    const { container } = renderSection()
    await screen.findByText("Mesa 1")

    const options = [...container.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"))
    expect(options).toEqual(["Mesa", "Barra"])
  })

  it("creates a table from zone, number and alias and refreshes the suggested number", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    const create = vi
      .spyOn(apiClient, "createTable")
      .mockResolvedValue({ ...t("a", "Terraza 5"), alias: "VIP", name: "Terraza 5 · VIP" })
    renderSection()
    await screen.findByText(/Todavía no tenés mesas/i)

    fireEvent.change(screen.getByLabelText(/Zona de la nueva mesa/i), { target: { value: " terraza " } })
    fireEvent.change(screen.getByLabelText(/Número de la nueva mesa/i), { target: { value: "5" } })
    fireEvent.change(screen.getByLabelText(/Alias de la nueva mesa/i), { target: { value: " VIP " } })
    expect(screen.getByText("Se creará: Terraza 5 · VIP")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: /Agregar mesa/i }))

    await waitFor(() => expect(create).toHaveBeenCalledWith({ zone: "Terraza", number: 5, alias: "VIP" }, "rest-1"))
    expect(await screen.findByText("Terraza 5 · VIP")).toBeDefined()
    expect((screen.getByLabelText(/Alias de la nueva mesa/i) as HTMLInputElement).value).toBe("")
    expect((screen.getByLabelText(/Número de la nueva mesa/i) as HTMLInputElement).value).toBe("1")
  })

  it("does not create a table without a zone or with an invalid number", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    const create = vi.spyOn(apiClient, "createTable")
    renderSection()
    await screen.findByText(/Todavía no tenés mesas/i)
    const add = screen.getByRole("button", { name: /Agregar mesa/i }) as HTMLButtonElement

    fireEvent.change(screen.getByLabelText(/Zona de la nueva mesa/i), { target: { value: "   " } })
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Zona de la nueva mesa/i), { target: { value: "Barra" } })
    fireEvent.change(screen.getByLabelText(/Número de la nueva mesa/i), { target: { value: "0" } })
    expect(add.disabled).toBe(true)
    fireEvent.click(add)

    expect(create).not.toHaveBeenCalled()
  })

  it("creates a range of tables and reports how many were created and skipped", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    const bulk = vi.spyOn(apiClient, "createTablesBulk").mockResolvedValue({
      created: [t("a", "Terraza 1"), t("b", "Terraza 2", 1)],
      skipped: [3, 4],
    })
    renderSection()
    await screen.findByText(/Todavía no tenés mesas/i)

    fireEvent.click(screen.getByRole("button", { name: /Crear varias/i }))
    expect(screen.queryByRole("button", { name: /Agregar mesa/i })).toBeNull()
    fireEvent.change(screen.getByLabelText(/Zona de las nuevas mesas/i), { target: { value: "terraza" } })
    fireEvent.change(screen.getByLabelText(/Desde el número/i), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText(/Hasta el número/i), { target: { value: "10" } })
    expect(screen.getByText("Se crearán Terraza 1 a Terraza 10")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: /Crear mesas/i }))

    await waitFor(() => expect(bulk).toHaveBeenCalledWith({ zone: "Terraza", from: 1, to: 10 }, "rest-1"))
    const status = await screen.findByRole("status")
    expect(status.textContent).toMatch(/Se crearon 2 mesas/)
    expect(status.textContent).toMatch(/Se omitieron 2.*3, 4/)
  })

  it("blocks a range that is reversed or longer than 100 tables", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    const bulk = vi.spyOn(apiClient, "createTablesBulk")
    renderSection()
    await screen.findByText(/Todavía no tenés mesas/i)

    fireEvent.click(screen.getByRole("button", { name: /Crear varias/i }))
    const submit = screen.getByRole("button", { name: /Crear mesas/i }) as HTMLButtonElement
    fireEvent.change(screen.getByLabelText(/Desde el número/i), { target: { value: "5" } })
    fireEvent.change(screen.getByLabelText(/Hasta el número/i), { target: { value: "2" } })
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Desde el número/i), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText(/Hasta el número/i), { target: { value: "101" } })
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)

    expect(bulk).not.toHaveBeenCalled()
  })

  it("goes back to creating a single table", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    renderSection()
    await screen.findByText(/Todavía no tenés mesas/i)

    fireEvent.click(screen.getByRole("button", { name: /Crear varias/i }))
    fireEvent.click(screen.getByRole("button", { name: /Crear una sola/i }))

    expect(screen.getByRole("button", { name: /Agregar mesa/i })).toBeDefined()
  })

  it("edits the zone, number and alias of a table inline sending only what changed", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([{ ...t("a", "Mesa 1"), alias: "ventana", name: "Mesa 1 · ventana" }])
    const update = vi.spyOn(apiClient, "updateTable").mockResolvedValue(t("a", "Barra 4"))
    renderSection()
    await screen.findByText("Mesa 1 · ventana")

    fireEvent.click(screen.getByRole("button", { name: /Editar Mesa 1 · ventana/i }))
    fireEvent.change(screen.getByLabelText(/^Zona de Mesa 1/i), { target: { value: "barra" } })
    fireEvent.change(screen.getByLabelText(/^Número de Mesa 1/i), { target: { value: "4" } })
    fireEvent.change(screen.getByLabelText(/^Alias de Mesa 1/i), { target: { value: "  " } })
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith("a", { zone: "Barra", number: 4, alias: null }, "rest-1"))
    expect(await screen.findByText("Barra 4")).toBeDefined()
  })

  it("keeps a long table name readable on narrow screens instead of truncating it", async () => {
    const longName = "Zona de eventos privados 12 · Reservado familia Rodríguez"
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([
      { ...t("a", "Zona de eventos privados 12"), alias: "Reservado familia Rodríguez", name: longName },
    ])
    renderSection()

    const name = await screen.findByText(longName)
    expect(name.className).not.toContain("truncate")
  })

  it("gives the zone its own full-width row while editing so it is not squeezed on phones", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    renderSection()
    await screen.findByText("Mesa 1")

    fireEvent.click(screen.getByRole("button", { name: /Editar Mesa 1/i }))

    expect(screen.getByLabelText(/^Zona de Mesa 1/i).className).toContain("basis-full")
  })

  it("closes the editor without calling the API when nothing changed", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    const update = vi.spyOn(apiClient, "updateTable")
    renderSection()
    await screen.findByText("Mesa 1")

    fireEvent.click(screen.getByRole("button", { name: /Editar Mesa 1/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }))

    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/^Zona de Mesa 1/i)).toBeNull()
  })

  it("deactivates a table with its switch", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    const update = vi.spyOn(apiClient, "updateTable").mockResolvedValue(t("a", "Mesa 1", 0, false))
    renderSection()
    await screen.findByText("Mesa 1")

    fireEvent.click(screen.getByRole("switch", { name: /Activar Mesa 1/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith("a", { isActive: false }, "rest-1"))
  })

  it("reorders inside a zone with the arrows and disables them at the zone ends", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1"), t("x", "Barra 1", 1), t("b", "Mesa 2", 2)])
    const reorder = vi
      .spyOn(apiClient, "reorderTables")
      .mockResolvedValue([t("b", "Mesa 2"), t("x", "Barra 1", 1), t("a", "Mesa 1", 2)])
    renderSection()
    await screen.findByText("Mesa 1")

    expect((screen.getByRole("button", { name: /Subir Mesa 1/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: /Bajar Mesa 2/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: /Subir Barra 1/i }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: /Subir Mesa 2/i }))

    await waitFor(() => expect(reorder).toHaveBeenCalledWith(["b", "x", "a"], "rest-1"))
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
