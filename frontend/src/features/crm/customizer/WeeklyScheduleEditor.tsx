import React from "react"
import type { WeeklySchedule } from "@burger-page/contracts"
import { Switch } from "@/components/ui/switch"
import {
  DAY_DISPLAY_ORDER,
  DAY_NAMES,
  formatRanges,
  rangesForDay,
  isOvernightRange,
  copyRangeToWeekdays,
  copyRangeToWeekend,
} from "@/lib/storeSchedule"
import { Clock, Copy, Sparkles } from "lucide-react"

export interface WeeklyScheduleEditorProps {
  schedule: WeeklySchedule
  onChange: (schedule: WeeklySchedule) => void
}

const DEFAULT_OPEN = "12:00"
const DEFAULT_CLOSE = "22:30"

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

  const openDaysCount = DAY_DISPLAY_ORDER.filter((d) => rangesForDay(schedule, d).length > 0).length

  return (
    <div className="space-y-3">
      {/* Quick Presets Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
          <Sparkles className="size-3.5 text-amber-500 shrink-0" />
          <span>Atajos rápidos:</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            ({openDaysCount}/7 abiertos)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(copyRangeToWeekdays(schedule, 1))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            aria-label="Lun–Vie igual"
          >
            Lun–Vie igual
          </button>
          <button
            type="button"
            onClick={() => onChange(copyRangeToWeekend(schedule, 6))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            aria-label="Fin de semana"
          >
            Fin de semana
          </button>
        </div>
      </div>

      {/* Weekday Rows: Grid layout aligned across all columns */}
      <div className="space-y-1.5">
        {DAY_DISPLAY_ORDER.map((day) => {
          const name = DAY_NAMES[day]
          const [first, ...extras] = rangesForDay(schedule, day)
          const isOpen = Boolean(first)
          const overnight = isOpen && isOvernightRange(first.open, first.close)

          return (
            <div
              key={day}
              role="group"
              aria-label={name}
              className={`rounded-xl border px-3 py-1.5 transition-all ${
                isOpen
                  ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs"
                  : "border-slate-100 bg-slate-50/70 dark:border-slate-800/40 dark:bg-slate-950/30 opacity-75"
              }`}
            >
              <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[58px_44px_1fr_auto] items-center gap-x-2 gap-y-1.5 sm:gap-y-0 sm:h-8">
                {/* Col 1: Day Name */}
                <span
                  className={`col-start-1 row-start-1 sm:col-auto sm:row-auto font-semibold text-xs truncate ${
                    isOpen ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {name}
                </span>

                {/* Col 2: Open/Closed Switch */}
                <div className="col-start-2 row-start-1 sm:col-auto sm:row-auto flex items-center">
                  <Switch
                    checked={isOpen}
                    onCheckedChange={(checked) => toggleDay(day, checked)}
                    aria-label={`${name} abierto`}
                  />
                </div>

                {/* Col 3: Inputs or Cerrado status */}
                <div className="col-span-3 row-start-2 sm:col-auto sm:row-auto min-w-0">
                  {first ? (
                    <div className="flex items-center gap-1 sm:gap-1.5 h-7">
                      <input
                        type="time"
                        aria-label={`${name} apertura`}
                        value={first.open}
                        onChange={(e) => editFirstRange(day, "open", e.target.value)}
                        className="h-7 w-[64px] sm:w-[58px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white px-1 text-xs font-mono text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                      <span
                        aria-hidden="true"
                        className="text-slate-400 dark:text-slate-500 text-xs font-semibold select-none"
                      >
                        -
                      </span>
                      <input
                        type="time"
                        aria-label={`${name} cierre`}
                        value={first.close}
                        onChange={(e) => editFirstRange(day, "close", e.target.value)}
                        className="h-7 w-[64px] sm:w-[58px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white px-1 text-xs font-mono text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                      {overnight && (
                        <span
                          title="Cierra al día siguiente (cruza la medianoche)"
                          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0 select-none whitespace-nowrap"
                        >
                          🌙<span className="sm:hidden lg:inline"> +1 día</span><span className="hidden sm:inline lg:hidden"> +1</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center h-7 text-xs text-slate-400 dark:text-slate-500 italic select-none">
                      Cerrado
                    </div>
                  )}
                </div>

                {/* Col 4: Action button */}
                <div className="col-start-3 row-start-1 sm:col-auto sm:row-auto justify-self-end">
                  {first ? (
                    <button
                      type="button"
                      onClick={() => copyToAll(day)}
                      aria-label={`Copiar horario de ${name} a todos los días`}
                      title={`Copiar horario de ${name} a todos los días`}
                      className="flex items-center justify-center size-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  ) : (
                    <div className="size-7" aria-hidden="true" />
                  )}
                </div>
              </div>

              {/* Extra ranges if pre-existing in DB */}
              {extras.length > 0 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-1 mt-1">
                  También: {formatRanges(extras)} (se conserva al guardar)
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Helper Note */}
      <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 px-1 pt-1">
        <Clock className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          Si el cierre es menor que la apertura, el horario cruza la medianoche (por ejemplo 20:00 - 02:00, indicado con 🌙 +1 día).
        </p>
      </div>
    </div>
  )
}
