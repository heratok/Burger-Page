import React from "react"
import { ChevronDown } from "lucide-react"
import type { StoreOpenStatus } from "@/hooks/useStoreOpenStatus"
import { DAY_DISPLAY_ORDER, DAY_NAMES, describeNextOpening, formatRanges, rangesForDay } from "@/lib/storeSchedule"
import type { StorefrontConfig } from "@/types/restaurant"

interface StoreStatusProps {
  config: Pick<StorefrontConfig, "schedule">
  /** Single source of the open state, computed once by the parent. */
  status: StoreOpenStatus
}

/** Abierto/Cerrado badge, next opening or pause notice, and the collapsible weekly hours. */
export const StoreStatus: React.FC<StoreStatusProps> = ({ config, status }) => {
  const { isOpen, reason, next } = status
  const detail = reason === "paused" ? "Pedidos en pausa" : describeNextOpening(next)

  return (
    <div className="flex flex-col items-center gap-2 text-center text-xs">
      <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${
            isOpen
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/15 text-red-700 dark:text-red-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${isOpen ? "bg-emerald-500" : "bg-red-500"}`}
          />
          {isOpen ? "Abierto" : "Cerrado"}
        </span>
        {detail && (
          <span style={{ color: "var(--color-text-secondary)" }} className="font-medium">
            {detail}
          </span>
        )}
        {!isOpen && (
          <span style={{ color: "var(--color-text-secondary)" }} className="basis-full text-center font-normal">
            Puedes ver el menú, pero no puedes agregar productos al carrito por ahora.
          </span>
        )}
      </div>

      <details className="group w-full max-w-xs text-center">
        <summary
          style={{ color: "var(--color-text-secondary)" }}
          className="flex cursor-pointer list-none items-center justify-center gap-1 font-semibold"
        >
          Horarios de atención
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul aria-label="Horarios de atención" className="mx-auto mt-2 w-fit min-w-56 space-y-1 text-left">
          {DAY_DISPLAY_ORDER.map((day) => (
            <li
              key={day}
              style={{ color: "var(--color-text-primary)" }}
              className="flex justify-between gap-4"
            >
              <span className="font-semibold">{DAY_NAMES[day]}</span>
              <span>{formatRanges(rangesForDay(config.schedule, day))}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
