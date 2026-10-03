import React, { useState, useMemo } from "react"
import type { StorefrontConfig } from "@/types/restaurant"
import { DollarSign, Clock, Globe, PauseCircle, ChevronDown, ShoppingBag, Store } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { TIMEZONE_OPTIONS } from "@/constants/timezones"
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor"
import { DAY_DISPLAY_ORDER, rangesForDay } from "@/lib/storeSchedule"
import { COMMON_CURRENCIES, getDefaultSymbolForCurrency } from "@/lib/currenciesAndTimezones"
import { POPULAR_COUNTRY_CODES, splitPhoneNumber, combinePhoneNumber } from "@/lib/countryPhoneCodes"
import { ModernSelect, type ModernSelectOption } from "@/components/ui/ModernSelect"

const DELIVERY_TIME_PRESETS = ["15 - 30 min", "30 - 45 min", "45 - 60 min", "60+ min"] as const

export interface CustomizerBusinessSectionProps {
  draft: StorefrontConfig
  setDraft: React.Dispatch<React.SetStateAction<StorefrontConfig>>
  isDark?: boolean
  initialOpenSections?: {
    channels?: boolean
    schedule?: boolean
    operation?: boolean
  }
}

export const CustomizerBusinessSection: React.FC<CustomizerBusinessSectionProps> = ({
  draft,
  setDraft,
  isDark = false,
  initialOpenSections,
}) => {
  const [openSections, setOpenSections] = useState({
    channels: initialOpenSections?.channels ?? true,
    schedule: initialOpenSections?.schedule ?? false,
    operation: initialOpenSections?.operation ?? true,
  })

  const [selectedDialCode, setSelectedDialCode] = useState(() => {
    return splitPhoneNumber(draft.whatsappNumber).dialCode
  })

  const phoneParts = splitPhoneNumber(draft.whatsappNumber, selectedDialCode)
  const currentDialCode = draft.whatsappNumber ? phoneParts.dialCode : selectedDialCode

  const handleDialCodeChange = (newDialCode: string) => {
    setSelectedDialCode(newDialCode)
    const combined = combinePhoneNumber(newDialCode, phoneParts.nationalNumber)
    setDraft((prev) => ({ ...prev, whatsappNumber: combined }))
  }

  const handleNationalNumberChange = (rawInput: string) => {
    if (rawInput.startsWith("+")) {
      const parsed = splitPhoneNumber(rawInput, currentDialCode)
      setSelectedDialCode(parsed.dialCode)
      const combined = combinePhoneNumber(parsed.dialCode, parsed.nationalNumber)
      setDraft((prev) => ({ ...prev, whatsappNumber: combined }))
      return
    }
    const combined = combinePhoneNumber(currentDialCode, rawInput)
    setDraft((prev) => ({ ...prev, whatsappNumber: combined }))
  }

  const toggleSection = (key: "channels" | "schedule" | "operation") => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const allOpen = openSections.channels && openSections.schedule && openSections.operation

  const toggleAll = () => {
    const nextState = !allOpen
    setOpenSections({
      channels: nextState,
      schedule: nextState,
      operation: nextState,
    })
  }

  const openDaysCount = DAY_DISPLAY_ORDER.filter(
    (d) => rangesForDay(draft.schedule, d).length > 0
  ).length

  const countryOptions: ModernSelectOption[] = useMemo(() => {
    const base: ModernSelectOption[] = POPULAR_COUNTRY_CODES.map((c) => ({
      value: c.dialCode,
      label: c.name,
      badge: `+${c.dialCode}`,
      flagCode: c.code,
    }))
    if (currentDialCode && !base.some((c) => c.value === currentDialCode)) {
      return [{ value: currentDialCode, label: `+${currentDialCode}`, badge: `+${currentDialCode}` }, ...base]
    }
    return base
  }, [currentDialCode])

  const currencyOptions: ModernSelectOption[] = useMemo(() => {
    const base: ModernSelectOption[] = COMMON_CURRENCIES.map((curr) => ({
      value: curr.code,
      label: curr.name,
      badge: curr.code,
      sublabel: curr.defaultSymbol,
    }))
    if (draft.currency && !base.some((c) => c.value === draft.currency)) {
      return [{ value: draft.currency, label: draft.currency, badge: draft.currency }, ...base]
    }
    return base
  }, [draft.currency])

  const timezoneOptions: ModernSelectOption[] = useMemo(() => {
    const base: ModernSelectOption[] = TIMEZONE_OPTIONS.map((tz) => ({
      value: tz.value,
      label: tz.label,
      group: tz.group,
    }))
    if (draft.timezone && !base.some((tz) => tz.value === draft.timezone)) {
      return [{ value: draft.timezone, label: draft.timezone }, ...base]
    }
    return base
  }, [draft.timezone])

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-4 text-xs ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      {/* Main Section Header */}
      <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
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

        <button
          type="button"
          onClick={toggleAll}
          className="shrink-0 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
        >
          {allOpen ? "Colapsar todo" : "Expandir todo"}
        </button>
      </div>

      {/* ACCORDION 1: Canales & Reglas de Compra */}
      <div
        className={`rounded-xl border transition-all ${
          isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200/90 bg-slate-50/50"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleSection("channels")}
          aria-expanded={openSections.channels}
          aria-controls="business-channels-panel"
          className="w-full flex items-center justify-between p-3 sm:p-3.5 text-left transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded-xl cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <ShoppingBag className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                Canales & Reglas de Compra
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                WhatsApp, costos de envío, mínimos y tiempo estimado
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="hidden sm:inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 font-mono">
              {draft.whatsappNumber ? `+${draft.whatsappNumber}` : "Sin WhatsApp"}
            </span>
            <ChevronDown
              className={`size-4 text-slate-400 transition-transform duration-200 ${
                openSections.channels ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {openSections.channels && (
          <div
            id="business-channels-panel"
            className="p-3.5 sm:p-4 pt-1 space-y-4 border-t border-slate-100 dark:border-slate-800/70 mt-1"
          >
            {/* WhatsApp for Orders */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold block text-slate-800 dark:text-slate-200">
                  Número de WhatsApp para Pedidos
                </label>
                {draft.whatsappNumber ? (
                  <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    +{draft.whatsappNumber}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Sin WhatsApp configurado
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-5">
                  <ModernSelect
                    id="business-country-code"
                    ariaLabel="Indicativo de país"
                    value={currentDialCode}
                    onChange={handleDialCodeChange}
                    options={countryOptions}
                    searchPlaceholder="Buscar país o indicativo (+57, Colombia...)"
                  />
                </div>
                <div className="sm:col-span-7">
                  <input
                    type="tel"
                    aria-label="Número de WhatsApp local"
                    maxLength={20}
                    value={phoneParts.nationalNumber}
                    onChange={(e) => handleNationalNumberChange(e.target.value)}
                    placeholder="3022575805"
                    className="w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Los pedidos finalizados por los clientes se enviarán formateados a este número.
                {draft.whatsappNumber && (
                  <span className="ml-1 text-slate-700 dark:text-slate-300 font-medium">
                    (Destino: <span className="font-mono font-semibold">+{draft.whatsappNumber}</span>)
                  </span>
                )}
              </p>
            </div>

            {/* Pricing & Order Thresholds */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="business-delivery-fee"
                  className="font-semibold block mb-1 text-slate-800 dark:text-slate-200"
                >
                  Costo Domicilio Base
                </label>
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 overflow-hidden bg-white">
                  <span className="inline-flex items-center px-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 font-mono font-semibold text-xs select-none">
                    {draft.currencySymbol || "$"}
                  </span>
                  <input
                    id="business-delivery-fee"
                    type="number"
                    min={0}
                    max={10000000}
                    value={draft.deliveryFee}
                    onChange={(e) => setDraft((prev) => ({ ...prev, deliveryFee: Number(e.target.value) }))}
                    className="w-full p-2.5 bg-transparent text-slate-900 dark:text-white outline-none font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="business-min-order"
                  className="font-semibold block mb-1 text-slate-800 dark:text-slate-200"
                >
                  Pedido Mínimo de Compra
                </label>
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 overflow-hidden bg-white">
                  <span className="inline-flex items-center px-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 font-mono font-semibold text-xs select-none">
                    {draft.currencySymbol || "$"}
                  </span>
                  <input
                    id="business-min-order"
                    type="number"
                    min={0}
                    max={10000000}
                    value={draft.minOrderAmount || 0}
                    onChange={(e) => setDraft((prev) => ({ ...prev, minOrderAmount: Number(e.target.value) }))}
                    placeholder="20000"
                    className="w-full p-2.5 bg-transparent text-slate-900 dark:text-white outline-none font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Estimate & Currency */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="business-delivery-time"
                  className="font-semibold block mb-1 text-slate-800 dark:text-slate-200"
                >
                  Tiempo Estimado Entrega
                </label>
                <input
                  id="business-delivery-time"
                  type="text"
                  maxLength={50}
                  value={draft.estimatedDeliveryTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, estimatedDeliveryTime: e.target.value }))}
                  placeholder="30 - 45 min"
                  className="w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {DELIVERY_TIME_PRESETS.map((preset) => {
                    const isSelected = draft.estimatedDeliveryTime === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, estimatedDeliveryTime: preset }))}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                          isSelected
                            ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                            : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700"
                        }`}
                      >
                        {preset}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="business-currency"
                    className="font-semibold block mb-1 text-slate-800 dark:text-slate-200"
                  >
                    Moneda
                  </label>
                  <ModernSelect
                    id="business-currency"
                    ariaLabel="Moneda"
                    value={draft.currency || "COP"}
                    onChange={(nextCurrency) => {
                      const defaultSym = getDefaultSymbolForCurrency(nextCurrency)
                      setDraft((prev) => ({
                        ...prev,
                        currency: nextCurrency,
                        currencySymbol: defaultSym,
                      }))
                    }}
                    options={currencyOptions}
                    searchPlaceholder="Buscar moneda (COP, USD, MXN...)"
                  />
                </div>
                <div>
                  <label
                    htmlFor="business-currency-symbol"
                    className="font-semibold block mb-1 text-slate-800 dark:text-slate-200"
                  >
                    Símbolo
                  </label>
                  <input
                    id="business-currency-symbol"
                    aria-label="Símbolo de moneda"
                    type="text"
                    maxLength={5}
                    value={draft.currencySymbol || "$"}
                    onChange={(e) => setDraft((prev) => ({ ...prev, currencySymbol: e.target.value }))}
                    placeholder="$"
                    className="w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 2: Horarios de Atención & Zona Horaria */}
      <div
        className={`rounded-xl border transition-all ${
          isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200/90 bg-slate-50/50"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleSection("schedule")}
          aria-expanded={openSections.schedule}
          aria-controls="business-schedule-panel"
          className="w-full flex items-center justify-between p-3 sm:p-3.5 text-left transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded-xl cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center size-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Clock className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                Horario de Atención & Zona
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                Configuración de apertura semanal y huso horario
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold">
              {openDaysCount}/7 abiertos
            </span>
            <ChevronDown
              className={`size-4 text-slate-400 transition-transform duration-200 ${
                openSections.schedule ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {openSections.schedule && (
          <div
            id="business-schedule-panel"
            className="p-3.5 sm:p-4 pt-1 space-y-4 border-t border-slate-100 dark:border-slate-800/70 mt-1"
          >
            {/* Weekly Schedule Editor */}
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Los clientes podrán pedir en el storefront únicamente durante estos rangos horarios.
              </p>
              <WeeklyScheduleEditor
                schedule={draft.schedule}
                onChange={(schedule) => setDraft((prev) => ({ ...prev, schedule }))}
              />
            </div>

            {/* Zona Horaria Oficial */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-emerald-500 shrink-0" />
                <label
                  htmlFor="business-timezone"
                  className="font-bold text-sm text-slate-900 dark:text-white cursor-pointer"
                >
                  Zona horaria
                </label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                El horario de apertura y cierre se calcula automáticamente con base en la hora de esta región.
              </p>
              <ModernSelect
                id="business-timezone"
                ariaLabel="Zona horaria"
                value={draft.timezone}
                onChange={(timezone) => setDraft((prev) => ({ ...prev, timezone }))}
                options={timezoneOptions}
                searchPlaceholder="Buscar zona horaria (Bogotá, Madrid, UTC...)"
              />
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 3: Disponibilidad & Dirección del Local */}
      <div
        className={`rounded-xl border transition-all ${
          isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200/90 bg-slate-50/50"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleSection("operation")}
          aria-expanded={openSections.operation}
          aria-controls="business-operation-panel"
          className="w-full flex items-center justify-between p-3 sm:p-3.5 text-left transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded-xl cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Store className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                Disponibilidad & Local
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                Pausa de pedidos y dirección física
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {draft.ordersPaused ? (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                Pausado
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Operando
              </span>
            )}
            <ChevronDown
              className={`size-4 text-slate-400 transition-transform duration-200 ${
                openSections.operation ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {openSections.operation && (
          <div
            id="business-operation-panel"
            className="p-3.5 sm:p-4 pt-1 space-y-4 border-t border-slate-100 dark:border-slate-800/70 mt-1"
          >
            {/* Pausar Pedidos (Emergency Switch) */}
            <div
              className={`rounded-xl border p-3.5 transition-all ${
                draft.ordersPaused
                  ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
                  : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60"
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
                className="w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
