import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
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
    expect(screen.getByText("Opción 1")).toBeDefined()
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
})
