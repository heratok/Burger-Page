import React, { useState, useEffect, useCallback } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type { RestaurantRecord } from "@/types/restaurant"
import { apiClient, type ApiUserRecord } from "@/core/api/apiClient"
import { mapUserActionError } from "./userActionUtils"
import {
  X,
  Store,
  AlertTriangle,
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  Power,
  Shield,
  Loader2,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResetPasswordModal } from "./ResetPasswordModal"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { CreateUserModal } from "./CreateUserModal"
import { EditUserModal } from "./EditUserModal"
import { toast } from "sonner"
import {
  COMMON_CURRENCIES,
  COMMON_TIMEZONES,
  getDefaultSymbolForCurrency,
} from "@/lib/currenciesAndTimezones"

export interface EditRestaurantModalProps {
  isOpen: boolean
  onClose: () => void
  restaurant: RestaurantRecord | null
  onSaved?: () => void
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const EditRestaurantModal: React.FC<EditRestaurantModalProps> = ({
  isOpen,
  onClose,
  restaurant,
  onSaved,
}) => {
  const { adminTheme, refreshRestaurants, session } = useRestaurant()

  const [name, setName] = useState("")
  const [tagline, setTagline] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [slug, setSlug] = useState("")
  const [timezone, setTimezone] = useState("America/Bogota")
  const [currency, setCurrency] = useState("COP")
  const [currencySymbol, setCurrencySymbol] = useState("$")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)

