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
        className={cn(
          "flex size-full items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500",
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
