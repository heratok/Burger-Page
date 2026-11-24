import React, { useState, useLayoutEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"
import { ImageIcon } from "lucide-react"
import { resolveImageUrl } from "@/core/storage/supabaseStorage"

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  containerClassName?: string
  fallbackClassName?: string
  fallbackIcon?: React.ReactNode
  showSkeleton?: boolean
}

/**
 * LazyImage Component
 * - Displays a shimmer skeleton while the image is downloading and decoding.
 * - Smoothly transitions (fades in) once the image is ready, preventing jarring flashes.
 * - Gracefully renders a resilient fallback placeholder if the image fails or is empty.
 * - Dynamically resolves storage URLs and relative paths across bucket configurations.
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  containerClassName,
  fallbackClassName,
  fallbackIcon,
  showSkeleton = true,
  ...props
}) => {
  const resolvedSrc = useMemo(() => resolveImageUrl(src), [src])
  // Status is keyed by the src it belongs to, so a src change is "loading"
  // again without a reset effect that could run after the new image's load
  // event already fired (cached images) and leave the skeleton up forever.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const isLoading = loadedSrc !== resolvedSrc
  const hasError = failedSrc === resolvedSrc

  // A cached image can finish before React attaches onLoad/onError: catch up
  // from the element's own state.
  useLayoutEffect(() => {
    const img = imgRef.current
    if (!img || !img.complete) return
    if (img.naturalWidth > 0) setLoadedSrc(resolvedSrc)
    else setFailedSrc(resolvedSrc)
  }, [resolvedSrc])

  if (!resolvedSrc || hasError) {
    return (
      <div
        data-testid="lazy-image-fallback"
        // No fill of our own (S13). index.css defines --color-bg-elevated-2 and
        // --color-text-muted once for the dark scale; storefront themes override
        // them per theme, and `.dark` is the only theme-scoped block. Admin light
        // mode is reachable but has no token set, so an opaque token fill becomes
        // a #2A2F35 dark tile on a light page. Leaving the surface transparent
        // keeps the tile correct everywhere: every caller already paints a frame
        // themed for the mode (slate-100/dark:slate-800 in the CRM, bg-elevated-2
        // on storefront cards). The glyph keeps the theme muted token, which
        // measures 4.1-6.7:1 on the four storefront themes and 4.5-5.5:1 in
        // admin dark; admin light's #8B8F95 on a light frame is the one sub-3:1
        // case left (3.25:1 on white, 2.97:1 on slate-100), and it needs an
        // admin-light token set in index.css, not a local colour.
        className={cn(
          "flex size-full items-center justify-center text-text-muted",
          containerClassName,
          fallbackClassName
        )}
      >
        {fallbackIcon || <ImageIcon className="size-6 opacity-60" />}
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {isLoading && showSkeleton && (
        <Skeleton className="absolute inset-0 size-full rounded-none" />
      )}
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoadedSrc(resolvedSrc)}
        onError={() => setFailedSrc(resolvedSrc)}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        {...props}
      />
    </div>
  )
}
