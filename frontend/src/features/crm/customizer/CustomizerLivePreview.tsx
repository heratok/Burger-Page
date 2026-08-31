import React from "react"
import type { StorefrontConfig, MenuItem } from "@/types/restaurant"
import { Monitor, Smartphone, Eye, ShoppingCart, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LazyImage } from "@/components/ui/LazyImage"
import { formatCurrency } from "@/lib/utils"
import {
  getRadiusClass,
  getCardStyleClasses,
  getBgStyle,
  getFontFamilyClass,
} from "../utils/customizerStyles"

export interface CustomizerLivePreviewProps {
  draft: StorefrontConfig
  previewDevice: "desktop" | "mobile"
  setPreviewDevice: (device: "desktop" | "mobile") => void
  products: MenuItem[]
  isDark?: boolean
  onViewRealStore?: () => void
}

export const CustomizerLivePreview: React.FC<CustomizerLivePreviewProps> = ({
  draft,
  previewDevice,
  setPreviewDevice,
  products,
  isDark = false,
  onViewRealStore,
}) => {
  const currentBgStyle = getBgStyle(draft.bgTheme)

  return (
    <>
      {/* Simulator Bar */}
      <div
        className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 shadow-xs ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-900 dark:text-white">Simulador en Tiempo Real</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 border dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={`rounded-md p-1.5 text-xs cursor-pointer ${
                previewDevice === "desktop"
                  ? "bg-white shadow-xs text-indigo-700 dark:bg-slate-700 dark:text-white"
                  : "text-slate-400"
              }`}
              title="Vista Escritorio"
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={`rounded-md p-1.5 text-xs cursor-pointer ${
                previewDevice === "mobile"
                  ? "bg-white shadow-xs text-indigo-700 dark:bg-slate-700 dark:text-white"
                  : "text-slate-400"
              }`}
              title="Vista Móvil"
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>

          {onViewRealStore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewRealStore}
              className="text-xs font-semibold"
            >
              <Eye className="size-3 mr-1" />
              Ver Tienda Real
            </Button>
          )}
        </div>
      </div>

      {/* Device Mockup Wrapper */}
      <div
        className={`mx-auto flex justify-center overflow-hidden rounded-2xl border p-2 sm:p-4 transition-all duration-300 ${
          isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-slate-100/80"
        }`}
      >
        <div
          style={{
            backgroundColor: currentBgStyle.bg,
            color: currentBgStyle.text,
            maxWidth: previewDevice === "mobile" ? "375px" : "100%",
            width: "100%",
            boxShadow: "0 20px 40px -15px rgba(0,0,0,0.3)",
          }}
          className={`relative overflow-hidden rounded-2xl border border-slate-700/20 transition-all duration-200 min-h-[560px] flex flex-col ${getFontFamilyClass(
            draft.fontFamily
          )}`}
        >
          {/* Promotional Announcement Strip */}
          {draft.showAnnouncement && (
            <div
              style={{ backgroundColor: draft.primaryColor }}
              className="py-1.5 px-3 text-center text-[10px] font-bold text-white tracking-wide truncate"
            >
              {draft.announcementText}
            </div>
          )}

          {/* Simulated Store Navbar */}
          <div
            style={{ borderColor: "rgba(128,128,128,0.15)" }}
            className="flex items-center justify-between border-b px-4 py-3"
          >
            <div className="flex items-center gap-2.5">
              {draft.logoUrl ? (
                <LazyImage
                  src={draft.logoUrl}
                  alt="Logo"
                  containerClassName="size-8 rounded-full border shrink-0"
                  className="size-full object-cover"
                  style={{ borderColor: draft.primaryColor }}
                />
              ) : (
                <div
                  style={{ backgroundColor: draft.primaryColor }}
                  className="flex size-8 items-center justify-center rounded-full text-white font-bold text-xs"
                >
                  {draft.name.charAt(0)}
                </div>
              )}
              <div>
                <h4 className="text-xs font-bold leading-tight line-clamp-1">{draft.name}</h4>
                <p style={{ color: currentBgStyle.subText }} className="text-[10px] line-clamp-1">
                  {draft.tagline}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                style={{ borderColor: "rgba(128,128,128,0.2)" }}
                className="relative flex size-8 items-center justify-center rounded-full border"
              >
                <ShoppingCart className="size-3.5" />
                <span
                  style={{ backgroundColor: draft.primaryColor }}
                  className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                >
                  2
                </span>
              </div>
            </div>
          </div>

          {/* Simulated Hero Banner */}
          {draft.showBanner && draft.bannerUrl && (
            <div className="relative h-28 w-full overflow-hidden">
              <LazyImage
                src={draft.bannerUrl}
                alt="Banner"
                containerClassName="size-full"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3 z-10">
                <span className="text-xs font-bold text-white">
                  {draft.tagline}
                </span>
              </div>
            </div>
          )}

          {/* Simulated Products Grid inside Preview */}
          <div className="p-3 sm:p-4 flex-1 space-y-3 overflow-y-auto max-h-[420px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">Menú Destacado</span>
              <span style={{ color: draft.primaryColor }} className="font-semibold text-[11px]">
                {products.length} productos
              </span>
            </div>

            <div
              className={`grid gap-3 ${
                previewDevice === "mobile" || draft.compactGrid
                  ? "grid-cols-2"
                  : "grid-cols-2 sm:grid-cols-3"
              }`}
            >
              {products.slice(0, 4).map((p) => {
                const cardRadiusClass = getRadiusClass(draft.cardRadius)
                const cardStyleClass = getCardStyleClasses(draft.cardStyle, draft.bgTheme)

                return (
                  <div
                    key={p.id}
                    className={`overflow-hidden transition-all ${cardRadiusClass} ${cardStyleClass} flex flex-col`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-800/20">
                      <LazyImage
                        src={p.src}
                        alt={p.name}
                        containerClassName="size-full"
                        className="size-full object-cover"
                      />
                      {draft.showBadges && p.isPopular && (
                        <span
                          style={{ backgroundColor: draft.primaryColor }}
                          className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs z-10"
                        >
                          Popular
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 flex flex-col flex-1 justify-between gap-1.5">
                      <div>
                        <h5 className="text-[11px] font-bold leading-tight line-clamp-1">
                          {p.name}
                        </h5>
                        <p
                          style={{ color: currentBgStyle.subText }}
                          className="text-[9px] line-clamp-1"
                        >
                          {p.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span
                          style={{ color: draft.primaryColor }}
                          className="text-xs font-black"
                        >
                          {formatCurrency(p.price)}
                        </span>
                        <span
                          style={{ backgroundColor: draft.primaryColor }}
                          className="flex size-6 items-center justify-center rounded-full text-white shadow-xs"
                        >
                          <Plus className="size-3.5 stroke-[3]" />
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Simulated Mobile Floating Cart */}
          <div
            style={{ borderColor: "rgba(128,128,128,0.15)" }}
            className="mt-auto border-t p-2.5 flex items-center justify-between"
          >
            <div className="text-[10px]">
              <span style={{ color: currentBgStyle.subText }}>Total orden:</span>
              <div style={{ color: draft.primaryColor }} className="font-bold text-xs">
                $54.000
              </div>
            </div>
            <button
              type="button"
              style={{ backgroundColor: draft.primaryColor }}
              className="rounded-xl px-3 py-1.5 text-[11px] font-bold text-white shadow-xs"
            >
              Ver Mi Pedido (2)
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
