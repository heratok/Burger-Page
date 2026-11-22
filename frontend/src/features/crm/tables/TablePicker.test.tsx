import { describe, it, expect, vi } from "vitest"
import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TablePicker, type TablePickerProps } from "./TablePicker"

const t = (id: string, name: string, sortOrder = 0, isActive = true) => {
  const match = /^(.*?)\s*(\d+)$/.exec(name)
  return { id, zone: match ? match[1] : name, number: match ? Number(match[2]) : 1, alias: null, name, sortOrder, isActive }
}

const setup = (over: Partial<TablePickerProps> = {}) => {
  const props: TablePickerProps = {
    isDark: false,
    tables: [t("a", "Mesa 1"), t("b", "Mesa 2", 1), t("c", "Barra", 2, false)],
    isLoading: false,
    loadError: null,
    selectedTableId: null,
    occupiedTableIds: new Set<string>(),
    onSelect: vi.fn(),
    onCreateTable: vi.fn().mockResolvedValue(null),
    onOpenManager: vi.fn(),
    ...over,
  }
  render(<TablePicker {...props} />)
  return props
}

describe("TablePicker", () => {
  it("shows only the active tables as selectable buttons", () => {
    setup()

    expect(screen.getByRole("button", { name: /Mesa 1/ })).toBeDefined()
    expect(screen.getByRole("button", { name: /Mesa 2/ })).toBeDefined()
    expect(screen.queryByRole("button", { name: /Barra/ })).toBeNull()
  })

  it("lets a long table name wrap onto two lines instead of cutting it to one", () => {
    const longName = "Salón 20 · Ventana grande"
    setup({ tables: [{ ...t("a", "Salón 20"), alias: "Ventana grande", name: longName }] })

    const label = screen.getByText(longName)
    expect(label.className).toContain("line-clamp-2")
    expect(label.className).not.toContain("line-clamp-1")
  })

  it("selects a table and marks the selected one as pressed", () => {
    const props = setup({ selectedTableId: "b" })

    expect(screen.getByRole("button", { name: /Mesa 2/ }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: /Mesa 1/ }).getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(screen.getByRole("button", { name: /Mesa 1/ }))
    expect(props.onSelect).toHaveBeenCalledWith("a")
  })

  it("marks occupied tables with a badge but keeps them selectable", () => {
    const props = setup({ occupiedTableIds: new Set(["a"]) })

    expect(screen.getAllByText("Ocupada")).toHaveLength(1)
    const occupied = screen.getByRole("button", { name: /Mesa 1.*Ocupada/ })
    fireEvent.click(occupied)
    expect(props.onSelect).toHaveBeenCalledWith("a")
  })

  it("groups the active tables under a header per zone", () => {
    setup({ tables: [t("a", "Salón 1"), t("b", "Terraza 1", 1), t("c", "Salón 2", 2)] })

    const headers = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)
    expect(headers).toEqual(["Salón", "Terraza"])
    expect(screen.getByRole("button", { name: /Salón 2/ })).toBeDefined()
  })

  it("prefills the inline form with the most used zone and its next free number", () => {
    setup({ tables: [t("a", "Salón 1"), t("b", "Terraza 1", 1), t("c", "Terraza 2", 2)] })

    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva mesa/i }))

    expect((screen.getByLabelText(/Zona de la nueva mesa/i) as HTMLInputElement).value).toBe("Terraza")
    expect((screen.getByLabelText(/Número de la nueva mesa/i) as HTMLInputElement).value).toBe("3")
  })

  it("recomputes the suggested number when the zone changes", () => {
    setup({ tables: [t("a", "Salón 1"), t("b", "Terraza 1", 1), t("c", "Terraza 2", 2)] })

    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva mesa/i }))
    fireEvent.change(screen.getByLabelText(/Zona de la nueva mesa/i), { target: { value: "Salón" } })

    expect((screen.getByLabelText(/Número de la nueva mesa/i) as HTMLInputElement).value).toBe("2")
  })

  it("lets the user create a table inline and selects it", async () => {
    const onCreateTable = vi.fn().mockResolvedValue(t("n", "Mesa 9", 3))
    const props = setup({ onCreateTable })

    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva mesa/i }))
    fireEvent.change(screen.getByLabelText(/Zona de la nueva mesa/i), { target: { value: " Barra " } })
    fireEvent.change(screen.getByLabelText(/Número de la nueva mesa/i), { target: { value: "9" } })
    expect(screen.getByText("Se creará: Barra 9")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: /^Crear$/i }))

    await waitFor(() => expect(onCreateTable).toHaveBeenCalledWith({ zone: "Barra", number: 9 }))
    await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith("n"))
  })

  it("does not create with an invalid number", () => {
    const onCreateTable = vi.fn()
    setup({ onCreateTable })

    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva mesa/i }))
    fireEvent.change(screen.getByLabelText(/Número de la nueva mesa/i), { target: { value: "0" } })

    expect((screen.getByRole("button", { name: /^Crear$/i }) as HTMLButtonElement).disabled).toBe(true)
    expect(onCreateTable).not.toHaveBeenCalled()
  })

  it("keeps the inline form open when the creation is rejected", async () => {
    const onCreateTable = vi.fn().mockResolvedValue(null)
    const props = setup({ onCreateTable })

    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva mesa/i }))
    fireEvent.change(screen.getByLabelText(/Número de la nueva mesa/i), { target: { value: "1" } })
    fireEvent.click(screen.getByRole("button", { name: /^Crear$/i }))

    await waitFor(() => expect(onCreateTable).toHaveBeenCalled())
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Zona de la nueva mesa/i)).toBeDefined()
  })

  it("shows an empty state with the way to the manager when there are no active tables", () => {
    const props = setup({ tables: [t("c", "Barra", 0, false)] })

    expect(screen.getByText(/No hay mesas activas/i)).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: /Personalizar → Mesas/i }))
    expect(props.onOpenManager).toHaveBeenCalled()
  })

  it("shows the legacy table text of an old order that has no table selected", () => {
    setup({ legacyLabel: "Mesa 8" })

    expect(screen.getByText(/Mesa 8/)).toBeDefined()
    expect(screen.getByText(/Registrada antes de las mesas/i)).toBeDefined()
  })

  it("reports a loading state and a load error", () => {
    const { unmount } = render(
      <TablePicker
        isDark={false}
        tables={[]}
        isLoading
        loadError={null}
        selectedTableId={null}
        occupiedTableIds={new Set()}
        onSelect={() => {}}
        onCreateTable={async () => null}
        onOpenManager={() => {}}
      />
    )
    // The picker reserves the shape of its own content — a compact grid of
    // table pills inside the scrolling slot — not a full data-table card.
    expect(screen.getByTestId("table-pill-skeleton")).toBeDefined()
    expect(screen.queryByTestId("table-skeleton")).toBeNull()
    expect(screen.queryByText(/Cargando mesas/i)).toBeNull()
    unmount()
    setup({ tables: [], loadError: "boom" })
    expect(screen.getByText(/boom/)).toBeDefined()
  })

  it("keeps the empty state distinct from the loading state", () => {
    const { unmount } = render(
      <TablePicker
        isDark={false}
        tables={[]}
        isLoading
        loadError={null}
        selectedTableId={null}
        occupiedTableIds={new Set()}
        onSelect={() => {}}
        onCreateTable={async () => null}
        onOpenManager={() => {}}
      />
    )

    expect(screen.getByTestId("table-pill-skeleton")).toBeDefined()
    expect(screen.queryByText(/No hay mesas activas/i)).toBeNull()
    unmount()

    // Once the read settles without tables, the empty state is the only resort.
    setup({ tables: [] })
    expect(screen.getByText(/No hay mesas activas/i)).toBeDefined()
    expect(screen.queryByTestId("table-pill-skeleton")).toBeNull()
  })

  // S15 — the placeholder must be the loader for *this* field: a short grid of
  // pill slots at the same spacing as the real buttons, inside the same
  // max-h-44 scroller, so the form does not grow by a fake 230-260px table.
  it("reserves the compact pill grid instead of a full data table", () => {
    const { unmount } = render(
      <TablePicker
        isDark={false}
        tables={[]}
        isLoading
        loadError={null}
        selectedTableId={null}
        occupiedTableIds={new Set()}
        onSelect={() => {}}
        onCreateTable={async () => null}
        onOpenManager={() => {}}
      />
    )

    const placeholder = screen.getByTestId("table-pill-skeleton")
    // Same scroll box as the settled list.
    expect(placeholder.className).toContain("max-h-44")
    expect(placeholder.className).toContain("overflow-y-auto")

    const grid = placeholder.querySelector<HTMLElement>('[data-slot="pill-grid"]')
    expect(grid).not.toBeNull()
    expect(grid!.className).toContain("grid-cols-3")
    expect(grid!.className).toContain("sm:grid-cols-4")

    const slots = Array.from(grid!.children) as HTMLElement[]
    expect(slots.length).toBeGreaterThanOrEqual(6)
    expect(slots.length).toBeLessThanOrEqual(12)

    // A data table (search bar + thead) is never the right shape for this slot.
    expect(placeholder.querySelector("table")).toBeNull()

    // The zone heading placeholder reserves the real heading's 16px line box
    // (text-xs), so the scroller does not nudge when the zones land.
    const zoneLabel = placeholder.querySelector<HTMLElement>(".space-y-1 > div:first-child")
    expect(zoneLabel!.className).toContain("h-4")
    expect(zoneLabel!.className).not.toContain("h-3")

    unmount()
  })

  // S15 residual — `h-10` slots (40px) reserved less than the real pill, whose
  // two-line name grows it past 40px, so the field still jumped ~14px when the
  // tables landed. The slots must carry the real pill's own box: the same floor,
  // the same padding and two reserved text lines.
  it("reserves the real pill's height behaviour so the field does not resize when tables land", () => {
    const { unmount } = render(
      <TablePicker
        isDark={false}
        tables={[]}
        isLoading
        loadError={null}
        selectedTableId={null}
        occupiedTableIds={new Set()}
        onSelect={() => {}}
        onCreateTable={async () => null}
        onOpenManager={() => {}}
      />
    )

    const grid = screen
      .getByTestId("table-pill-skeleton")
      .querySelector<HTMLElement>('[data-slot="pill-grid"]')!
    const slots = Array.from(grid.children) as HTMLElement[]
    expect(slots.length).toBeGreaterThan(0)

    for (const slot of slots) {
      const classes = new Set(slot.className.split(/\s+/).filter(Boolean))
      // No fixed 40px box: the real pill is a min-height button, not a fixed tile.
      expect(classes.has("h-10")).toBe(false)
      expect(classes.has("min-h-10")).toBe(true)
      // The same box the real pill uses (padding, border, radius).
      expect(classes.has("px-1.5")).toBe(true)
      expect(classes.has("py-1")).toBe(true)
      expect(classes.has("rounded-lg")).toBe(true)
      expect(classes.has("border")).toBe(true)
      // Two text lines are reserved, so a wrapped table name cannot grow it.
      expect(slot.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(2)
    }

    unmount()

    // The reference: the settled pill really is the box the slots reserve, and a
    // change to either side has to be made on both.
    setup({ tables: [t("a", "Mesa 1"), t("b", "Mesa 2", 1)] })
    const pill = screen.getByRole("button", { name: /Mesa 1/ })
    const pillClasses = new Set(pill.className.split(/\s+/).filter(Boolean))
    for (const token of ["min-h-10", "px-1.5", "py-1", "rounded-lg"]) {
      expect(pillClasses.has(token), `real pill lost ${token}`).toBe(true)
    }
    expect(pillClasses.has("h-10")).toBe(false)
  })
})

