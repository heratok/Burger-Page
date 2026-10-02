import React, { useState } from "react"
import { KeyRound, Copy, Check, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ResetPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  username: string
  temporaryPassword?: string
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  username,
  temporaryPassword,
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !temporaryPassword) return null

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(temporaryPassword)
      }
      setCopied(true)
      toast.success("Contraseña temporal copiada al portapapeles")
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("No se pudo copiar automáticamente")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1322] p-6 shadow-2xl text-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <KeyRound className="size-6" />
          </div>

          <div className="flex-1 min-w-0">
            <DialogHeader className="p-0 text-left">
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
                Contraseña Restablecida
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Se generó una contraseña provisional para el usuario{" "}
                <strong className="text-slate-900 dark:text-white">&quot;{username}&quot;</strong>.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Temporary Password Box */}
        <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Contraseña temporal
          </span>
          <div className="flex items-center justify-between gap-3">
            <code className="font-mono text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400 select-all break-all">
              {temporaryPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0 gap-1.5 rounded-xl border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span>¡Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
          <p className="leading-snug">
            Esta contraseña <strong>solo se mostrará una vez</strong>. Cópiala y compártela de forma segura. El usuario deberá cambiarla obligatoriamente en su próximo inicio de sesión.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-xs font-bold px-5 cursor-pointer"
          >
            Entendido, cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
