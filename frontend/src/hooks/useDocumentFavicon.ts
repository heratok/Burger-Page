import { useEffect } from "react"

export const PLATFORM_FAVICON = "/logo.jpg"

export function resolveFaviconHref(logoUrl: string | undefined): string {
  const trimmed = logoUrl?.trim()
  return trimmed ? trimmed : PLATFORM_FAVICON
}

function getOrCreateIconLink(): HTMLLinkElement {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }
  return link
}

function applyHref(href: string): void {
  const link = getOrCreateIconLink()
  // Tenant logos may be png/webp/svg, so a fixed MIME type would be wrong.
  link.removeAttribute("type")
  link.setAttribute("href", href)
}

/**
 * Shows the tenant logo as favicon once it is known to load; otherwise (or on
 * unmount) the platform favicon is used.
 */
export function useDocumentFavicon(logoUrl: string | undefined): void {
  useEffect(() => {
    const href = resolveFaviconHref(logoUrl)
    applyHref(PLATFORM_FAVICON)

    if (href === PLATFORM_FAVICON) return

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (!cancelled) applyHref(href)
    }
    image.onerror = () => {
      if (!cancelled) applyHref(PLATFORM_FAVICON)
    }
    image.src = href

    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
      applyHref(PLATFORM_FAVICON)
    }
  }, [logoUrl])
}