describe("TablePicker inside a parent form", () => {
  const renderInForm = (onCreateTable = vi.fn().mockResolvedValue(t("n", "Barra 1", 3))) => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const onSelect = vi.fn()
    const { container } = render(
      <form onSubmit={onSubmit}>
        <TablePicker
          isDark={false}
          tables={[t("a", "Mesa 1")]}
          isLoading={false}
          loadError={null}
          selectedTableId={null}
          occupiedTableIds={new Set()}
          onSelect={onSelect}
          onCreateTable={onCreateTable}
          onOpenManager={() => {}}
        />
      </form>
    )
    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva mesa/i }))
    fireEvent.change(screen.getByLabelText(/Zona de la nueva mesa/i), { target: { value: "Barra" } })
    fireEvent.change(screen.getByLabelText(/Número de la nueva mesa/i), { target: { value: "1" } })
    return { container, onSubmit, onSelect, onCreateTable }
  }

  it("never nests a form inside the parent form", () => {
    const { container } = renderInForm()
    expect(container.querySelectorAll("form form")).toHaveLength(0)
    expect(container.querySelectorAll("form")).toHaveLength(1)
  })

  it("creates with the Crear button without submitting the parent form", async () => {
    const { onSubmit, onSelect, onCreateTable } = renderInForm()

    fireEvent.click(screen.getByRole("button", { name: /^Crear$/i }))

    await waitFor(() => expect(onCreateTable).toHaveBeenCalledWith({ zone: "Barra", number: 1 }))
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("n"))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("creates with Enter without submitting the parent form", async () => {
    const { onSubmit, onSelect, onCreateTable } = renderInForm()

    const input = screen.getByLabelText(/Número de la nueva mesa/i)
    const notPrevented = fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => expect(onCreateTable).toHaveBeenCalledWith({ zone: "Barra", number: 1 }))
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("n"))
    expect(notPrevented).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("cancels with Escape without closing anything else and returns focus to the add button", async () => {
    renderInForm()
    const input = screen.getByLabelText(/Zona de la nueva mesa/i)
    const stop = vi.fn()
    document.addEventListener("keydown", stop)

    fireEvent.keyDown(input, { key: "Escape" })
    document.removeEventListener("keydown", stop)

    expect(screen.queryByLabelText(/Zona de la nueva mesa/i)).toBeNull()
    expect(stop).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /\+ Nueva mesa/i })))
  })
})
