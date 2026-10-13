import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import { Tooltip } from "./tooltip"

afterEach(() => cleanup())

describe("Tooltip", () => {
  it("is hidden until the trigger receives keyboard focus", async () => {
    render(
      <Tooltip content="Cierra al día siguiente">
        <button type="button" aria-label="Turno nocturno">N</button>
      </Tooltip>,
    )
    expect(screen.queryByRole("tooltip")).toBeNull()
    await act(async () => {
      screen.getByRole("button", { name: "Turno nocturno" }).focus()
    })
    const tip = await screen.findByRole("tooltip")
    expect(tip.textContent).toBe("Cierra al día siguiente")
  })

  it("exposes the content as the trigger description while open", async () => {
    render(
      <Tooltip content="Detalle extra">
        <button type="button" aria-label="Acción">A</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole("button", { name: "Acción" })
    await act(async () => trigger.focus())
    await screen.findByRole("tooltip")
    expect(trigger.getAttribute("aria-describedby")).toBeTruthy()
    const id = trigger.getAttribute("aria-describedby")!
    expect(document.getElementById(id)?.textContent).toBe("Detalle extra")
  })

  it("dismisses with Escape", async () => {
    render(
      <Tooltip content="Detalle">
        <button type="button" aria-label="Acción">A</button>
      </Tooltip>,
    )
    await act(async () => screen.getByRole("button", { name: "Acción" }).focus())
    await screen.findByRole("tooltip")
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    })
    expect(screen.queryByRole("tooltip")).toBeNull()
  })
})
