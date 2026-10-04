import React, { useState, useEffect } from "react"
import { useUi, useAuth, useTenant } from "@/context/RestaurantContext"
import { apiClient, type ApiUserRecord } from "@/core/api/apiClient"
import {
  X,
  UserCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { toast } from "sonner"
import { mapUserActionError } from "./userActionUtils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

export interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  user: ApiUserRecord | null
  onSuccess?: () => void
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const { adminTheme } = useUi()
  const { session } = useAuth()
  const { restaurants } = useTenant()

  const [username, setUsername] = useState("")
  const [role, setRole] = useState<"super_admin" | "restaurant_admin">("restaurant_admin")
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [isActive, setIsActive] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isDark = adminTheme === "dark"

  const isOwnAccount = Boolean(
    user && (
      (session.userId && session.userId === user.id) ||
      (session.username && session.username.toLowerCase() === user.username.toLowerCase()) ||
      (!session.userId && !session.username && user.username.toLowerCase() === "admin")
    )
  )

  useEffect(() => {
    if (user && isOpen) {
      setUsername(user.username || "")
      const userRole = (user.role === "super" || user.role === "super_admin") ? "super_admin" : "restaurant_admin"
      setRole(userRole)
      setRestaurantId(user.restaurantId || "")
      setIsActive(user.isActive !== false)
      setErrorMessage(null)
    }
  }, [user, isOpen])

  if (!isOpen || !user) return null

  const handleRoleChange = (newRole: "super_admin" | "restaurant_admin") => {
    setRole(newRole)
    if (newRole === "super_admin") {
      setRestaurantId("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      setErrorMessage("El nombre de usuario es obligatorio.")
      return
    }

    if (role === "restaurant_admin" && !restaurantId) {
      setErrorMessage("Debés seleccionar un restaurante para este usuario.")
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.updateUser(user.id, {
        username: trimmedUsername,
        role,
        restaurantId: role === "super_admin" ? null : restaurantId,
        isActive,
      })

      toast.success("Usuario actualizado correctamente")
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setErrorMessage(mapUserActionError(err, "Ocurrió un error al actualizar el usuario."))
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
    <Dialog open={true} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-0 border-0 bg-transparent shadow-none"
      >
        <div
          className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
            isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
          }`}
        >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <UserCheck className="size-5" />
            </div>
            <div>
              <h3 id="edit-user-title" className="text-base font-bold">
                Editar Usuario
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Modificá el nombre de usuario, rol o restaurante asignado.
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
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Username */}
          <div className="space-y-1">
            <label htmlFor="edit-user-username" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nombre de usuario *
            </label>
            <input
              id="edit-user-username"
              aria-label="Nombre de usuario"
              type="text"
              required
              minLength={3}
              maxLength={50}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. gerente_local"
              className={inputClass}
            />
          </div>

          {/* Role */}
          <div className="space-y-1">
            <Select
              id="edit-user-role"
              label="Rol en la plataforma *"
              aria-label="Rol en la plataforma"
              value={role}
              disabled={isOwnAccount && role === "super_admin"}
              onChange={(e) => handleRoleChange(e.target.value as typeof role)}
              searchable={false}
              options={[
                { value: "super_admin", label: "Super Administrador (Acceso global)" },
                { value: "restaurant_admin", label: "Administrador de Restaurante (Local)" },
              ]}
            />
            {isOwnAccount && role === "super_admin" && (
              <p className="text-[11px] font-semibold text-amber-500 flex items-center gap-1 mt-1">
                <AlertTriangle className="size-3 shrink-0" />
                <span>No podés modificar tu propio rol ni quitarte permisos de Super Administrador.</span>
              </p>
            )}
          </div>

          {/* Restaurant Selector */}
          <div className="space-y-1">
            <Select
              id="edit-user-restaurant"
              label="Restaurante Asignado *"
              aria-label="Restaurante Asignado"
              disabled={role === "super_admin"}
              value={role === "super_admin" ? "" : restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              placeholder="-- Seleccionar Restaurante --"
              searchable={restaurants.length > 5}
              options={[
                { value: "", label: "-- Seleccionar Restaurante --" },
                ...restaurants.map((r) => ({
                  value: r.id,
                  label: `${r.config?.name || r.name} ${r.isActive ? "(Operando)" : "(Pausado)"}`,
                })),
              ]}
            />
            {role === "super_admin" ? (
              <p className="text-[11px] text-slate-400 mt-1">
                Los Super Administradores tienen acceso global y no se asocian a un local específico.
              </p>
            ) : null}
          </div>

          {/* Active status */}
          <div className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3">
            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Estado de la cuenta
              </span>
              <span className="text-[11px] text-slate-400">
                {isActive ? "El usuario puede iniciar sesión y gestionar sus recursos." : "El acceso del usuario está bloqueado."}
              </span>
            </div>
            <button
              type="button"
              disabled={isOwnAccount}
              onClick={() => setIsActive(!isActive)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isActive ? "Activo" : "Inactivo"}
            </button>
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
    </DialogContent>
  </Dialog>
  )
}
