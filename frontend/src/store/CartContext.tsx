import { useEffect, useMemo, useReducer, useRef } from "react"
import type { ReactNode } from "react"
import type { CartItem } from "@/lib/domain"
import { CartContext } from "./cart-context"

type CartAction =
  | { type: "add"; item: CartItem }
  | { type: "update"; index: number; item: CartItem }
  | { type: "remove"; index: number }
  | { type: "clear" }

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "add":
      return [...state, action.item]
    case "update":
      return state.map((item, i) => (i === action.index ? action.item : item))
    case "remove":
      return state.filter((_, i) => i !== action.index)
    case "clear":
      return []
  }
}

/**
 * Shared in-memory cart store (menu → cart → checkout flow unchanged).
 * Snapshot by value: CartItems keep their own copies of product data.
 *
 * Scope isolation (design D5, spec RD-2): the provider is scoped to the
 * active restaurant slug. Changing scope clears the cart (switching
 * restaurants never leaks items); keeping the same scope preserves it
 * (same-slug navigation keeps the order). No scope = legacy unscoped use.
 */
export function CartProvider({
  children,
  scope,
}: {
  children: ReactNode
  scope?: string
}) {
  const [items, dispatch] = useReducer(cartReducer, [])
  const lastScope = useRef(scope)

  useEffect(() => {
    if (lastScope.current !== scope) {
      lastScope.current = scope
      dispatch({ type: "clear" })
    }
  }, [scope])

  const total = useMemo(
    () => items.reduce((acc, item) => acc + item.total, 0),
    [items]
  )
  const value = useMemo(
    () => ({
      items,
      total,
      addItem: (item: CartItem) => dispatch({ type: "add", item }),
      updateItem: (index: number, item: CartItem) =>
        dispatch({ type: "update", index, item }),
      removeItem: (index: number) => dispatch({ type: "remove", index }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [items, total]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}