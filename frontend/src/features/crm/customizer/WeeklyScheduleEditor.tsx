import React from "react"
import type { WeeklySchedule } from "@burger-page/contracts"
import { Switch } from "@/components/ui/switch"
import { DAY_DISPLAY_ORDER, DAY_NAMES, formatRanges, rangesForDay } from "@/lib/storeSchedule"

export interface WeeklyScheduleEditorProps {
  schedule: WeeklySchedule
  onChange: (schedule: WeeklySchedule) => void
}

const DEFAULT_OPEN = "12:00"
const DEFAULT_CLOSE = "22:30"

const TIME_INPUT_CLASS =
  "rounded-lg border p-1.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"

/**
 * One editable range per weekday. The model allows several ranges per day:
 * the first one is edited here, any extra range returned by the API is kept
 * untouched (shown read-only) so saving never silently drops it. Closing a
 * day removes all of its ranges.
 */
export const WeeklyScheduleEditor: React.FC<WeeklyScheduleEditorProps> = ({ schedule, onChange }) => {
  const withDay = (day: number, ranges: WeeklySchedule): WeeklySchedule => [
    ...schedule.filter((r) => r.dayOfWeek !== day),
    ...ranges,
  ]

  const toggleDay = (day: number, open: boolean) => {
    onChange(withDay(day, open ? [{ dayOfWeek: day, open: DEFAULT_OPEN, close: DEFAULT_CLOSE }] : []))
  }

  const editFirstRange = (day: number, field: "open" | "close", value: string) => {
    if (!value) return
    const [first, ...extras] = rangesForDay(schedule, day)
    onChange(withDay(day, [{ ...first, [field]: value }, ...extras]))
  }

  const copyToAll = (day: number) => {
    const [first] = rangesForDay(schedule, day)
    onChange(DAY_DISPLAY_ORDER.map((d) => ({ dayOfWeek: d, open: first.open, close: first.close })))
  }

  return (
    <div className="space-y-2">
      {DAY_DISPLAY_ORDER.map((day) => {
        const name = DAY_NAMES[day]
        const [first, ...extras] = rangesForDay(schedule, day)
        return (
          <div
            key={day}
            role="group"
            aria-label={name}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border p-2 dark:border-slate-700"
          >
            <span className="w-24 font-semibold text-slate-800 dark:text-slate-200">{name}</span>
            <Switch
              checked={Boolean(first)}
              onCheckedChange={(checked) => toggleDay(day, checked)}
              aria-label={`${name} abierto`}
            />
            {first ? (
              <>
                <input
                  type="time"
                  aria-label={`${name} apertura`}
                  value={first.open}
                  onChange={(e) => editFirstRange(day, "open", e.target.value)}
                  className={TIME_INPUT_CLASS}
                />
                <span aria-hidden="true">-</span>
                <input
                  type="time"
                  aria-label={`${name} cierre`}
                  value={first.close}
                  onChange={(e) => editFirstRange(day, "close", e.target.value)}
                  className={TIME_INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => copyToAll(day)}
                  aria-label={`Copiar horario de ${name} a todos los días`}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer dark:text-indigo-400"
                >
                  Copiar a todos
                </button>
                {extras.length > 0 && (
                  <span className="basis-full text-[11px] text-slate-500 dark:text-slate-400">
                    También: {formatRanges(extras)} (se conserva al guardar)
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Cerrado</span>
            )}
          </div>
        )
      })}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Si el cierre es menor que la apertura, el horario cruza la medianoche (por ejemplo 20:00 - 02:00).
      </p>
    </div>
  )
}
