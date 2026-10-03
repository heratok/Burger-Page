import { useEffect } from "react"

/** Tab title for platform-level views (landing, login, super admin modules). */
export const PLATFORM_TITLE = "FoodOS"

export function resolveDocumentTitle(restaurantName: string | undefined): string {
  const trimmed = restaurantName?.trim()
  return trimmed ? trimmed : PLATFORM_TITLE
}

/**
 * Keeps the browser tab title in sync with the active restaurant, so every
 * tenant shows its own name instead of a hardcoded brand from index.html.
 */
export function useDocumentTitle(restaurantName: string | undefined): void {
  const title = resolveDocumentTitle(restaurantName)
  useEffect(() => {
    document.title = title
  }, [title])
}
