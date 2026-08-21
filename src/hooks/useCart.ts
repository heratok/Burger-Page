import { useState, useEffect, useMemo, useCallback } from "react"
import { toast } from "sonner"
import type { BurgerCompra } from "@/data/data"
import { readDraft, writeDraft, clearDraft } from "@/lib/draft"

export function useCart() {
  const [items, setItems] = useState<BurgerCompra[]>(() => readDraft() ?? [])
  const [showRecovery, setShowRecovery] = useState<boolean>(() => {
    const draft = readDraft()
    return draft !== null && draft.length > 0
  })
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Persiste el carrito en cada mutación; una lista vacía limpia el borrador (CART-1).
  useEffect(() => {
    writeDraft(items)
  }, [items])

  const total = useMemo(
    () => items.reduce((acc, item) => acc + item.totalapagar, 0),
    [items]
  )

  const addItem = useCallback((item: BurgerCompra) => {
    setItems((prev) => {
      if (editingIndex !== null) {
        const next = prev.map((curr, i) => (i === editingIndex ? item : curr))
        return next
      }
      return [...prev, item]
    })

    if (editingIndex !== null) {
      setEditingIndex(null)
      toast.success("Cambios guardados")
    } else {
      toast.success(`${item.name} agregada al carrito`)
    }
  }, [editingIndex])

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const replaceCart = useCallback((newItems: BurgerCompra[]) => {
    setItems(newItems)
  }, [])

  const clearAll = useCallback(() => {
    clearDraft()
    setItems([])
  }, [])

  const discardDraft = useCallback(() => {
    clearDraft()
    setItems([])
    setShowRecovery(false)
  }, [])

  const dismissRecovery = useCallback(() => {
    setShowRecovery(false)
  }, [])

  const startEditing = useCallback((index: number) => {
    setEditingIndex(index)
  }, [])

  const cancelEditing = useCallback(() => {
    setEditingIndex(null)
  }, [])

  const editingItem = editingIndex !== null ? items[editingIndex] ?? null : null

  return {
    items,
    total,
    itemCount: items.length,
    showRecovery,
    setShowRecovery,
    editingIndex,
    editingItem,
    addItem,
    removeItem,
    replaceCart,
    clearAll,
    discardDraft,
    dismissRecovery,
    startEditing,
    cancelEditing,
  }
}
