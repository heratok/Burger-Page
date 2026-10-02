import React, { useState } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { MIN_PASSWORD_LENGTH } from "@burger-page/contracts"
import {
  Store,
  X,
  Sparkles,
  Check,
  Phone,
  KeyRound,
  Copy,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { THEME_COLOR_PRESETS } from "@/constants/themePresets"
import { apiClient } from "@/core/api/apiClient"
import { toast } from "sonner"

interface CreateRestaurantModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateRestaurantModal: React.FC<CreateRestaurantModalProps> = ({ isOpen, onClose }) => {
  const { adminTheme, refreshRestaurants } = useRestaurant()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [tagline, setTagline] = useState("")
  const [whatsapp, setWhatsapp] = useState("573001234567")
  const [primaryColor, setPrimaryColor] = useState("#FF7A21")
  const [templateType, setTemplateType] = useState<"burger" | "pizza" | "tacos" | "blank">("burger")
  const [adminUsername, setAdminUsername] = useState("")
  const [adminPassword, setAdminPassword] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string
    password?: string
  } | null>(null)
  const [copiedUser, setCopiedUser] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)

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

  const handleFinish = () => {
    setName("")
    setSlug("")
    setTagline("")
    setWhatsapp("573001234567")
    setPrimaryColor("#FF7A21")
    setTemplateType("burger")
    setAdminUsername("")
    setAdminPassword("")
    setCreatedCredentials(null)
    setErrorMessage(null)
    onClose()
  }

  const handleCopy = async (text: string, type: "user" | "pass") => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        if (type === "user") {
          setCopiedUser(true)
          setTimeout(() => setCopiedUser(false), 2000)
        } else {
          setCopiedPass(true)
          setTimeout(() => setCopiedPass(false), 2000)
        }
        toast.success("Copiado al portapapeles")
        return
      }
      throw new Error("Clipboard API no disponible")
    } catch {
      toast.error("No se pudo copiar automáticamente. Por favor selecciónalo y cópialo manualmente.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return

    if (adminPassword.trim() && adminPassword.trim().length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await apiClient.createRestaurant({
        name: name.trim(),
        slug: slug.trim(),
        tagline: tagline.trim() || "La mejor comida artesanal",
        whatsappNumber: whatsapp.trim() || "573001234567",
        primaryColor,
        templateType,
        adminUsername: adminUsername.trim() || undefined,
        adminPassword: adminPassword.trim() || undefined,
      })

      await refreshRestaurants()

      const creds = res as { adminUsername?: string; adminPassword?: string }
      if (creds?.adminUsername && creds?.adminPassword) {
        setCreatedCredentials({
          username: creds.adminUsername,
          password: creds.adminPassword,
        })
      } else {
        toast.success(`Restaurante "${name.trim()}" creado exitosamente`)
        handleFinish()
      }
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes("409") || err?.code === "CONFLICT") {
        setErrorMessage("El nombre de usuario administrador ya está en uso. Por favor ingresa otro en el campo 'Usuario Admin'.")
      } else {
        setErrorMessage(err?.message || "Ocurrió un error al crear el restaurante.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Credentials View
  if (createdCredentials) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <div
          className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
            isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <KeyRound className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">Credenciales del Administrador</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restaurante creado con éxito
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3.5">
            {/* Warning banner */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                <strong>Atención:</strong> Esta contraseña provisional es de uso único y solo se mostrará esta vez. Cópiala y entrégala al administrador del restaurante; deberá cambiarla obligatoriamente en su primer inicio de sesión.
              </span>
            </div>

            {/* Username credential */}
            <div className={`p-3 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Usuario administrador
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {createdCredentials.username}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(createdCredentials.username, "user")}
                  aria-label={copiedUser ? "Usuario copiado" : "Copiar usuario administrador"}
                  className="rounded-lg border px-2 py-1 text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {copiedUser ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-slate-400" />}
                  <span>{copiedUser ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
            </div>

            {/* Password credential */}
            {createdCredentials.password && (
              <div className={`p-3 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Contraseña provisional
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {createdCredentials.password}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdCredentials.password!, "pass")}
                    aria-label={copiedPass ? "Clave copiada" : "Copiar clave provisional"}
                    className="rounded-lg border px-2 py-1 text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {copiedPass ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-slate-400" />}
                    <span>{copiedPass ? "Copiado" : "Copiar"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={handleFinish}
              className="w-full rounded-xl bg-indigo-600 font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
            >
              Ya copié las credenciales, cerrar
            </Button>
          </div>
        </div>
      </div>
    )
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

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Name & Slug */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="restaurant-name"
                className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
              >
                Nombre del Restaurante *
              </label>
              <input
                id="restaurant-name"
                type="text"
                required
                maxLength={80}
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
              <label
                htmlFor="restaurant-slug"
                className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
              >
                Slug / URL Pública *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  /
                </span>
                <input
                  id="restaurant-slug"
                  type="text"
                  required
                  maxLength={40}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
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
            <label
              htmlFor="restaurant-tagline"
              className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
            >
              Slogan / Descripción Corta
            </label>
            <input
              id="restaurant-tagline"
              type="text"
              maxLength={120}
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

          {/* WhatsApp */}
          <div>
            <label
              htmlFor="restaurant-whatsapp"
              className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
            >
              WhatsApp de Pedidos
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id="restaurant-whatsapp"
                type="text"
                maxLength={20}
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

          {/* One-time Admin Credentials */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="restaurant-admin-username"
                className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
              >
                Usuario Admin (Opcional)
              </label>
              <input
                id="restaurant-admin-username"
                type="text"
                maxLength={50}
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder={`admin_${slug || "slug"}`}
                className={`w-full rounded-xl border px-3.5 py-2 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="restaurant-admin-password"
                className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
              >
                Clave Admin (Opcional, mín. 8 caracteres)
              </label>
              <input
                id="restaurant-admin-password"
                type="password"
                maxLength={80}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Generar automáticamente"
                className={`w-full rounded-xl border px-3.5 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
                }`}
              />
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
              disabled={isSubmitting}
              className="rounded-xl font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 rounded-xl bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 cursor-pointer"
            >
              {isSubmitting ? (
                <CheckCircle2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              <span>{isSubmitting ? "Creando..." : "Crear Restaurante"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
