import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { Select } from "./select"
import { Filter } from "lucide-react"

describe("Select UI Component", () => {
  it("renders with options array correctly", () => {
    const options = [
      { value: "opt-1", label: "Opción 1" },
      { value: "opt-2", label: "Opción 2" },
    ]

    render(
      <Select
        aria-label="Selector de prueba"
        options={options}
        defaultValue="opt-1"
      />
    )

    const selectEl = screen.getByRole("combobox", { name: "Selector de prueba" })
    expect(selectEl).toBeDefined()
    expect(screen.getAllByText("Opción 1").length).toBeGreaterThan(0)
    expect(screen.getByText("Opción 2")).toBeDefined()
  })

  it("renders optgroups properly when grouped options are provided", () => {
    const groupedOptions = [
      {
        label: "Grupo A",
        options: [
          { value: "a1", label: "Elemento A1" },
          { value: "a2", label: "Elemento A2" },
        ],
      },
      {
        label: "Grupo B",
        options: [{ value: "b1", label: "Elemento B1" }],
      },
    ]

    render(
      <Select
        aria-label="Selector agrupado"
        options={groupedOptions}
      />
    )

    expect(screen.getByText("Elemento A1")).toBeDefined()
    expect(screen.getByText("Elemento B1")).toBeDefined()
  })

  it("handles onChange event when selecting an option", () => {
    const handleChange = vi.fn()
    const options = [
      { value: "first", label: "Primero" },
      { value: "second", label: "Segundo" },
    ]

    render(
      <Select
        aria-label="Selector interactivo"
        options={options}
        onChange={handleChange}
        defaultValue="first"
      />
    )

    const selectEl = screen.getByRole("combobox", { name: "Selector interactivo" })
    fireEvent.change(selectEl, { target: { value: "second" } })

    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it("renders with leftIcon, label, and error state", () => {
    render(
      <Select
        label="Categoría"
        error="Campo requerido"
        leftIcon={<Filter data-testid="filter-icon" />}
        options={[{ value: "val1", label: "Valor 1" }]}
      />
    )

    expect(screen.getByText("Categoría")).toBeDefined()
    expect(screen.getByText("Campo requerido")).toBeDefined()
    expect(screen.getByTestId("filter-icon")).toBeDefined()
  })

  it("renders children directly if options prop is not passed", () => {
    render(
      <Select aria-label="Selector con children">
        <option value="1">Uno</option>
        <option value="2">Dos</option>
      </Select>
    )

    expect(screen.getByRole("combobox", { name: "Selector con children" })).toBeDefined()
    expect(screen.getByText("Uno")).toBeDefined()
  })

  it("dispatches synthetic event with target and currentTarget containing value, name, and id on dropdown selection", () => {
    let capturedEvent: any = null
    const handleChange = vi.fn((e) => {
      capturedEvent = e
    })

    const options = [
      { value: "opt-a", label: "Opción A" },
      { value: "opt-b", label: "Opción B" },
    ]

    render(
      <Select
        id="custom-select-id"
        name="custom-select-name"
        aria-label="Selector Evento"
        options={options}
        defaultValue="opt-a"
        onChange={handleChange}
      />
    )

    // Open dropdown and select Option B
    const trigger = screen.getByTestId("custom-select-id-trigger")
    fireEvent.click(trigger)

    const menu = screen.getByTestId("custom-select-id-menu")
    fireEvent.click(within(menu).getByRole("option", { name: "Opción B" }))

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(capturedEvent).not.toBeNull()
    expect(capturedEvent.target.value).toBe("opt-b")
    expect(capturedEvent.target.name).toBe("custom-select-name")
    expect(capturedEvent.target.id).toBe("custom-select-id")
    expect(capturedEvent.currentTarget.value).toBe("opt-b")
    expect(capturedEvent.currentTarget.name).toBe("custom-select-name")
    expect(capturedEvent.currentTarget.id).toBe("custom-select-id")
  })

  it("forwards ref, disabled, required, and name to hidden select", () => {
    let selectElement: HTMLSelectElement | null = null
    const refCallback = (el: HTMLSelectElement | null) => {
      selectElement = el
    }

    render(
      <Select
        ref={refCallback}
        id="prop-forwarding"
        name="field_name"
        disabled
        required
        aria-label="Forwarding Test"
        options={[{ value: "1", label: "Uno" }]}
      />
    )

    const el = selectElement as HTMLSelectElement | null
    expect(el).not.toBeNull()
    expect(el?.name).toBe("field_name")
    expect(el?.required).toBe(true)
    expect(el?.disabled).toBe(true)
  })
})
