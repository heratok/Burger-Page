import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"
import type { MenuItem } from "@/types/restaurant"
import { calculateLineItemTotal, type CartItem } from "./cartEngine"

export const CART_STORAGE_PREFIX = "burger_page_cart_"
export const DEFAULT_CART_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface StoredCartEnvelope {
  version: number
  restaurantId: string
  updatedAt: number
  items: CartItem[]
}

export interface UseCartOptions {
  restaurantId?: string
  products?: MenuItem[]
  ttlMs?: number
  onItemRemoved?: (item: CartItem, reason: "out_of_stock" | "deleted") => void
  onPriceUpdated?: (item: CartItem, oldPrice: number, newPrice: number) => void
}

export function getCartStorageKey(restaurantId?: string): string {
  return `${CART_STORAGE_PREFIX}${restaurantId || "default"}`
}

export function loadStoredCart(
  storageKey: string,
  restaurantId?: string,
  ttlMs = DEFAULT_CART_TTL_MS
): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredCartEnvelope | CartItem[]

    let items: CartItem[] = []
    if (Array.isArray(parsed)) {
      items = parsed
    } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
      if (parsed.updatedAt && Date.now() - parsed.updatedAt > ttlMs) {
        localStorage.removeItem(storageKey)
        return []
      }
      if (restaurantId && parsed.restaurantId && parsed.restaurantId !== restaurantId) {
        return []
      }
      items = parsed.items
    }

    return items.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.price === "number" &&
        typeof item.name === "string"
    )
  } catch (err) {
    console.warn("Failed to load cart from localStorage", err)
    return []
  }
}

export function saveStoredCart(
  storageKey: string,
  restaurantId: string | undefined,
  items: CartItem[]
): void {
  if (typeof window === "undefined") return
  try {
    if (items.length === 0) {
      localStorage.removeItem(storageKey)
      return
    }
    const envelope: StoredCartEnvelope = {
      version: 1,
      restaurantId: restaurantId || "default",
      updatedAt: Date.now(),
      items,
    }
    localStorage.setItem(storageKey, JSON.stringify(envelope))
  } catch (err) {
    console.warn("Failed to save cart to localStorage", err)
  }
}

export function useCart({
  restaurantId,
  products = [],
  ttlMs = DEFAULT_CART_TTL_MS,
  onItemRemoved,
  onPriceUpdated,
}: UseCartOptions = {}) {
  const storageKey = useMemo(() => getCartStorageKey(restaurantId), [restaurantId])

  const [cartItems, setCartItemsState] = useState<CartItem[]>(() => {
    return loadStoredCart(storageKey, restaurantId, ttlMs)
  })

  const hasRevalidatedRef = useRef(false)
  const prevRestaurantIdRef = useRef(restaurantId)

  // Scoped reset when switching restaurants
  useEffect(() => {
    if (prevRestaurantIdRef.current !== restaurantId) {
      prevRestaurantIdRef.current = restaurantId
      hasRevalidatedRef.current = false
      const loaded = loadStoredCart(storageKey, restaurantId, ttlMs)
      setCartItemsState(loaded)
    }
  }, [restaurantId, storageKey, ttlMs])

  // Multi-tab synchronization
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        const reloaded = loadStoredCart(storageKey, restaurantId, ttlMs)
        setCartItemsState(reloaded)
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [storageKey, restaurantId, ttlMs])

  // Revalidation against catalog (stock and current price)
  useEffect(() => {
    if (!products || products.length === 0 || hasRevalidatedRef.current) return
    if (cartItems.length === 0) {
      hasRevalidatedRef.current = true
      return
    }

    let hasChanged = false
    const validItems: CartItem[] = []

    for (const item of cartItems) {
      const product = products.find(
        (p) =>
          (item.menuItemId && p.id === item.menuItemId) ||
          p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      )

      if (!product) {
        hasChanged = true
        if (onItemRemoved) {
          onItemRemoved(item, "deleted")
        } else {
          toast.warning(`"${item.name}" ya no está disponible en el menú`)
        }
        continue
      }

      if (product.inStock === false) {
        hasChanged = true
        if (onItemRemoved) {
          onItemRemoved(item, "out_of_stock")
        } else {
          toast.warning(`"${item.name}" está agotado temporalmente y fue retirado del carrito`)
        }
        continue
      }

      if (product.price !== item.price) {
        hasChanged = true
        const oldPrice = item.price
        const newPrice = product.price
        const updatedTotal = calculateLineItemTotal({
          price: newPrice,
          cantidad: item.cantidad,
          adiciones: item.adiciones,
        })
        validItems.push({
          ...item,
          price: newPrice,
          total: updatedTotal,
        })
        if (onPriceUpdated) {
          onPriceUpdated(item, oldPrice, newPrice)
        } else {
          toast.info(`El precio de "${item.name}" fue actualizado`)
        }
      } else {
        validItems.push(item)
      }
    }

    hasRevalidatedRef.current = true

    if (hasChanged) {
      setCartItemsState(validItems)
      saveStoredCart(storageKey, restaurantId, validItems)
    }
  }, [products, cartItems, storageKey, restaurantId, onItemRemoved, onPriceUpdated])

  const setCartItems = useCallback(
    (action: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
      setCartItemsState((prev) => {
        const next = typeof action === "function" ? action(prev) : action
        saveStoredCart(storageKey, restaurantId, next)
        return next
      })
    },
    [storageKey, restaurantId]
  )

  const addToCart = useCallback(
    (item: CartItem) => {
      setCartItems((prev) => [...prev, item])
    },
    [setCartItems]
  )

  const updateCartItem = useCallback(
    (index: number, updatedItem: CartItem) => {
      setCartItems((prev) => prev.map((item, i) => (i === index ? updatedItem : item)))
    },
    [setCartItems]
  )

  const removeCartItem = useCallback(
    (index: number) => {
      setCartItems((prev) => prev.filter((_, i) => i !== index))
    },
    [setCartItems]
  )

  const clearCart = useCallback(() => {
    setCartItems([])
  }, [setCartItems])

  const totalCart = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.total, 0),
    [cartItems]
  )

  const itemCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.cantidad, 0),
    [cartItems]
  )

  return {
    cartItems,
    totalCart,
    itemCount,
    setCartItems,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
  }
}
