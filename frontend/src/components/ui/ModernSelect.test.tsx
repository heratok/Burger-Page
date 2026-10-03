import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import { ModernSelect, type ModernSelectOption } from "./ModernSelect"

const SAMPLE_OPTIONS: ModernSelectOption[] = [
  { value: "57", label: "Colombia", badge: "+57", flagCode: "CO", group: "Sudamérica" },
  { value: "54", label: "Argentina", badge: "+54", flagCode: "AR", group: "Sudamérica" },
  { value: "56", label: "Chile", badge: "+56", flagCode: "CL", group: "Sudamérica", disabled: true },
  { value: "52", label: "México", badge: "+52", flagCode: "MX", group: "Norteamérica" },
  { value: "1", label: "Estados Unidos", badge: "+1", flagCode: "US", group: "Norteamérica" },
  { value: "34", label: "España", badge: "+34", flagCode: "ES", group: "Europa", sublabel: "Madrid / Barcelona" },
]

describe("ModernSelect Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders trigger button with placeholder or selected option", () => {
    const { rerender } = render(
      <ModernSelect
        id="test-country"
        ariaLabel="País"
        value=""
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
        placeholder="Selecciona un país"
      />
    )

    expect(screen.getByText("Selecciona un país")).toBeDefined()

    rerender(
      <ModernSelect
        id="test-country"
        ariaLabel="País"
        value="57"
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
      />
    )

    const trigger = screen.getByTestId("test-country-trigger")
    expect(within(trigger).getByText("Colombia")).toBeDefined()
    expect(within(trigger).getByText("+57")).toBeDefined()
  })

  it("opens floating card when trigger is clicked and closes on outside click", async () => {
    render(
      <div>
        <div data-testid="outside-element">Fuera</div>
        <ModernSelect
          id="test-select"
          ariaLabel="Selección"
          value="57"
          onChange={vi.fn()}
          options={SAMPLE_OPTIONS}
        />
      </div>
    )

    const trigger = screen.getByTestId("test-select-trigger")
    expect(screen.queryByTestId("test-select-menu")).toBeNull()

    // Click to open
    fireEvent.click(trigger)
    expect(screen.getByTestId("test-select-menu")).toBeDefined()

    // Click outside to close
    fireEvent.mouseDown(screen.getByTestId("outside-element"))
    expect(screen.queryByTestId("test-select-menu")).toBeNull()
  })

  it("selects an option by clicking and triggers onChange", () => {
    const onChange = vi.fn()
    render(
      <ModernSelect
        id="test-select"
        ariaLabel="Selección"
        value="57"
        onChange={onChange}
        options={SAMPLE_OPTIONS}
      />
    )

    fireEvent.click(screen.getByTestId("test-select-trigger"))

    const menu = screen.getByTestId("test-select-menu")
    const spainOption = within(menu).getByRole("option", { name: /España/i })
    fireEvent.click(spainOption)

    expect(onChange).toHaveBeenCalledWith("34")
    expect(screen.queryByTestId("test-select-menu")).toBeNull()
  })

  it("does not select disabled options", () => {
    const onChange = vi.fn()
    render(
      <ModernSelect
        id="test-select"
        ariaLabel="Selección"
        value="57"
        onChange={onChange}
        options={SAMPLE_OPTIONS}
      />
    )

    fireEvent.click(screen.getByTestId("test-select-trigger"))

    const menu = screen.getByTestId("test-select-menu")
    const chileOption = within(menu).getByRole("option", { name: /Chile/i })
    fireEvent.click(chileOption)

    expect(onChange).not.toHaveBeenCalled()
  })

  it("filters options case-insensitively by label, badge, sublabel, or value", async () => {
    render(
      <ModernSelect
        id="test-select"
        ariaLabel="Selección"
        value=""
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
        searchPlaceholder="Buscar país..."
      />
    )

    fireEvent.click(screen.getByTestId("test-select-trigger"))

    const searchInput = screen.getByPlaceholderText("Buscar país...")
    const menu = screen.getByTestId("test-select-menu")

    // Filter by sublabel "Madrid"
    fireEvent.change(searchInput, { target: { value: "madrid" } })
    expect(within(menu).getByRole("option", { name: /España/i })).toBeDefined()
    expect(within(menu).queryByRole("option", { name: /Colombia/i })).toBeNull()

    // Filter by dial code badge "+52"
    fireEvent.change(searchInput, { target: { value: "+52" } })
    expect(within(menu).getByRole("option", { name: /México/i })).toBeDefined()
    expect(within(menu).queryByRole("option", { name: /España/i })).toBeNull()

    // Filter by non-existent query
    fireEvent.change(searchInput, { target: { value: "xyznotfound" } })
    expect(screen.getByText("No se encontraron opciones")).toBeDefined()
  })

  it("supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)", () => {
    const onChange = vi.fn()
    render(
      <ModernSelect
        id="test-select"
        ariaLabel="Selección"
        value="57"
        onChange={onChange}
        options={SAMPLE_OPTIONS}
      />
    )

    const trigger = screen.getByTestId("test-select-trigger")

    // Open with Enter key
    fireEvent.keyDown(trigger, { key: "Enter" })
    expect(screen.getByTestId("test-select-menu")).toBeDefined()

    // Navigate with ArrowDown
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    fireEvent.keyDown(trigger, { key: "Enter" })

    expect(onChange).toHaveBeenCalled()

    // Close with Escape key
    fireEvent.click(trigger)
    expect(screen.getByTestId("test-select-menu")).toBeDefined()
    fireEvent.keyDown(trigger, { key: "Escape" })
    expect(screen.queryByTestId("test-select-menu")).toBeNull()
  })

  it("keeps synchronized with hidden <select> and supports fireEvent.change", () => {
    const onChange = vi.fn()
    render(
      <ModernSelect
        id="business-country-code"
        ariaLabel="Indicativo de país"
        value="57"
        onChange={onChange}
        options={SAMPLE_OPTIONS}
      />
    )

    // Query hidden select via accessible label
    const select = screen.getByLabelText("Indicativo de país") as HTMLSelectElement
    expect(select).toBeDefined()
    expect(select.value).toBe("57")

    // Simulate change on native select
    fireEvent.change(select, { target: { value: "52" } })
    expect(onChange).toHaveBeenCalledWith("52")
  })

  it("maintains custom or unlisted value selectable in hidden select and trigger", () => {
    render(
      <ModernSelect
        id="custom-select"
        ariaLabel="Moneda"
        value="BTC"
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
      />
    )

    const select = screen.getByLabelText("Moneda") as HTMLSelectElement
    expect(select.value).toBe("BTC")
    const trigger = screen.getByTestId("custom-select-trigger")
    expect(within(trigger).getByText("BTC")).toBeDefined()
  })

  it("renders group headers when options specify groups", () => {
    render(
      <ModernSelect
        id="grouped-select"
        ariaLabel="Grupos"
        value="57"
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
      />
    )

    fireEvent.click(screen.getByTestId("grouped-select-trigger"))

    expect(screen.getByText("Sudamérica")).toBeDefined()
    expect(screen.getByText("Norteamérica")).toBeDefined()
    expect(screen.getByText("Europa")).toBeDefined()
  })

  it("renders flag thumbnail and handles image fallback", () => {
    render(
      <ModernSelect
        id="flag-select"
        ariaLabel="Bandera"
        value="57"
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
      />
    )

    const flagImg = screen.getByAltText("Colombia") as HTMLImageElement
    expect(flagImg.src).toContain("flagcdn.com/28x21/co.png")

    // Simulate image error
    fireEvent.error(flagImg)
    // Fallback badge with country code should be shown
    expect(screen.getByText("CO")).toBeDefined()
  })

  it("does not open dropdown when disabled is true", () => {
    render(
      <ModernSelect
        id="disabled-select"
        ariaLabel="Deshabilitado"
        value="57"
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
        disabled
      />
    )

    const trigger = screen.getByTestId("disabled-select-trigger")
    fireEvent.click(trigger)
    expect(screen.queryByTestId("disabled-select-menu")).toBeNull()
  })

  it("renders leftIcon and error message and applies error styling", () => {
    render(
      <ModernSelect
        id="icon-error-select"
        ariaLabel="Con Icono"
        value="57"
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
        leftIcon={<span data-testid="custom-left-icon">🌍</span>}
        error="Este campo es obligatorio"
      />
    )

    expect(screen.getByTestId("custom-left-icon")).toBeDefined()
    expect(screen.getByText("Este campo es obligatorio")).toBeDefined()

    const trigger = screen.getByTestId("icon-error-select-trigger")
    expect(trigger.className).toContain("border-rose-500")
  })

  it("forwards ref, name, disabled, and required to the hidden select element", () => {
    let selectElement: HTMLSelectElement | null = null
    const refCallback = (el: HTMLSelectElement | null) => {
      selectElement = el
    }

    render(
      <ModernSelect
        ref={refCallback}
        id="ref-select"
        name="test_field"
        required
        disabled
        ariaLabel="Ref Test"
        value="57"
        onChange={vi.fn()}
        options={SAMPLE_OPTIONS}
      />
    )

    const el = selectElement as HTMLSelectElement | null
    expect(el).not.toBeNull()
    expect(el?.name).toBe("test_field")
    expect(el?.required).toBe(true)
    expect(el?.disabled).toBe(true)
  })
})
