import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor"
import type { WeeklySchedule } from "@burger-page/contracts"

afterEach(cleanup)

const week = (open = "12:00", close = "22:30"): WeeklySchedule =>
  [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open, close }))

function row(day: string) {
  return screen.getByRole("group", { name: day })
}

describe("WeeklyScheduleEditor", () => {
  it("renders 7 rows Monday to Sunday", () => {
    render(<WeeklyScheduleEditor schedule={week()} onChange={vi.fn()} />)
    const names = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"))
    expect(names).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"])
  })

  it("shows the open and close time inputs of an open day", () => {
    render(<WeeklyScheduleEditor schedule={week("09:00", "18:00")} onChange={vi.fn()} />)
    const r = within(row("Martes"))
    expect((r.getByLabelText("Martes apertura") as HTMLInputElement).value).toBe("09:00")
    expect((r.getByLabelText("Martes cierre") as HTMLInputElement).value).toBe("18:00")
    expect((r.getByLabelText("Martes apertura") as HTMLInputElement).type).toBe("time")
  })

  it("shows a closed day without time inputs", () => {
    const schedule = week().filter((r) => r.dayOfWeek !== 3)
    render(<WeeklyScheduleEditor schedule={schedule} onChange={vi.fn()} />)
    const r = within(row("Miércoles"))
    expect(r.queryByLabelText("Miércoles apertura")).toBeNull()
    expect((r.getByRole("switch") as HTMLElement).getAttribute("aria-checked")).toBe("false")
  })

  it("closing a day removes its ranges", () => {
    const onChange = vi.fn()
    render(<WeeklyScheduleEditor schedule={week()} onChange={onChange} />)
    fireEvent.click(within(row("Lunes")).getByRole("switch"))
    const next = onChange.mock.calls[0][0] as WeeklySchedule
    expect(next.some((r) => r.dayOfWeek === 1)).toBe(false)
    expect(next).toHaveLength(6)
  })

  it("opening a closed day adds a default range", () => {
    const onChange = vi.fn()
    render(<WeeklyScheduleEditor schedule={week().filter((r) => r.dayOfWeek !== 0)} onChange={onChange} />)
    fireEvent.click(within(row("Domingo")).getByRole("switch"))
    const next = onChange.mock.calls[0][0] as WeeklySchedule
    expect(next.filter((r) => r.dayOfWeek === 0)).toEqual([{ dayOfWeek: 0, open: "12:00", close: "22:30" }])
  })

  it("editing the opening time changes only that day's first range", () => {
    const onChange = vi.fn()
    render(<WeeklyScheduleEditor schedule={week()} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText("Viernes apertura"), { target: { value: "08:15" } })
    const next = onChange.mock.calls[0][0] as WeeklySchedule
    expect(next.find((r) => r.dayOfWeek === 5)).toEqual({ dayOfWeek: 5, open: "08:15", close: "22:30" })
    expect(next.find((r) => r.dayOfWeek === 4)).toEqual({ dayOfWeek: 4, open: "12:00", close: "22:30" })
  })

  it("ignores an emptied time input", () => {
    const onChange = vi.fn()
    render(<WeeklyScheduleEditor schedule={week()} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText("Viernes cierre"), { target: { value: "" } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("preserves extra ranges of a day and shows them read-only", () => {
    const onChange = vi.fn()
    const schedule: WeeklySchedule = [
      { dayOfWeek: 1, open: "09:00", close: "14:00" },
      { dayOfWeek: 1, open: "18:00", close: "22:00" },
    ]
    render(<WeeklyScheduleEditor schedule={schedule} onChange={onChange} />)
    expect(within(row("Lunes")).getByText(/18:00 - 22:00/)).toBeDefined()
    fireEvent.change(screen.getByLabelText("Lunes apertura"), { target: { value: "10:00" } })
    const next = onChange.mock.calls[0][0] as WeeklySchedule
    expect(next).toEqual([
      { dayOfWeek: 1, open: "10:00", close: "14:00" },
      { dayOfWeek: 1, open: "18:00", close: "22:00" },
    ])
  })

  it("copies a day's hours to every day", () => {
    const onChange = vi.fn()
    const schedule: WeeklySchedule = [
      { dayOfWeek: 1, open: "09:00", close: "18:00" },
      { dayOfWeek: 2, open: "12:00", close: "22:30" },
    ]
    render(<WeeklyScheduleEditor schedule={schedule} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Copiar horario de Lunes a todos los días" }))
    const next = onChange.mock.calls[0][0] as WeeklySchedule
    expect(next).toHaveLength(7)
    expect(next.every((r) => r.open === "09:00" && r.close === "18:00")).toBe(true)
  })

  it("explains that a range can cross midnight", () => {
    render(<WeeklyScheduleEditor schedule={week()} onChange={vi.fn()} />)
    expect(screen.getByText(/20:00 - 02:00/)).toBeDefined()
  })

  it("shows an overnight indicator when a day closes past midnight", () => {
    const schedule: WeeklySchedule = [
      { dayOfWeek: 5, open: "20:00", close: "02:00" },
    ]
    render(<WeeklyScheduleEditor schedule={schedule} onChange={vi.fn()} />)
    const r = within(row("Viernes"))
    expect(r.getByText(/\+1 día|cierra al día siguiente/i)).toBeDefined()
  })

  it("copies Monday hours to all weekdays with the 'Lun–Vie igual' shortcut", () => {
    const onChange = vi.fn()
    const schedule: WeeklySchedule = [
      { dayOfWeek: 1, open: "10:00", close: "20:00" },
      { dayOfWeek: 6, open: "14:00", close: "23:00" },
    ]
    render(<WeeklyScheduleEditor schedule={schedule} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: /Lun–Vie igual/i }))
    const next = onChange.mock.calls[0][0] as WeeklySchedule
    const weekdays = [1, 2, 3, 4, 5]
    for (const d of weekdays) {
      expect(next.filter((r) => r.dayOfWeek === d)).toEqual([
        { dayOfWeek: d, open: "10:00", close: "20:00" },
      ])
    }
    expect(next.find((r) => r.dayOfWeek === 6)).toEqual({ dayOfWeek: 6, open: "14:00", close: "23:00" })
  })

  it("copies Saturday hours to Sunday with the 'Fin de semana' shortcut", () => {
    const onChange = vi.fn()
    const schedule: WeeklySchedule = [
      { dayOfWeek: 1, open: "10:00", close: "20:00" },
      { dayOfWeek: 6, open: "14:00", close: "01:00" },
      { dayOfWeek: 0, open: "12:00", close: "18:00" },
    ]
    render(<WeeklyScheduleEditor schedule={schedule} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: /Fin de semana/i }))
    const next = onChange.mock.calls[0][0] as WeeklySchedule
    expect(next.filter((r) => r.dayOfWeek === 6)).toEqual([
      { dayOfWeek: 6, open: "14:00", close: "01:00" },
    ])
    expect(next.filter((r) => r.dayOfWeek === 0)).toEqual([
      { dayOfWeek: 0, open: "14:00", close: "01:00" },
    ])
    expect(next.find((r) => r.dayOfWeek === 1)).toEqual({ dayOfWeek: 1, open: "10:00", close: "20:00" })
  })
})
