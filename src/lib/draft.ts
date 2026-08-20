import { z } from "zod"
import type { BurgerCompra } from "@/data/data"

/**
 * Clave y versión del borrador de carrito en localStorage.
 * Un único lugar de verdad para el nombre de la clave y la versión del payload
 * (mismo patrón single-source que LIMITS en validation.ts).
 */
export const CART_DRAFT_KEY = "burger-page:cart-draft"
export const CART_DRAFT_VERSION = 1

const AdicionSchema = z.object({
  name: z.string(),
  price: z.number(),
  cantidad: z.number(),
  src: z.string(),
})

const BurgerCompraSchema = z.object({
  adicion: z.array(AdicionSchema),
  name: z.string(),
  src: z.string(),
  totalapagar: z.number(),
  cantidad: z.number(),
  observacion: z.string(),
})

/**
 * Schema del borrador. Solo contiene la versión y los items del carrito
 * (CART-4: nunca se persisten datos de cliente).
 */
export const CartDraftSchema = z.object({
  version: z.literal(CART_DRAFT_VERSION),
  items: z.array(BurgerCompraSchema),
})

export type CartDraft = z.infer<typeof CartDraftSchema>

/**
 * Lee el borrador del carrito. Devuelve null (nunca lanza) cuando no existe,
 * el JSON es corrupto, falla el schema o la versión no coincide (CART-2).
 */
export function readDraft(): BurgerCompra[] | null {
  try {
    const raw = window.localStorage.getItem(CART_DRAFT_KEY)
    if (raw === null) return null
    const parsed = CartDraftSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    return parsed.data.items
  } catch {
    return null
  }
}

/**
 * Persiste el carrito. Si la lista está vacía, limpia la clave para no
 * restaurar residuos al recargar (CART-1).
 */
export function writeDraft(items: BurgerCompra[]): void {
  if (items.length === 0) {
    clearDraft()
    return
  }
  const payload: CartDraft = { version: CART_DRAFT_VERSION, items }
  window.localStorage.setItem(CART_DRAFT_KEY, JSON.stringify(payload))
}

/** Elimina el borrador del carrito. */
export function clearDraft(): void {
  window.localStorage.removeItem(CART_DRAFT_KEY)
}
