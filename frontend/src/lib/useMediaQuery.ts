import { useEffect, useState } from "react"

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function"

/**
 * Subscribes to a CSS media query. `fallback` is returned where matchMedia is unavailable
 * (SSR, jsdom), so callers choose the safe side for their case.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const [value, setValue] = useState(() => (canMatch() ? window.matchMedia(query).matches : fallback))

  useEffect(() => {
    if (!canMatch()) return
    const mql = window.matchMedia(query)
    const onChange = () => setValue(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return value
}
