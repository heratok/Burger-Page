import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within, act } from "@testing-library/react"
import { StoreStatus } from "./StoreStatus"
import { useStoreOpenStatus } from "@/hooks/useStoreOpenStatus"
import type { WeeklySchedule } from "@burger-page/contracts"

// 2026-10-05 is a Monday; 15:00Z is 10:00 in Bogota.
const schedule: WeeklySchedule = [
  { dayOfWeek: 1, open: "12:00", close: "22:00" },
  { dayOfWeek: 1, open: "06:00", close: "08:00" },
  { dayOfWeek: 3, open: "20:00", close: "02:00" },
]
const config = { schedule, timezone: "America/Bogota", ordersPaused: false }

function Harness({ config }: { config: StoreStatusConfig }) {
  const status = useStoreOpenStatus(config)
  return <StoreStatus config={config} status={status} />
}
type StoreStatusConfig = typeof config

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
    render(<Harness config={config} />)
    const status = screen.getByRole("status")
    expect(within(status).getByText("Cerrado")).toBeDefined()
    expect(within(status).getByText("Abrimos hoy a las 12:00")).toBeDefined()
  })

  it("explains the browse-only mode once while closed, and not while open", () => {
    const { unmount } = render(<Harness config={config} />)
    expect(screen.getAllByText(/no puedes agregar productos/i)).toHaveLength(1)
    unmount()
    vi.setSystemTime(new Date("2026-10-05T18:00:00Z"))
    render(<Harness config={config} />)
    expect(screen.queryByText(/no puedes agregar productos/i)).toBeNull()
  })

  it("flips to Abierto on its own when the clock crosses the opening time", () => {
    render(<Harness config={config} />)
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 60 * 1000)
    })
    const status = screen.getByRole("status")
    expect(within(status).getByText("Abierto")).toBeDefined()
    expect(within(status).queryByText(/Abrimos/)).toBeNull()
  })

  it("shows the pause instead of the next opening", () => {
    render(<Harness config={{ ...config, ordersPaused: true }} />)
    const status = screen.getByRole("status")
    expect(within(status).getByText("Cerrado")).toBeDefined()
    expect(within(status).getByText("Pedidos en pausa")).toBeDefined()
    expect(within(status).queryByText(/Abrimos/)).toBeNull()
  })

  it("lists the week with Spanish day names, joined ranges and Cerrado on empty days", () => {
    render(<Harness config={config} />)
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
    render(<Harness config={config} />)
    expect(screen.getByText("Horarios de atención", { selector: "summary" })).toBeDefined()
  })

  it("is centered at every width: no breakpoint switches the block to left alignment", () => {
    const { container } = render(<Harness config={config} />)
    const html = container.innerHTML
    expect(html).not.toMatch(/sm:items-start|sm:text-left|sm:justify-start|md:text-left|md:items-start/)
    const hours = screen.getByRole("list", { name: "Horarios de atención" })
    expect(hours.className).toMatch(/mx-auto/)
    expect(screen.getByText(/no puedes agregar productos/i).className).toMatch(/text-center/)
  })

  it("renders a record that predates the schedule (no schedule field) as open 24/7 without crashing", () => {
    const legacy = {} as Parameters<typeof StoreStatus>[0]["config"]
    render(<Harness config={legacy as unknown as StoreStatusConfig} />)
    expect(within(screen.getByRole("status")).getByText("Abierto")).toBeDefined()
    expect(screen.getByRole("list", { name: "Horarios de atención" })).toBeDefined()
  })
})
