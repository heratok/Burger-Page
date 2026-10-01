import { useEffect, useRef } from "react"

const REFRESH_MS = 60_000

/**
 * Calls `refresh` every minute while the tab is visible, and right away when
 * it becomes visible again. Polling pauses while the tab is hidden. Mount it
 * exactly once (the storefront root) so there is a single owner of the timer.
 * The callback is read through a ref, so a new identity never restarts it.
 */
export function useStoreStatusRefresh(refresh: () => void): void {
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const stop = () => {
      if (timer !== null) clearInterval(timer)
      timer = null
    }
    const start = () => {
      stop()
      timer = setInterval(() => refreshRef.current(), REFRESH_MS)
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshRef.current()
        start()
      } else {
        stop()
      }
    }
    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])
}
