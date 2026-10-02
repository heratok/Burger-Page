import React from "react"
import type { StorefrontConfig } from "@/types/restaurant"
import { DollarSign, Clock, Globe, PauseCircle } from "lucide-react"
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
      className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-5 text-xs ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      {/* Main Section Header */}
      <div className="flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-800">
        <DollarSign className="size-4 text-amber-500" />
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Información Comercial, Pedidos & Domicilios
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Ajusta los canales de venta, reglas de compra, horarios y disponibilidad en vivo.
          </p>
        </div>
      </div>

      {/* WhatsApp for Orders */}
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
          className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Los pedidos finalizados por los clientes se enviarán formateados a este número.
        </p>
      </div>

      {/* Pricing & Order Thresholds */}
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
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Delivery Estimate & Currency */}
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
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* DEDICATED BLOCK 1: Horario de Atención Semanal */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-indigo-500 shrink-0" />
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Horario de Atención</h4>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Los clientes podrán pedir en el storefront únicamente durante estos rangos horarios.
        </p>
        <WeeklyScheduleEditor
          schedule={draft.schedule}
          onChange={(schedule) => setDraft((prev) => ({ ...prev, schedule }))}
        />
      </div>

      {/* DEDICATED BLOCK 2: Zona Horaria Oficial */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-emerald-500 shrink-0" />
          <label htmlFor="business-timezone" className="font-bold text-sm text-slate-900 dark:text-white cursor-pointer">
            Zona horaria
          </label>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          El horario de apertura y cierre se calcula automáticamente con base en la hora de esta región.
        </p>
        <select
          id="business-timezone"
          value={draft.timezone}
          onChange={(e) => setDraft((prev) => ({ ...prev, timezone: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
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
      </div>

      {/* DEDICATED BLOCK 3: Pausar Pedidos (Emergency Switch) */}
      <div
        className={`rounded-xl border p-4 transition-all ${
          draft.ordersPaused
            ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
            : "border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PauseCircle
                className={`size-4 shrink-0 ${draft.ordersPaused ? "text-amber-500" : "text-slate-400"}`}
              />
              <span className="font-bold text-sm text-slate-900 dark:text-white">Pausar Pedidos</span>
              {draft.ordersPaused ? (
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  Pausado
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Normal
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Bloquea los pedidos de clientes ahora mismo, sin importar el horario. Tú puedes seguir registrando ventas.
            </p>
          </div>
          <Switch
            checked={draft.ordersPaused}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, ordersPaused: checked }))}
            aria-label="Pausar pedidos"
          />
        </div>
      </div>

      {/* Store Address */}
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
          className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
      </div>
    </div>
  )
}
