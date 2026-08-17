import { useMemo, useReducer } from "react"
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
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, [])
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