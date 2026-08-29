import React, { useState } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { Store, X, Sparkles, Check, Lock, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { THEME_COLOR_PRESETS } from "@/data/initialData"

interface CreateRestaurantModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateRestaurantModal: React.FC<CreateRestaurantModalProps> = ({ isOpen, onClose }) => {
  const { createRestaurant, adminTheme } = useRestaurant()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [tagline, setTagline] = useState("")
  const [whatsapp, setWhatsapp] = useState("573001234567")
  const [password, setPassword] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#FF7A21")
  const [templateType, setTemplateType] = useState<"burger" | "pizza" | "tacos" | "blank">("burger")

  const isDark = adminTheme === "dark"

  if (!isOpen) return null

  const handleNameChange = (val: string) => {
    setName(val)
    // Auto generate clean slug
    const generated = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
    setSlug(generated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return

    createRestaurant({
      name: name.trim(),
      slug: slug.trim(),
      tagline: tagline.trim() || "La mejor comida artesanal",
      whatsappNumber: whatsapp.trim() || "573001234567",
      adminPassword: password.trim() || "admin123",
      primaryColor,
      templateType,
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div
        className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto ${
          isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Store className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Dar de Alta Nuevo Restaurante</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registra un nuevo inquilino con su propia tienda y panel CRM.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Name & Slug */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Nombre del Restaurante *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej. Sushi Master Bogotá"
                className={`w-full rounded-xl border px-3.5 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Slug / URL Pública *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  /
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="sushi-master"
                  className={`w-full rounded-xl border pl-6 pr-3.5 py-2 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-indigo-400"
                      : "border-slate-200 bg-slate-50 text-indigo-600"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
              Slogan / Descripción Corta
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Ej. Rollos artesanales y cocina nikkei contemporánea"
              className={`w-full rounded-xl border px-3.5 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          {/* WhatsApp & Admin Password */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                WhatsApp de Pedidos
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="573001234567"
                  className={`w-full rounded-xl border pl-9 pr-3.5 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Contraseña Admin del Local
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123"
                  className={`w-full rounded-xl border pl-9 pr-3.5 py-2 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Preset Template */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
              Plantilla Inicial de Menú
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { id: "burger", name: "🍔 Hamburguesería", desc: "6 platos + 7 adicionales" },
                { id: "pizza", name: "🍕 Pizzería", desc: "4 pizzas + adicionales" },
                { id: "tacos", name: "🌮 Taquería", desc: "3 tipos de tacos" },
                { id: "blank", name: "📝 En Blanco", desc: "Menú vacío desde cero" },
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateType(tpl.id as typeof templateType)}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    templateType === tpl.id
                      ? "border-indigo-600 bg-indigo-500/10 ring-2 ring-indigo-500"
                      : isDark
                      ? "border-slate-800 bg-slate-900 hover:border-slate-700"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold">{tpl.name}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
              Color de Marca Principal
            </label>
            <div className="flex flex-wrap gap-2">
              {THEME_COLOR_PRESETS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setPrimaryColor(color.primary)}
                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all border-slate-200 dark:border-slate-700 hover:border-slate-400"
                >
                  <span
                    className="size-3.5 rounded-full shadow-xs"
                    style={{ backgroundColor: color.primary }}
                  />
                  <span className="text-[11px] font-medium">{color.name}</span>
                  {primaryColor === color.primary && (
                    <Check className="size-3 text-indigo-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-2.5 border-t pt-4 border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gap-2 rounded-xl bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700"
            >
              <Sparkles className="size-4" />
              <span>Crear Restaurante</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
