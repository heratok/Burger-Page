import React from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
  targetName?: string
  confirmText?: string
  cancelText?: string
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "¿Confirmar eliminación?",
  description,
  targetName,
  confirmText = "Eliminar definitivamente",
  cancelText = "Cancelar",
}) => {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1322] p-6 shadow-2xl text-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="size-6" />
          </div>

          <div className="flex-1 min-w-0">
            <DialogHeader className="p-0 text-left">
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {description || (
                  <>
                    ¿Estás seguro de que deseas eliminar{" "}
                    {targetName ? <strong>"{targetName}"</strong> : "este elemento"}? Esta
                    acción es irreversible y no se podrá deshacer.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/25 hover:bg-rose-700 transition-all cursor-pointer"
          >
            <Trash2 className="size-3.5" />
            <span>{confirmText}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
