import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within, act } from "@testing-library/react"
import { StoreStatus } from "./StoreStatus"
import type { WeeklySchedule } from "@burger-page/contracts"

// 2026-10-05 is a Monday; 15:00Z is 10:00 in Bogota.
const schedule: WeeklySchedule = [
  { dayOfWeek: 1, open: "12:00", close: "22:00" },
  { dayOfWeek: 1, open: "06:00", close: "08:00" },
  { dayOfWeek: 3, open: "20:00", close: "02:00" },
]
const config = { schedule, timezone: "America/Bogota", ordersPaused: false }

describe("StoreStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-05T15:00:00Z"))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("shows Cerrado with the next opening while closed", () => {
    render(<StoreStatus config={config} />)
    const status = screen.getByRole("status")
    expect(within(status).getByText("Cerrado")).toBeDefined()
    expect(within(status).getByText("Abrimos hoy a las 12:00")).toBeDefined()
  })

  it("flips to Abierto on its own when the clock crosses the opening time", () => {
    render(<StoreStatus config={config} />)
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 60 * 1000)
    })
    const status = screen.getByRole("status")
    expect(within(status).getByText("Abierto")).toBeDefined()
    expect(within(status).queryByText(/Abrimos/)).toBeNull()
  })

  it("shows the pause instead of the next opening", () => {
    render(<StoreStatus config={{ ...config, ordersPaused: true }} />)
    const status = screen.getByRole("status")
    expect(within(status).getByText("Cerrado")).toBeDefined()
    expect(within(status).getByText("Pedidos en pausa")).toBeDefined()
    expect(within(status).queryByText(/Abrimos/)).toBeNull()
  })

  it("lists the week with Spanish day names, joined ranges and Cerrado on empty days", () => {
    render(<StoreStatus config={config} />)
    const list = screen.getByRole("list", { name: "Horarios de atención" })
    const items = within(list).getAllByRole("listitem")
    expect(items).toHaveLength(7)
    expect(items[0].textContent).toContain("Lunes")
    expect(items[0].textContent).toContain("06:00 - 08:00, 12:00 - 22:00")
    expect(items[1].textContent).toContain("Cerrado")
    expect(items[2].textContent).toContain("20:00 - 02:00")
    expect(items[6].textContent).toContain("Domingo")
  })

  it("the hours list is collapsible", () => {
    render(<StoreStatus config={config} />)
    expect(screen.getByText("Horarios de atención", { selector: "summary" })).toBeDefined()
  })
})
