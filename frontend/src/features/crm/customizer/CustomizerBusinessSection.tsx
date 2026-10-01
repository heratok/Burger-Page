import React from "react"
import type { StorefrontConfig } from "@/types/restaurant"
import { DollarSign } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { TIMEZONE_OPTIONS } from "@/constants/timezones"
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor"

export interface CustomizerBusinessSectionProps {
  draft: StorefrontConfig
  setDraft: React.Dispatch<React.SetStateAction<StorefrontConfig>>
  isDark?: boolean
}

export const CustomizerBusinessSection: React.FC<CustomizerBusinessSectionProps> = ({
  draft,
  setDraft,
  isDark = false,
}) => {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <DollarSign className="size-4 text-amber-500" />
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
          Información Comercial, Pedidos & Domicilios
        </h3>
      </div>

      <div>
        <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
          Número de WhatsApp para Pedidos (con indicativo país)
        </label>
        <input
          type="tel"
          maxLength={20}
          value={draft.whatsappNumber}
          onChange={(e) => setDraft((prev) => ({ ...prev, whatsappNumber: e.target.value }))}
          placeholder="573022575805"
          className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-medium"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Los pedidos finalizados por los clientes se enviarán formateados a este número.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            Costo Domicilio Base ($)
          </label>
          <input
            type="number"
            min={0}
            max={10000000}
            value={draft.deliveryFee}
            onChange={(e) => setDraft((prev) => ({ ...prev, deliveryFee: Number(e.target.value) }))}
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            Pedido Mínimo de Compra ($)
          </label>
          <input
            type="number"
            min={0}
            max={10000000}
            value={draft.minOrderAmount || 0}
            onChange={(e) => setDraft((prev) => ({ ...prev, minOrderAmount: Number(e.target.value) }))}
            placeholder="20000"
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            Tiempo Estimado Entrega
          </label>
          <input
            type="text"
            maxLength={50}
            value={draft.estimatedDeliveryTime}
            onChange={(e) => setDraft((prev) => ({ ...prev, estimatedDeliveryTime: e.target.value }))}
            placeholder="30 - 45 min"
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            Símbolo de Moneda
          </label>
          <input
            type="text"
            maxLength={5}
            value={draft.currencySymbol || "$"}
            onChange={(e) => setDraft((prev) => ({ ...prev, currencySymbol: e.target.value }))}
            placeholder="$"
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">Horario de Atención</h4>
        <WeeklyScheduleEditor
          schedule={draft.schedule}
          onChange={(schedule) => setDraft((prev) => ({ ...prev, schedule }))}
        />

        <div>
          <label htmlFor="business-timezone" className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            Zona horaria
          </label>
          <select
            id="business-timezone"
            value={draft.timezone}
            onChange={(e) => setDraft((prev) => ({ ...prev, timezone: e.target.value }))}
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            {!TIMEZONE_OPTIONS.some((tz) => tz.value === draft.timezone) && (
              <option value={draft.timezone}>{draft.timezone}</option>
            )}
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            El horario se interpreta en la hora local de esta zona.
          </p>
        </div>

        <Switch
          checked={draft.ordersPaused}
          onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, ordersPaused: checked }))}
          aria-label="Pausar pedidos"
          label="Pausar pedidos"
          description="Bloquea los pedidos de clientes ahora mismo, sin importar el horario. Tú puedes seguir registrando ventas."
        />
      </div>

      <div>
        <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
          Dirección Física del Local
        </label>
        <input
          type="text"
          maxLength={150}
          value={draft.address}
          onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
          placeholder="Calle 45 # 22-18"
          className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
        />
      </div>
    </div>
  )
}
