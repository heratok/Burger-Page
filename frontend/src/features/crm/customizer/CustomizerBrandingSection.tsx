import React, { useRef, useState } from "react"
import type { StorefrontConfig } from "@/types/restaurant"
import { Upload, Trash2, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { LazyImage } from "@/components/ui/LazyImage"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { toast } from "sonner"
import { optimizeImageToWebP } from "@/lib/imageOptimizer"
import { uploadImageToStorage } from "@/core/storage/supabaseStorage"

export interface CustomizerBrandingSectionProps {
  draft: StorefrontConfig
  setDraft: React.Dispatch<React.SetStateAction<StorefrontConfig>>
  restaurantId?: string
  isDark?: boolean
}

export const CustomizerBrandingSection: React.FC<CustomizerBrandingSectionProps> = ({
  draft,
  setDraft,
  restaurantId,
  isDark = false,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const [confirmDeleteMedia, setConfirmDeleteMedia] = useState<"logo" | "banner" | null>(null)

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logoUrl" | "bannerUrl"
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen original debe ser menor a 10MB")
      return
    }

    try {
      const isLogo = field === "logoUrl"
      const optimizedWebP = await optimizeImageToWebP(file, {
        maxWidth: isLogo ? 400 : 1200,
        maxHeight: isLogo ? 400 : 600,
        quality: isLogo ? 0.85 : 0.82,
      })

      const finalUrl = await uploadImageToStorage(optimizedWebP, {
        restaurantId: restaurantId || "default",
        folder: "branding",
        filename: isLogo ? "logo" : "banner",
        bucketName: "image",
      })

      setDraft((prev) => ({ ...prev, [field]: finalUrl }))
      toast.success(isLogo ? "Logo optimizado y cargado en WebP" : "Foto de portada optimizada en WebP")
    } catch (err: any) {
      console.error("Image optimization failed:", err)
      toast.error("No se pudo procesar la imagen seleccionada")
    } finally {
      // Clear input value so same file can be re-selected if needed
      e.target.value = ""
    }
  }

  return (
    <>
      <div
        className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Identidad Visual & Fotos</h3>

        <div>
          <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            Nombre del Restaurante
          </label>
          <input
            type="text"
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ej. Burger Craft"
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
          />
        </div>

        <div>
          <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            Slogan / Tagline
          </label>
          <input
            type="text"
            maxLength={120}
            value={draft.tagline}
            onChange={(e) => setDraft((prev) => ({ ...prev, tagline: e.target.value }))}
            placeholder="Ej. Cocina artesanal con sabor inolvidable"
            className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        {/* Logo Upload */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <label className="font-semibold block text-slate-800 dark:text-slate-200">
            Logo del Restaurante
          </label>

          <div className="flex items-center gap-3">
            {draft.logoUrl ? (
              <div className="relative size-16 shrink-0">
                <LazyImage
                  src={draft.logoUrl}
                  alt="Logo preview"
                  containerClassName="size-full rounded-2xl ring-2 ring-indigo-500/40 shadow-xs"
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div
                style={{ backgroundColor: draft.primaryColor }}
                className="flex size-16 items-center justify-center rounded-2xl text-white font-bold text-xl shrink-0 shadow-xs border border-white/20"
              >
                {draft.name.charAt(0) || <Store className="size-6" />}
              </div>
            )}

            <div className="flex-1 space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => handleImageUpload(e, "logoUrl")}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  className="flex-1 justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Upload className="size-3.5 text-indigo-500" />
                  <span>Subir Logo</span>
                </Button>
                {draft.logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDeleteMedia("logo")}
                    className="px-2.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 border-rose-500/30 cursor-pointer"
                    title="Eliminar logo"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                Subí tu logo en formato PNG, JPG o WebP desde tu teléfono o PC.
              </p>
            </div>
          </div>
        </div>

        {/* Banner Upload */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <label className="font-semibold block text-slate-800 dark:text-slate-200">
            Foto de Portada / Banner Superior
          </label>

          {draft.bannerUrl && (
            <div className="relative h-24 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <LazyImage
                src={draft.bannerUrl}
                alt="Banner Preview"
                containerClassName="size-full"
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => setConfirmDeleteMedia("banner")}
                className="absolute top-2 right-2 z-10 rounded-lg bg-black/70 p-1.5 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                title="Eliminar foto de portada"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}

          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleImageUpload(e, "bannerUrl")}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => bannerInputRef.current?.click()}
            className="w-full justify-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Upload className="size-3.5 text-indigo-500" />
            <span>Subir Foto de Portada</span>
          </Button>
          <p className="text-[10px] text-slate-400">
            Imagen panorámica que aparece en la parte superior de la carta digital.
          </p>

          <div className="pt-2 space-y-3">
            <Switch
              checked={draft.showBanner}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showBanner: checked }))}
              label="Mostrar Banner en la Tienda"
              description="Muestra la foto de portada en la parte superior"
            />

            <Switch
              checked={draft.showAnnouncement}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showAnnouncement: checked }))}
              label="Barra de Anuncio Superior"
              description="Franja llamativa para promociones o avisos importantes"
            />

            {draft.showAnnouncement && (
              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Texto del Anuncio
                </label>
                <input
                  type="text"
                  value={draft.announcementText}
                  onChange={(e) => setDraft((prev) => ({ ...prev, announcementText: e.target.value }))}
                  placeholder="🔥 ¡Envío GRATIS hoy...!"
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Delete Media Modal */}
      <ConfirmDeleteModal
        isOpen={confirmDeleteMedia !== null}
        onClose={() => setConfirmDeleteMedia(null)}
        onConfirm={() => {
          if (confirmDeleteMedia === "logo") {
            setDraft((prev) => ({ ...prev, logoUrl: "" }))
            toast.success("Logo eliminado del diseño")
          } else if (confirmDeleteMedia === "banner") {
            setDraft((prev) => ({ ...prev, bannerUrl: "" }))
            toast.success("Foto de portada eliminada del diseño")
          }
          setConfirmDeleteMedia(null)
        }}
        title={
          confirmDeleteMedia === "logo"
            ? "¿Eliminar logo del restaurante?"
            : "¿Eliminar foto de portada?"
        }
        description={
          confirmDeleteMedia === "logo"
            ? "El logo se quitará del encabezado y de la carta digital de tus clientes. Podrás volver a subir uno en cualquier momento."
            : "La foto de portada se quitará del encabezado de la tienda. Podrás subir una nueva foto panorámica cuando quieras."
        }
        confirmText="Eliminar foto"
      />
    </>
  )
}