  // Restaurant administrators state
  const [admins, setAdmins] = useState<ApiUserRecord[]>([])
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false)
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [resetModalData, setResetModalData] = useState<{ username: string; temporaryPassword?: string } | null>(null)
  const [userToDelete, setUserToDelete] = useState<ApiUserRecord | null>(null)
  const [userToEdit, setUserToEdit] = useState<ApiUserRecord | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const isDark = adminTheme === "dark"

  const loadAdmins = useCallback(async (restaurantId: string) => {
    setIsLoadingAdmins(true)
    try {
      const users = await apiClient.listUsers(restaurantId)
      setAdmins(users || [])
    } catch (err: any) {
      toast.error(mapUserActionError(err, "No se pudieron cargar los administradores"))
      setAdmins([])
    } finally {
      setIsLoadingAdmins(false)
    }
  }, [])

  useEffect(() => {
    if (restaurant && isOpen) {
      setName(restaurant.config?.name || restaurant.name || "")
      setTagline(restaurant.config?.tagline || restaurant.tagline || "")
      setWhatsapp(restaurant.config?.whatsappNumber || (restaurant as any).whatsappNumber || "")
      setSlug(restaurant.slug || "")
      const initialTz = restaurant.config?.timezone || "America/Bogota"
      const initialCurr = restaurant.config?.currency || "COP"
      const initialSym = restaurant.config?.currencySymbol || getDefaultSymbolForCurrency(initialCurr)
      setTimezone(initialTz)
      setCurrency(initialCurr)
      setCurrencySymbol(initialSym)
      setErrorMessage(null)
      setSlugError(null)
      loadAdmins(restaurant.id)
    }
  }, [restaurant, isOpen, loadAdmins])

  if (!isOpen || !restaurant) return null

  const originalSlug = restaurant.slug || ""
  const isSlugChanged = slug.trim().toLowerCase() !== originalSlug.toLowerCase()

  const handleToggleAdminActive = async (admin: ApiUserRecord) => {
    const nextActive = admin.isActive === false
    setActionLoadingId(admin.id)
    try {
      const updated = await apiClient.setUserActive(admin.id, nextActive)
      setAdmins((prev) =>
        prev.map((item) => (item.id === admin.id ? { ...item, isActive: updated.isActive } : item))
      )
      toast.success(
        nextActive
          ? `Usuario "${admin.username}" activado con éxito`
          : `Usuario "${admin.username}" desactivado con éxito`
      )
    } catch (err: any) {
      toast.error(
        mapUserActionError(
          err,
          nextActive ? "No se pudo activar el usuario" : "No se pudo desactivar el usuario"
        )
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleResetAdminPassword = async (admin: ApiUserRecord) => {
    setActionLoadingId(admin.id)
    try {
      const res = await apiClient.resetUserPassword(admin.id)
      setResetModalData({ username: admin.username, temporaryPassword: res.temporaryPassword })
      toast.success(`Contraseña de "${admin.username}" restablecida correctamente`)
    } catch (err: any) {
      toast.error(mapUserActionError(err, "No se pudo restablecer la contraseña"))
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleConfirmDeleteAdmin = async () => {
    if (!userToDelete) return
    const target = userToDelete
    setUserToDelete(null)
    setActionLoadingId(target.id)
    try {
      await apiClient.deleteUser(target.id)
      setAdmins((prev) => prev.filter((item) => item.id !== target.id))
      toast.success(`Usuario "${target.username}" eliminado con éxito`)
    } catch (err: any) {
      toast.error(mapUserActionError(err, "No se pudo eliminar el usuario"))
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSlugError(null)

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim().toLowerCase()

    if (!trimmedName) {
      setErrorMessage("El nombre del restaurante no puede estar vacío ni contener solo espacios.")
      return
    }

    if (!trimmedSlug) {
      setSlugError("El slug es obligatorio.")
      return
    }

    const RESERVED_SLUGS = ["deleted", "templates"]
    if (RESERVED_SLUGS.includes(trimmedSlug)) {
      setSlugError(`El slug «${trimmedSlug}» está reservado por el sistema. Por favor, elegí otro slug.`)
      return
    }

    if (!SLUG_REGEX.test(trimmedSlug)) {
      setSlugError("El slug solo puede contener letras minúsculas, números y guiones (ej. mi-restaurante).")
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.updateRestaurant(restaurant.id, {
        name: trimmedName,
        tagline: tagline.trim(),
        whatsappNumber: whatsapp.trim(),
        slug: trimmedSlug,
        timezone,
        currency,
        currencySymbol: currencySymbol.trim() || "$",
      })

      toast.success("Restaurante actualizado correctamente")
      await refreshRestaurants()
      onSaved?.()
      onClose()
    } catch (err: any) {
      const status = err?.status
      const rawMsg = (err?.message || err?.body?.detail || err?.detail || "").toLowerCase()
      const isConflict =
        status === 409 ||
        err?.code === "CONFLICT" ||
        err?.message?.includes("409") ||
        rawMsg.includes("already exists") ||
        rawMsg.includes("en uso")

      if (isConflict) {
        setSlugError("El slug ya está en uso por otro restaurante (incluso si está pausado). Por favor, elegí un slug diferente.")
      } else if (rawMsg.includes("reserved") || rawMsg.includes("reservado")) {
        setSlugError(`El slug «${trimmedSlug}» está reservado por el sistema. Por favor, elegí otro slug.`)
      } else if (rawMsg.includes("name is required") || rawMsg.includes("nombre")) {
        setErrorMessage("El nombre del restaurante no puede estar vacío ni contener solo espacios.")
      } else {
        setErrorMessage(err?.message || "Ocurrió un error al actualizar el restaurante.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = `w-full rounded-xl border px-3.5 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDark
      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
      : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
  }`

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-restaurant-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md overflow-y-auto"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !resetModalData && !userToDelete && !isCreateUserOpen && !isSubmitting) {
            onClose()
          }
        }}
      >
        <div
          className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl transition-all my-8 max-h-[90vh] overflow-y-auto ${
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
                <h3 id="edit-restaurant-title" className="text-base font-bold">
                  Editar Restaurante
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Modificá los datos generales y gestioná los administradores de este local.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-6">
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Nombre */}
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="edit-rest-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nombre del Restaurante *
                </label>
                <input
                  id="edit-rest-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Burger Craft"
                  className={inputClass}
                />
              </div>

              {/* Tagline */}
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="edit-rest-tagline" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Eslogan / Tagline
                </label>
                <input
                  id="edit-rest-tagline"
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="ej. Las mejores hamburguesas artesanales de la ciudad"
                  className={inputClass}
                />
              </div>

              {/* WhatsApp */}
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="edit-rest-whatsapp" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  WhatsApp (para recepción de pedidos)
                </label>
                <input
                  id="edit-rest-whatsapp"
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="ej. 573001234567"
                  className={inputClass}
                />
              </div>

              {/* Slug */}
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="edit-rest-slug" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Slug / URL Pública *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    /
                  </span>
                  <input
                    id="edit-rest-slug"
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase())
                      setSlugError(null)
                    }}
                    placeholder="burger-craft"
                    className={`${inputClass} pl-6 font-mono text-[11px]`}
                  />
                </div>
                {slugError && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">{slugError}</p>
                )}

                {/* Slug change warning */}
                {isSlugChanged && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 mt-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>
                      ⚠️ <strong>Atención:</strong> Al cambiar el slug se actualizará la URL de la tienda pública. Los enlaces anteriores y códigos QR dejarán de funcionar.
                    </span>
                  </div>
                )}
              </div>

              {/* Zona Horaria */}
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="edit-rest-timezone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Zona Horaria *
                </label>
                <select
                  id="edit-rest-timezone"
                  aria-label="Zona Horaria"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={inputClass}
                >
                  <optgroup label="Latinoamérica">
                    {COMMON_TIMEZONES.filter((tz) => tz.group === "Latinoamérica").map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Otras regiones">
                    {COMMON_TIMEZONES.filter((tz) => tz.group === "Otras regiones").map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Moneda y Símbolo */}
              <div className="space-y-1">
                <label htmlFor="edit-rest-currency" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Moneda *
                </label>
                <select
                  id="edit-rest-currency"
                  aria-label="Moneda"
                  value={currency}
                  onChange={(e) => {
                    const nextCurr = e.target.value
                    const prevDefault = getDefaultSymbolForCurrency(currency)
                    if (!currencySymbol || currencySymbol === prevDefault) {
                      setCurrencySymbol(getDefaultSymbolForCurrency(nextCurr))
                    }
                    setCurrency(nextCurr)
                  }}
                  className={inputClass}
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-rest-symbol" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Símbolo *
                </label>
                <input
                  id="edit-rest-symbol"
                  aria-label="Símbolo"
                  type="text"
                  required
                  maxLength={8}
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Administradores de este restaurante */}
            <div className="border-t pt-5 border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-indigo-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Administradores de este restaurante
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsCreateUserOpen(true)
                  }}
                  className="flex items-center gap-1.5 rounded-xl text-xs font-bold border border-indigo-500/30 px-3 py-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors"
                >
                  <UserPlus className="size-3.5" />
                  <span>+ Agregar administrador</span>
                </button>
              </div>

              {isLoadingAdmins ? (
                <div className="flex items-center justify-center p-6 text-xs text-slate-400 gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Cargando administradores...</span>
                </div>
              ) : admins.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  No hay administradores registrados para este restaurante.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {admins.map((admin) => {
                    const isOwnAccount = session.username === admin.username
                    const isActionLoading = actionLoadingId === admin.id

                    return (
                      <div
                        key={admin.id}
                        className="flex items-center justify-between p-3 gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0">
                            <Shield className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs truncate text-slate-900 dark:text-white">
                                {admin.username}
                              </span>
                              {isOwnAccount && (
                                <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.2 text-[9px] font-bold text-indigo-600 dark:text-indigo-300">
                                  Tú
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Active badge */}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              admin.isActive !== false
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {admin.isActive !== false ? "Activo" : "Inactivo"}
                          </span>

                          {/* Edit user */}
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => setUserToEdit(admin)}
                            title="Editar usuario"
                            aria-label={`Editar usuario ${admin.username}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Pencil className="size-3.5" />
                          </button>

                          {/* Toggle Active */}
                          <button
                            type="button"
                            disabled={isActionLoading || isOwnAccount}
                            onClick={() => handleToggleAdminActive(admin)}
                            title={
                              isOwnAccount
                                ? "No podés modificar tu propia cuenta"
                                : admin.isActive !== false
                                ? "Desactivar usuario"
                                : "Activar usuario"
                            }
                            aria-label={
                              admin.isActive !== false
                                ? `Desactivar usuario ${admin.username}`
                                : `Activar usuario ${admin.username}`
                            }
                            className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                              admin.isActive !== false
                                ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <Power className="size-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            disabled={isActionLoading || isOwnAccount}
                            onClick={() => handleResetAdminPassword(admin)}
                            title={
                              isOwnAccount
                                ? "No podés restablecer tu propia contraseña desde aquí"
                                : "Restablecer contraseña"
                            }
                            aria-label={`Restablecer contraseña de ${admin.username}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40 dark:hover:text-amber-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <KeyRound className="size-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            disabled={isActionLoading || isOwnAccount}
                            onClick={() => setUserToDelete(admin)}
                            title={
                              isOwnAccount
                                ? "No podés eliminar tu propia cuenta"
                                : "Eliminar usuario"
                            }
                            aria-label={`Eliminar usuario ${admin.username}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 border-t pt-4 border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </div>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Submodal: Create User */}
      <CreateUserModal
        isOpen={isCreateUserOpen}
        defaultRestaurantId={restaurant.id}
        onClose={() => setIsCreateUserOpen(false)}
        onSuccess={() => loadAdmins(restaurant.id)}
      />

      {/* Submodal: Reset Password */}
      <ResetPasswordModal
        isOpen={!!resetModalData}
        onClose={() => setResetModalData(null)}
        username={resetModalData?.username || ""}
        temporaryPassword={resetModalData?.temporaryPassword || ""}
      />

      {/* Submodal: Confirm Delete User */}
      <ConfirmDeleteModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDeleteAdmin}
        title="¿Eliminar usuario?"
        targetName={userToDelete?.username}
        description={
          userToDelete
            ? `¿Estás seguro de que deseas eliminar al usuario "${userToDelete.username}"? Perderá acceso inmediato al sistema.`
            : undefined
        }
        confirmText="Eliminar usuario"
      />

      {/* Submodal: Edit User */}
      <EditUserModal
        isOpen={!!userToEdit}
        onClose={() => setUserToEdit(null)}
        user={userToEdit}
        onSuccess={() => loadAdmins(restaurant.id)}
      />
    </>
  )
}
