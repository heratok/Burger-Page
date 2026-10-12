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
    expect(screen.getByText(/Cargando mesas/i)).toBeDefined()
    unmount()
    setup({ tables: [], loadError: "boom" })
    expect(screen.getByText(/boom/)).toBeDefined()
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
