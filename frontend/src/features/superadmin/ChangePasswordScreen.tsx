import React, { useState } from "react"
import { useUi, useAuth } from "@/context/RestaurantContext"
import { MIN_PASSWORD_LENGTH } from "@burger-page/contracts"
import {
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useAppRouter } from "@/core/router/useAppRouter"

interface ChangePasswordScreenProps {
  forced?: boolean
  isForced?: boolean
  onClose?: () => void
  onCancel?: () => void
  onSuccess?: () => void
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  forced,
  isForced = false,
  onClose,
  onCancel,
  onSuccess,
}) => {
  const activeForced = forced ?? isForced
  const handleClose = onClose || onCancel
  const { adminTheme } = useUi()
  const { session, changePassword, logout } = useAuth()
  const { navigateTo } = useAppRouter()
  const isDark = adminTheme === "dark"

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Validations
  const isTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH
  const isSameAsCurrent =
    newPassword.length > 0 && currentPassword.length > 0 && newPassword === currentPassword
  const isMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword

  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    !isSameAsCurrent &&
    newPassword === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    try {
      const res = await changePassword(currentPassword, newPassword)
      if (res.success) {
        if (activeForced) {
          if (session.role === "super") {
            navigateTo("/admin/restaurants")
          } else {
            navigateTo("/admin/dashboard")
          }
        }
        onSuccess?.()
        handleClose?.()
      } else {
        const error = res.error || "No se pudo cambiar la contraseña. Verifica la contraseña actual."
        setErrorMessage(error)
      }
    } catch (err: any) {
      const rawMsg = err?.message || ""
      const msg = rawMsg.toLowerCase().includes("current password")
        ? "La contraseña actual es incorrecta"
        : rawMsg || "Ocurrió un error al intentar cambiar la contraseña."
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const content = (
    <div
      className={`w-full max-w-md rounded-3xl border p-6 sm:p-8 shadow-2xl transition-all ${
        isDark
          ? "border-slate-800 bg-[#0E1322] text-slate-100"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-12 items-center justify-center rounded-2xl ${
              activeForced
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/25"
                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25"
            }`}
          >
            {activeForced ? <ShieldAlert className="size-6" /> : <Lock className="size-6" />}
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              {activeForced ? "Cambio de contraseña obligatorio" : "Cambiar contraseña"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeForced
                ? "Debes definir una nueva contraseña antes de continuar utilizando el panel."
                : "Actualiza tu clave de acceso al panel administrativo."}
            </p>
          </div>
        </div>

        {!activeForced && handleClose && (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Current Password */}
        <div>
          <label
            htmlFor="currentPassword"
            className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
          >
            Contraseña actual
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              type={showCurrent ? "text" : "password"}
              required
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value)
                setErrorMessage(null)
              }}
              placeholder="Ingresa tu contraseña actual"
              className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              tabIndex={-1}
              aria-label={showCurrent ? "Ocultar contraseña actual" : "Mostrar contraseña actual"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label
            htmlFor="newPassword"
            className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
          >
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showNew ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setErrorMessage(null)
              }}
              placeholder="Mínimo 8 caracteres"
              className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              tabIndex={-1}
              aria-label={showNew ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {isTooShort && (
            <p className="mt-1 text-[11px] font-semibold text-rose-500 flex items-center gap-1">
              <AlertCircle className="size-3" />
              <span>La nueva contraseña debe tener al menos 8 caracteres.</span>
            </p>
          )}
          {isSameAsCurrent && (
            <p className="mt-1 text-[11px] font-semibold text-rose-500 flex items-center gap-1">
              <AlertCircle className="size-3" />
              <span>La nueva contraseña debe ser diferente a la actual.</span>
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300"
          >
            Confirmar nueva contraseña
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setErrorMessage(null)
              }}
              placeholder="Repite la nueva contraseña"
              className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              tabIndex={-1}
              aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {isMismatch && (
            <p className="mt-1 text-[11px] font-semibold text-rose-500 flex items-center gap-1">
              <AlertCircle className="size-3" />
              <span>Las contraseñas no coinciden.</span>
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-2.5">
          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 animate-spin" />
                Actualizando...
              </span>
            ) : (
              <span>Actualizar contraseña</span>
            )}
          </Button>

          {activeForced ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => logout()}
              className="w-full rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 cursor-pointer"
            >
              <LogOut className="size-3.5 mr-1.5" />
              <span>Cerrar sesión</span>
            </Button>
          ) : (
            handleClose && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="w-full rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </Button>
            )
          )}
        </div>
      </form>
    </div>
  )

  if (activeForced) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50 dark:bg-[#070A11]">
        {content}
      </div>
    )
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleClose?.()}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            handleClose?.()
          }
        }}
        className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-0 border-0 bg-transparent shadow-none"
      >
        {content}
      </DialogContent>
    </Dialog>
  )
}
