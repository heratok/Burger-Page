import React, { useState } from "react"
import type { Order, OrderStatus } from "@/types/restaurant"
import { MapPin, MessageCircle, X, Trash2, Eye, Upload, FileText, ExternalLink } from "lucide-react"
import { OrderStatusBadge } from "@/components/ui/status-badge"
import { formatCurrency } from "@/lib/utils"
import { uploadImageToStorage } from "@/core/storage/supabaseStorage"
import { toast } from "sonner"

export interface OrderDetailModalProps {
  order: Order | null
  isOpen: boolean
  isDark?: boolean
  onClose: () => void
  onUpdateStatus: (orderId: string, status: OrderStatus) => void
  onUpdateReceipt?: (orderId: string, receiptUrl: string) => void | Promise<void>
  onDeleteOrder: (order: Order) => void
  onWhatsApp: (order: Order) => void
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  isDark = false,
  onClose,
  onUpdateStatus,
  onUpdateReceipt,
  onDeleteOrder,
  onWhatsApp,
}) => {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !order) return

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen no debe superar los 10MB")
      return
    }

    setIsUploading(true)
    try {
      const reader = new FileReader()
      const dataUrlPromise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      const dataUrl = await dataUrlPromise

      let finalUrl = dataUrl
      try {
        const uploaded = await uploadImageToStorage(file, {
          restaurantId: (order as any).restaurantId || "general",
          folder: "general",
        })
        if (uploaded) {
          finalUrl = uploaded
        }
      } catch (uploadErr) {
        console.warn("Storage upload fallback to dataUrl:", uploadErr)
      }

      if (onUpdateReceipt) {
        await onUpdateReceipt(order.id, finalUrl)
      }
      toast.success("Comprobante adjuntado con éxito")
    } catch {
      toast.error("No se pudo cargar el comprobante")
    } finally {
      setIsUploading(false)
    }
  }

  if (!isOpen || !order) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
      <div
        className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                Orden #{order.orderNumber}
              </span>
              <OrderStatusBadge status={order.status} />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Registrada el {new Date(order.createdAt).toLocaleString("es-CO")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalles"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Customer Information */}
        <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-3.5 text-xs space-y-2 border dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {order.customer.nombre}
            </span>
            <button
              type="button"
              onClick={() => onWhatsApp(order)}
              className="flex items-center gap-1 font-semibold text-emerald-600 hover:underline dark:text-emerald-400 cursor-pointer"
            >
              <MessageCircle className="size-3.5" />
              <span>WhatsApp: {order.customer.telefono}</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <MapPin className="size-3.5 text-slate-400" />
            <span>
              {order.customer.direccion}, Barrio {order.customer.barrio}
            </span>
          </div>
        </div>

        {/* Items Breakdown */}
        <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Detalle del Pedido
          </h4>
          {order.items.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs space-y-1.5 bg-slate-50/70 dark:bg-slate-800"
            >
              <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                <span>
                  {item.cantidad || (item as any).quantity || 1}× {item.name}
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                  {formatCurrency(item.total ?? item.price * (item.cantidad || (item as any).quantity || 1))}
                </span>
              </div>
              {item.adiciones && item.adiciones.length > 0 && (
                <div className="text-[11px] text-slate-600 dark:text-slate-300 pl-3 border-l-2 border-slate-300 dark:border-slate-600 space-y-0.5">
                  {item.adiciones.map((a, i) => (
                    <div key={i}>
                      + {a.cantidad}× {a.name} ({formatCurrency(a.price * a.cantidad)})
                    </div>
                  ))}
                </div>
              )}
              {item.observacion && (
                <p className="text-[11px] text-amber-600 dark:text-amber-300 italic pt-0.5">
                  Nota: {item.observacion}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Payment & Totals */}
        <div className="mt-4 border-t pt-3 border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Subtotal productos</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatCurrency(order.total ?? (order as any).subtotal ?? 0)}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Costo de domicilio</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatCurrency(order.deliveryFee ?? (order as any).costoEnvio ?? 0)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white">
            <span>Total a Pagar</span>
            <span className="text-indigo-600 dark:text-indigo-400 text-base font-black">
              {formatCurrency(order.finalTotal || 0)}
            </span>
          </div>
          <div className="mt-2 rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 text-[11px] flex justify-between border dark:border-slate-700 text-slate-800 dark:text-slate-200">
            <span>Método: <strong>{order.metodo}</strong></span>
            {order.pagoCon && (
              <span>
                Paga con: {formatCurrency(Number(order.pagoCon))}{" "}
                {order.cambio ? `(Cambio: ${formatCurrency(order.cambio)})` : ""}
              </span>
            )}
          </div>

          {/* Transfer Receipt Verification / Post-sale upload */}
          {order.metodo === "Transferencia" && (
            <div className="mt-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <FileText className="size-3.5 text-indigo-500" />
                  Soporte de Transferencia
                </span>
                {order.receiptUrl ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ Comprobante cargado
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    ! Sin soporte adjunto
                  </span>
                )}
              </div>

              {order.receiptUrl ? (
                <div className="mt-2.5 flex items-center gap-3">
                  <div
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-xs hover:opacity-90 transition-opacity group"
                    title="Clic para ver comprobante ampliado"
                  >
                    <img
                      src={order.receiptUrl}
                      alt="Soporte de pago"
                      className="size-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <Eye className="size-4" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Comprobante disponible para verificación contable.
                    </p>
                    <div className="flex items-center gap-2.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setIsReceiptModalOpen(true)}
                        className="text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="size-3.5" />
                        <span>Ver soporte</span>
                      </button>
                      <label className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer">
                        {isUploading ? "Subiendo..." : "Cambiar"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploading}
                          onChange={handleUploadReceipt}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5">
                  <label
                    className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 bg-white/80 dark:bg-slate-900/80 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer transition-colors ${
                      isUploading ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <Upload className="size-4" />
                    <span>{isUploading ? "Cargando comprobante..." : "+ Adjuntar Soporte de Transferencia"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploading}
                      onChange={handleUploadReceipt}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-1 text-[10px] text-slate-400 text-center">
                    Carga el comprobante post-venta para el registro contable
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Status Advancer Controls */}
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4 border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold w-full text-slate-500 dark:text-slate-400">
            Cambiar estado de orden:
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateStatus(order.id, "pending")
              onClose()
            }}
            className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            🟡 Pendiente
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdateStatus(order.id, "cooking")
              onClose()
            }}
            className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            🟠 En Cocina
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdateStatus(order.id, "delivering")
              onClose()
            }}
            className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            🔵 En Reparto
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdateStatus(order.id, "delivered")
              onClose()
            }}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300 cursor-pointer"
          >
            🟢 Entregado
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdateStatus(order.id, "cancelled")
              onClose()
            }}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300 cursor-pointer"
          >
            🔴 Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onDeleteOrder(order)
              onClose()
            }}
            className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-500/20 ml-auto cursor-pointer"
            title="Eliminar orden definitivamente"
          >
            <Trash2 className="size-3" />
            <span>Eliminar Orden</span>
          </button>
        </div>
      </div>

      {/* Lightbox Modal for Receipt Image */}
      {isReceiptModalOpen && order.receiptUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] max-w-2xl w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 p-4 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white">
              <div>
                <h3 className="font-bold text-sm">Comprobante de Transferencia</h3>
                <p className="text-xs text-slate-400">Orden #{order.orderNumber} • {order.customer.nombre}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={order.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Abrir imagen en nueva pestaña"
                >
                  <ExternalLink className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  aria-label="Cerrar comprobante"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto py-4 flex items-center justify-center">
              <img
                src={order.receiptUrl}
                alt={`Comprobante Orden #${order.orderNumber}`}
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
