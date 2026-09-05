import React, { useState, useRef, useEffect } from "react"
import type { MenuItem } from "@/types/restaurant"
import { X, Sparkles, Upload, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { LazyImage } from "@/components/ui/LazyImage"
import { toast } from "sonner"
import { optimizeImageToWebP } from "@/lib/imageOptimizer"
import { uploadImageToStorage } from "@/core/storage/supabaseStorage"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"

export interface ProductModalProps {
  isOpen: boolean
  editingProduct: MenuItem | null
  categories: string[]
  restaurantId?: string
  isDark?: boolean
  onClose: () => void
  onSave: (productData: Omit<MenuItem, "id">) => Promise<void> | void
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  editingProduct,
  categories,
  restaurantId,
  isDark = false,
  onClose,
  onSave,
}) => {
  const [isCustomCategoryInput, setIsCustomCategoryInput] = useState(false)
  const [productForm, setProductForm] = useState({
    name: "",
    price: 26000,
    category: categories[0] || "Platos Principales",
    src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
    description: "",
    inStock: true,
    isPopular: false,
    isNew: true,
    preparationTimeMinutes: 15,
  })

  const productFileInputRef = useRef<HTMLInputElement>(null)
  const [imageUploadStatus, setImageUploadStatus] = useState<"idle" | "optimizing" | "uploading" | "success">("idle")
  const isImageBusy = imageUploadStatus !== "idle"
  const [isConfirmingRemovePhoto, setIsConfirmingRemovePhoto] = useState(false)
  const [previewFitMode, setPreviewFitMode] = useState<"cover" | "contain">("cover")

  useEffect(() => {
    if (!isOpen) return

    if (editingProduct) {
      setIsCustomCategoryInput(false)
      setProductForm({
        name: editingProduct.name,
        price: editingProduct.price,
        category: editingProduct.category,
        src: editingProduct.src,
        description: editingProduct.description,
        inStock: editingProduct.inStock,
        isPopular: !!editingProduct.isPopular,
        isNew: !!editingProduct.isNew,
        preparationTimeMinutes: editingProduct.preparationTimeMinutes || 15,
      })
    } else {
      setIsCustomCategoryInput(false)
      setProductForm({
        name: "",
        price: 26000,
        category: categories[0] || "Platos Principales",
        src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
        description: "",
        inStock: true,
        isPopular: false,
        isNew: true,
        preparationTimeMinutes: 15,
      })
    }
  }, [isOpen, editingProduct, categories])

  if (!isOpen) return null

  const handleProductImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato no compatible. Por favor sube una imagen JPG, PNG, WebP o AVIF.")
      e.target.value = ""
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen original debe ser menor a 10MB")
      e.target.value = ""
      return
    }

    try {
      setImageUploadStatus("optimizing")

      // 1. Local WebP conversion
      const optimizedWebP = await optimizeImageToWebP(file, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.82,
      })

      // Immediate local preview so the user sees their photo right away
      setProductForm((prev) => ({ ...prev, src: optimizedWebP }))
      setImageUploadStatus("uploading")

      // 2. Direct upload to Storage via backend Presigned URL
      const uploadedUrl = await uploadImageToStorage(optimizedWebP, {
        restaurantId: restaurantId || "default",
        folder: "products",
      })

      if (uploadedUrl) {
        setProductForm((prev) => ({ ...prev, src: uploadedUrl }))
        setImageUploadStatus("success")
        toast.success("Foto optimizada y guardada exitosamente")
        await new Promise((resolve) => setTimeout(resolve, 850))
      }
    } catch (err: any) {
      console.error("Failed to optimize or upload product image:", err)
      toast.error("No se pudo procesar la imagen seleccionada")
    } finally {
      setImageUploadStatus("idle")
      e.target.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = productForm.name.trim()
    if (!trimmedName) {
      toast.error("El nombre del producto no puede estar vacío")
      return
    }
    if (productForm.price <= 0 || isNaN(productForm.price)) {
      toast.error("El precio del producto debe ser mayor a 0")
      return
    }
    if (!productForm.category) {
      toast.error("Debes seleccionar una categoría válida")
      return
    }

    let finalSrc = productForm.src
    if (finalSrc && finalSrc.startsWith("data:")) {
      try {
        setImageUploadStatus("uploading")
        finalSrc = await uploadImageToStorage(finalSrc, {
          restaurantId: restaurantId || "default",
          folder: "products",
        })
      } catch (err) {
        console.warn("Storage upload fallback:", err)
      } finally {
        setImageUploadStatus("idle")
      }
    }

    const payload = { ...productForm, name: trimmedName, src: finalSrc }
    await onSave(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
      <div
        className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {editingProduct ? `Editar "${editingProduct.name}"` : "Nuevo Producto"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                Nombre del Producto *
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Ej. Plato Especial de la Casa"
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                Precio ($ COP) *
              </label>
              <input
                type="number"
                required
                min={0}
                max={50000000}
                step="any"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Categoría
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategoryInput(!isCustomCategoryInput)}
                  className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {isCustomCategoryInput ? "Elegir existente" : "+ Nueva categoría"}
                </button>
              </div>

              {isCustomCategoryInput ? (
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  placeholder="Ej. Entradas, Postres, Bebidas"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              ) : (
                <Select
                  size="md"
                  value={productForm.category}
                  onChange={(e) => {
                    if (e.target.value === "__NEW__") {
                      setIsCustomCategoryInput(true)
                      setProductForm({ ...productForm, category: "" })
                    } else {
                      setProductForm({ ...productForm, category: e.target.value })
                    }
                  }}
                  options={[
                    ...categories.map((cat) => ({ value: cat, label: cat })),
                    { value: "__NEW__", label: "+ Crear nueva categoría..." },
                  ]}
                />
              )}
            </div>
            <div>
              <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                Tiempo Estimado (Minutos)
              </label>
              <input
                type="number"
                min={0}
                max={300}
                value={productForm.preparationTimeMinutes}
                onChange={(e) =>
                  setProductForm({ ...productForm, preparationTimeMinutes: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
              Foto del Producto
            </label>

            <input
              ref={productFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={handleProductImageFile}
              className="hidden"
            />

            {productForm.src ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 p-3 space-y-3">
                {/* Viewport Header with Fit Controls */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <Sparkles className="size-3.5 text-emerald-500" />
                    <span>Previsualización del Plato</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-0.5 dark:bg-slate-800 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewFitMode("cover")}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        previewFitMode === "cover"
                          ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                      title="Ver cómo se recortará en la tarjeta del menú"
                    >
                      Encuadre Tarjeta
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFitMode("contain")}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        previewFitMode === "contain"
                          ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                      title="Ver la imagen completa sin recortes"
                    >
                      Foto Completa
                    </button>
                  </div>
                </div>

                {/* Generous Preview Canvas */}
                <div className="relative h-56 sm:h-64 w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-200/60 dark:border-slate-700/80 flex items-center justify-center">
                  <LazyImage
                    src={productForm.src}
                    alt="Vista previa del producto"
                    containerClassName="size-full flex items-center justify-center"
                    className={`size-full transition-all duration-200 ${
                      previewFitMode === "cover" ? "object-cover" : "object-contain p-2"
                    }`}
                  />
                  {isImageBusy && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-md p-6 text-center transition-all animate-in fade-in duration-200">
                      <div className="relative flex items-center justify-center">
                        {imageUploadStatus === "success" ? (
                          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20 animate-in zoom-in-75 duration-200">
                            <CheckCircle2 className="size-7" />
                          </div>
                        ) : (
                          <>
                            <div className="absolute size-16 rounded-2xl bg-gradient-to-tr from-indigo-500/40 via-purple-500/30 to-pink-500/30 blur-lg animate-pulse" />
                            <div className="relative flex size-14 items-center justify-center rounded-2xl bg-slate-900/90 border border-white/15 text-indigo-400 shadow-2xl">
                              <Loader2 className="size-7 animate-spin text-indigo-400" />
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm font-bold text-white tracking-wide block">
                          {imageUploadStatus === "success"
                            ? "¡Foto lista!"
                            : imageUploadStatus === "optimizing"
                            ? "Optimizando foto..."
                            : "Guardando foto..."}
                        </span>
                        <p className="text-[11px] text-slate-300">
                          {imageUploadStatus === "success"
                            ? "Formato WebP de alta calidad aplicado"
                            : imageUploadStatus === "optimizing"
                            ? "Comprimiendo y ajustando resolución..."
                            : "Sincronizando imagen con el servidor..."}
                        </p>
                      </div>

                      {imageUploadStatus !== "success" && (
                        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-800 border border-white/10">
                          <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full animate-pulse" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-lg bg-black/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/10">
                    {imageUploadStatus === "success" ? (
                      <>
                        <CheckCircle2 className="size-3 text-emerald-400" />
                        <span>Foto guardada</span>
                      </>
                    ) : isImageBusy ? (
                      <>
                        <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                        <span>Procesando foto...</span>
                      </>
                    ) : (
                      <>
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Formato WebP Optimizado</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action controls */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isImageBusy}
                    onClick={() => productFileInputRef.current?.click()}
                    className="gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    {isImageBusy ? (
                      <Loader2 className="size-3.5 text-indigo-500 animate-spin" />
                    ) : (
                      <Upload className="size-3.5 text-indigo-500" />
                    )}
                    <span>{isImageBusy ? "Procesando..." : "Cambiar Foto"}</span>
                  </Button>
                  <button
                    type="button"
                    disabled={isImageBusy}
                    onClick={() => setIsConfirmingRemovePhoto(true)}
                    className="text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1 cursor-pointer disabled:opacity-40"
                  >
                    Quitar Foto
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {isImageBusy ? (
                  <div className="relative h-52 w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-700/80 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                    <div className="relative mb-3 flex items-center justify-center">
                      {imageUploadStatus === "success" ? (
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20 animate-in zoom-in-75 duration-200">
                          <CheckCircle2 className="size-7" />
                        </div>
                      ) : (
                        <>
                          <div className="absolute size-16 rounded-2xl bg-gradient-to-tr from-indigo-500/40 via-purple-500/30 to-pink-500/30 blur-lg animate-pulse" />
                          <div className="relative flex size-14 items-center justify-center rounded-2xl bg-slate-900/90 border border-white/15 text-indigo-400 shadow-2xl">
                            <Loader2 className="size-7 animate-spin text-indigo-400" />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-sm font-bold text-white tracking-wide block">
                        {imageUploadStatus === "success"
                          ? "¡Foto lista!"
                          : imageUploadStatus === "optimizing"
                          ? "Optimizando foto..."
                          : "Guardando foto..."}
                      </span>
                      <p className="text-[11px] text-slate-300">
                        {imageUploadStatus === "success"
                          ? "Formato WebP de alta calidad aplicado"
                          : imageUploadStatus === "optimizing"
                          ? "Comprimiendo y ajustando resolución..."
                          : "Sincronizando imagen con el servidor..."}
                      </p>
                    </div>

                    {imageUploadStatus !== "success" && (
                      <div className="mt-3.5 h-1.5 w-48 overflow-hidden rounded-full bg-slate-800 border border-white/10">
                        <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => productFileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-5 text-center hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer transition-all"
                    >
                      <div className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 p-2 text-indigo-600 dark:text-indigo-400">
                        <Upload className="size-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Subir foto desde tu teléfono o PC
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Se comprime automáticamente a formato WebP ultraliviano
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                      <span className="text-[10px] uppercase font-bold text-slate-400">o ingresa una URL</span>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </div>

                    <input
                      type="url"
                      value={productForm.src}
                      onChange={(e) => setProductForm({ ...productForm, src: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
              Descripción e Ingredientes
            </label>
            <textarea
              rows={3}
              maxLength={350}
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              placeholder="Describe los ingredientes, preparación y acompañamientos..."
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={productForm.isPopular}
                onChange={(e) => setProductForm({ ...productForm, isPopular: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span>Destacar como &quot;Popular 🔥&quot;</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={productForm.isNew}
                onChange={(e) => setProductForm({ ...productForm, isNew: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span>Marcar como &quot;Nuevo ✨&quot;</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isImageBusy}
            >
              Cancelar
            </Button>
            <button
              type="submit"
              disabled={isImageBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isImageBusy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Procesando foto...</span>
                </>
              ) : editingProduct ? (
                "Actualizar Producto"
              ) : (
                "Guardar en Menú"
              )}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDeleteModal
        isOpen={isConfirmingRemovePhoto}
        onClose={() => setIsConfirmingRemovePhoto(false)}
        onConfirm={() => {
          setProductForm((prev) => ({ ...prev, src: "" }))
          setIsConfirmingRemovePhoto(false)
          toast.info("Foto removida del producto")
        }}
        title="¿Quitar foto del producto?"
        targetName={productForm.name || "Foto del producto"}
        description="¿Estás seguro de que deseas quitar la foto de este producto? Podrás subir una nueva foto o asignar una por URL cuando lo desees."
        confirmText="Sí, quitar foto"
      />
    </div>
  )
}
